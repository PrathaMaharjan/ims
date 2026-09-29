import { db } from "@/db";
import { batches, parties, products, purchaseReturns } from "@/db/schema";
import { CompletePurchaseReturnInput, CreatePurchaseReturnInput, ListPurchaseReturnsQuery } from "@/lib/validation/retruns";
import { and, desc, eq, sql } from "drizzle-orm";

export class PurchaseReturnError extends Error {
  constructor(
    message: string,
    readonly reason:
      | "BATCH_NOT_FOUND"
      | "SUPPLIER_NOT_FOUND"
      | "INSUFFICIENT_STOCK"
      | "NOT_PENDING"
      | "RETURN_NOT_FOUND"
      | "RESOLVED_BATCH_NOT_FOUND"
      | "RESOLVED_BATCH_WRONG_PRODUCT"
      | "INVALID_EXPIRY",
  ) {
    super(message);
    this.name = "PurchaseReturnError";
  }
}

export async function createPurchaseReturn(organizationId: string, input: CreatePurchaseReturnInput) {
  const batch = await db
    .select({
      id: batches.id,
      productId: batches.productId,
      partyId: batches.partyId,
      quantityAvailable: batches.quantityAvailable,
    })
    .from(batches)
    .where(and(eq(batches.id, input.batchId), eq(batches.organizationId, organizationId)))
    .then((rows) => rows[0]);

  if (!batch) {
    throw new PurchaseReturnError("Batch not found", "BATCH_NOT_FOUND");
  }

  if (!batch.partyId) {
    throw new PurchaseReturnError(
      "Cannot return a batch with no associated supplier",
      "SUPPLIER_NOT_FOUND",
    );
  }

  // No expiry restriction here — a batch can be returned to the supplier
  // regardless of its expiry status (expired, near-expiry, or active).
  if (input.quantity > batch.quantityAvailable) {
    throw new PurchaseReturnError(
      `Only ${batch.quantityAvailable} units are available on this batch`,
      "INSUFFICIENT_STOCK",
    );
  }

  const [row] = await db
    .insert(purchaseReturns)
    .values({
      organizationId,
      partyId: batch.partyId,
      batchId: input.batchId,
      quantity: input.quantity,
      reason: input.reason,
      returnDate: input.returnDate ?? new Date().toISOString().slice(0, 10),
    })
    .returning();

  await db
    .update(batches)
    .set({
      quantityAvailable: sql`${batches.quantityAvailable} - ${input.quantity}`,
      updatedAt: new Date(),
    })
    .where(eq(batches.id, input.batchId));

  await db
    .update(products)
    .set({
      stockQuantity: sql`${products.stockQuantity} - ${input.quantity}`,
      updatedAt: new Date(),
    })
    .where(eq(products.id, batch.productId));

  return row;
}

// complete a purchase retrun

