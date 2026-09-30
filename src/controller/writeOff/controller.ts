import { db } from "@/db";
import { batches, products, expenses, expenseCategories, stockWriteOffs } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import type { CreateWriteOffInput, ListWriteOffsQuery } from "@/lib/validation/writeOffs";

export class WriteOffError extends Error {
  constructor(
    message: string,
    readonly reason: "BATCH_NOT_FOUND" | "NOT_EXPIRED" | "NOTHING_TO_WRITE_OFF",
  ) {
    super(message);
    this.name = "WriteOffError";
  }
}

const CATEGORY_NAME = "Inventory Write-off";

// export async function createWriteOff(organizationId: string, userId: string, input: CreateWriteOffInput) {
//   const batch = await db
//     .select({
//       id: batches.id,
//       productId: batches.productId,
//       batchNumber: batches.batchNumber,
//       purchasePrice: batches.purchasePrice,
//       quantityAvailable: batches.quantityAvailable,
//       isExpired: sql<boolean>`${batches.expiryDate} < CURRENT_DATE`,
//     })
//     .from(batches)
//     .where(and(eq(batches.id, input.batchId), eq(batches.organizationId, organizationId)))
//     .then((rows) => rows[0]);

//   if (!batch) throw new WriteOffError("Batch not found", "BATCH_NOT_FOUND");
//   if (!batch.isExpired) throw new WriteOffError("Only expired batches can be written off", "NOT_EXPIRED");

//   // Everything left on the batch goes.
//   const quantity = batch.quantityAvailable;
//   if (quantity <= 0) throw new WriteOffError("Nothing left to write off on this batch", "NOTHING_TO_WRITE_OFF");

//   const unitCost = Number(batch.purchasePrice);
//   const totalLoss = unitCost * quantity;

//   // Zero out the batch, but only if the stock is still what we just read
//   // (someone could have returned or adjusted it in between).
//   const zeroed = await db
//     .update(batches)
//     .set({ quantityAvailable: 0, updatedAt: new Date() })
//     .where(and(eq(batches.id, batch.id), eq(batches.quantityAvailable, quantity)))
//     .returning({ id: batches.id });

//   if (zeroed.length === 0) {
//     throw new WriteOffError("Batch stock changed, please try again", "NOTHING_TO_WRITE_OFF");
//   }

//   await db
//     .update(products)
//     .set({ stockQuantity: sql`${products.stockQuantity} - ${quantity}`, updatedAt: new Date() })
//     .where(eq(products.id, batch.productId));

//   // Find or create the "Inventory Write-off" expense category.
//   let category = await db
//     .select({ id: expenseCategories.id })
//     .from(expenseCategories)
//     .where(and(eq(expenseCategories.organizationId, organizationId), eq(expenseCategories.name, CATEGORY_NAME)))
//     .then((rows) => rows[0]);

//   if (!category) {
//     [category] = await db
//       .insert(expenseCategories)
//       .values({ organizationId, name: CATEGORY_NAME })
//       .returning({ id: expenseCategories.id });
//   }

//   const [expense] = await db
//     .insert(expenses)
//     .values({
//       organizationId,
//       categoryId: category.id,
//       amount: totalLoss.toFixed(2),
//       description: `Expired stock write-off (batch ${batch.batchNumber})`,
//       expenseDate: new Date().toISOString().slice(0, 10),
//     })
//     .returning({ id: expenses.id });

//   const [writeOff] = await db
//     .insert(stockWriteOffs)
//     .values({
//       organizationId,
//       batchId: batch.id,
//       productId: batch.productId,
//       quantity,
//       unitCost: unitCost.toFixed(2),
//       totalLoss: totalLoss.toFixed(2),
//       reason: input.reason,
//       expenseId: expense.id,
//       createdByUserId: userId,
//     })
//     .returning();

//   return writeOff;
// }

export async function createWriteOff(organizationId: string, userId: string, input: CreateWriteOffInput) {
  const batch = await db
    .select({
      id: batches.id,
      productId: batches.productId,
      batchNumber: batches.batchNumber,
      purchasePrice: batches.purchasePrice,
      quantityAvailable: batches.quantityAvailable,
      isExpired: sql<boolean>`${batches.expiryDate} < CURRENT_DATE`,
    })
    .from(batches)
    .where(and(eq(batches.id, input.batchId), eq(batches.organizationId, organizationId)))
    .then((rows) => rows[0]);

  if (!batch) throw new WriteOffError("Batch not found", "BATCH_NOT_FOUND");
  if (!batch.isExpired) throw new WriteOffError("Only expired batches can be written off", "NOT_EXPIRED");

  // Everything left on the batch goes.
  const quantity = batch.quantityAvailable;
  if (quantity <= 0) throw new WriteOffError("Nothing left to write off on this batch", "NOTHING_TO_WRITE_OFF");

  const unitCost = Number(batch.purchasePrice);
  const totalLoss = unitCost * quantity;

  // Zero out the batch, but only if the stock is still what we just read
  // (someone could have returned or adjusted it in between).
  const zeroed = await db
    .update(batches)
    .set({ quantityAvailable: 0, updatedAt: new Date() })
    .where(and(eq(batches.id, batch.id), eq(batches.quantityAvailable, quantity)))
    .returning({ id: batches.id });

  if (zeroed.length === 0) {
    throw new WriteOffError("Batch stock changed, please try again", "NOTHING_TO_WRITE_OFF");
  }

  await db
    .update(products)
    .set({ stockQuantity: sql`${products.stockQuantity} - ${quantity}`, updatedAt: new Date() })
    .where(eq(products.id, batch.productId));

  const [writeOff] = await db
    .insert(stockWriteOffs)
    .values({
      organizationId,
      batchId: batch.id,
      productId: batch.productId,
      quantity,
      unitCost: unitCost.toFixed(2),
      totalLoss: totalLoss.toFixed(2),
      reason: input.reason,
      createdByUserId: userId,
    })
    .returning();

  return writeOff;
}













export async function listWriteOffs(organizationId: string, query: ListWriteOffsQuery) {
  return db
    .select({
      id: stockWriteOffs.id,
      batchId: stockWriteOffs.batchId,
      quantity: stockWriteOffs.quantity,
      unitCost: stockWriteOffs.unitCost,
      totalLoss: stockWriteOffs.totalLoss,
      reason: stockWriteOffs.reason,
      createdAt: stockWriteOffs.createdAt,
      batchNumber: batches.batchNumber,
      productName: products.name,
    })
    .from(stockWriteOffs)
    .innerJoin(batches, eq(stockWriteOffs.batchId, batches.id))
    .innerJoin(products, eq(stockWriteOffs.productId, products.id))
    .where(eq(stockWriteOffs.organizationId, organizationId))
    .orderBy(desc(stockWriteOffs.createdAt))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit);
}