export async function completePurchaseReturn(
  organizationId: string,
  returnId: string,
  input: CompletePurchaseReturnInput,
) {
  const existing = await db.query.purchaseReturns.findFirst({
    where: and(eq(purchaseReturns.id, returnId), eq(purchaseReturns.organizationId, organizationId)),
  });

  if (!existing) {
    throw new PurchaseReturnError("Return not found", "RETURN_NOT_FOUND");
  }
  if (existing.status === "COMPLETED") {
    throw new PurchaseReturnError("Return is already completed", "NOT_PENDING");
  }

  if (input.resolutionType === "MONEY") {
    const [updated] = await db
      .update(purchaseReturns)
      .set({
        status: "COMPLETED",
        resolutionType: "MONEY",
        resolutionAmount: input.resolutionAmount.toFixed(2),
      })
      .where(eq(purchaseReturns.id, returnId))
      .returning();

    return updated;
  }

  // QUANTITY — validate the target batch before touching anything.
  // No expiry restriction on the target batch either — replacement stock can
  // be credited to any batch of the same product, whatever its own expiry.
  const targetBatch = await db
    .select({
      id: batches.id,
      productId: batches.productId,
    })
    .from(batches)
    .where(and(eq(batches.id, input.resolvedBatchId), eq(batches.organizationId, organizationId)))
    .then((rows) => rows[0]);

  if (!targetBatch) {
    throw new PurchaseReturnError("Replacement batch not found", "RESOLVED_BATCH_NOT_FOUND");
  }

  const originalBatch = await db.query.batches.findFirst({
    where: eq(batches.id, existing.batchId),
    columns: { productId: true },
  });

  if (targetBatch.productId !== originalBatch?.productId) {
    throw new PurchaseReturnError(
      "Replacement batch must be for the same product as the returned batch",
      "RESOLVED_BATCH_WRONG_PRODUCT",
    );
  }

  // Replacement stock must not already be expired.
  const today = new Date().toISOString().slice(0, 10);
  if (input.expiryDate <= today) {
    throw new PurchaseReturnError(
      "Replacement stock expiry date must be in the future",
      "INVALID_EXPIRY",
    );
  }

  // The fresh stock carries the supplier's new expiry date, so the batch's
  // expiry (and the EXPIRED / NEAR_EXPIRY / ACTIVE status derived from it)
  // moves to the latest date.
  await db
    .update(batches)
    .set({
      quantityAvailable: sql`${batches.quantityAvailable} + ${existing.quantity}`,
      expiryDate: input.expiryDate,
      status: "ACTIVE",
      updatedAt: new Date(),
    })
    .where(eq(batches.id, input.resolvedBatchId));

  await db
    .update(products)
    .set({
      stockQuantity: sql`${products.stockQuantity} + ${existing.quantity}`,
      updatedAt: new Date(),
    })
    .where(eq(products.id, targetBatch.productId));

  const [updated] = await db
    .update(purchaseReturns)
    .set({
      status: "COMPLETED",
      resolutionType: "QUANTITY",
      resolvedBatchId: input.resolvedBatchId,
    })
    .where(eq(purchaseReturns.id, returnId))
    .returning();

  return updated;
}

export async function listPurchaseReturns(organizationId: string, query: ListPurchaseReturnsQuery) {
  const conditions = [eq(purchaseReturns.organizationId, organizationId)];
  if (query.status) conditions.push(eq(purchaseReturns.status, query.status));
  if (query.partyId) conditions.push(eq(purchaseReturns.partyId, query.partyId));

  const offset = (query.page - 1) * query.limit;

  const rows = await db
    .select({
      id: purchaseReturns.id,
      batchId: purchaseReturns.batchId,
      productId: batches.productId,
      quantity: purchaseReturns.quantity,
      reason: purchaseReturns.reason,
      status: purchaseReturns.status,
      returnDate: purchaseReturns.returnDate,
      createdAt: purchaseReturns.createdAt,
      resolutionType: purchaseReturns.resolutionType,
      resolutionAmount: purchaseReturns.resolutionAmount,
      resolvedBatchId: purchaseReturns.resolvedBatchId,
      batchNumber: batches.batchNumber,
      productName: products.name,
      partyName: parties.name,
    })
    .from(purchaseReturns)
    .innerJoin(batches, eq(purchaseReturns.batchId, batches.id))
    .innerJoin(products, eq(batches.productId, products.id))
    .innerJoin(parties, eq(purchaseReturns.partyId, parties.id))
    .where(and(...conditions))
    .orderBy(desc(purchaseReturns.createdAt))
    .limit(query.limit)
    .offset(offset);

  return rows;
}

export async function getPurchaseReturnMoneyTotal(organizationId: string) {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${purchaseReturns.resolutionAmount}), 0)`,
      count: sql<string>`count(*)`,
    })
    .from(purchaseReturns)
    .where(
      and(
        eq(purchaseReturns.organizationId, organizationId),
        eq(purchaseReturns.status, "COMPLETED"),
        eq(purchaseReturns.resolutionType, "MONEY"),
      ),
    );

  return {
    totalAmount: Number(row?.total ?? 0),
    count: Number(row?.count ?? 0),
  };
}
