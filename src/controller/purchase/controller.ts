import {
  CreatePurchaseInput,
  UpdatePurchaseInput,
} from "@/lib/validation/purchases";
import { db } from "../../db";
import {
  purchases,
  purchaseItems,
  batches,
  products,
  expenses,
} from "../../db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { invalidateCache } from "@/lib/cache";
import { getOrCreateInventoryCategory } from "../expenses/category";

export interface PurchaseTotals {
  subtotal: number;
  vatAmount: number;
  grandTotal: number;
  lineTotals: number[]; // parallel to input.items, one total per line
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculatePurchaseTotals(
  input: CreatePurchaseInput,
): PurchaseTotals {
  const lineTotals = input.items.map((item) =>
    round2(item.batch.quantity * item.purchaseRate),
  );

  const subtotal = round2(lineTotals.reduce((sum, t) => sum + t, 0));

  let vatAmount = 0;

  if (input.purcType === "VAT_EXEMPT") {
    vatAmount = 0;
  } else if (input.purcType === "VAT_ITEM_WISE") {
    const vatableSubtotal = input.items.reduce(
      (sum, item, i) => (item.vatApplicable ? sum + lineTotals[i] : sum),
      0,
    );
    vatAmount = round2((vatableSubtotal * input.vatRate) / 100);
  } else if (input.purcType === "VAT_TAX_INCL") {
    vatAmount = round2(subtotal - subtotal / (1 + input.vatRate / 100));
  }

  const afterAdjustments =
    subtotal -
    input.discount +
    input.freightCharges +
    vatAmount -
    input.vatRefund;

  // Rounding direction is now a real user choice, not a fixed rule — the
  // caller's roundingDirection decides ceil vs floor, not "nearest."
  const grandTotal =
    input.roundingDirection === "UP"
      ? Math.ceil(afterAdjustments)
      : Math.floor(afterAdjustments);

  return { subtotal, vatAmount, grandTotal, lineTotals };
}

async function buildPurchaseExpenseText(
  input: CreatePurchaseInput,
): Promise<{ description: string; note: string }> {
  const productIds = [...new Set(input.items.map((item) => item.productId))];

  const productRows = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(inArray(products.id, productIds));

  const nameById = new Map(productRows.map((p) => [p.id, p.name]));

  const lineDescriptions = input.items.map((item) => {
    const name = nameById.get(item.productId) ?? "Unknown item";
    const lineTotal = (item.batch.quantity * item.purchaseRate).toFixed(2);
    return `${name} — Rs. ${item.purchaseRate.toFixed(2)}/unit × ${item.batch.quantity} = Rs. ${lineTotal}`;
  });
  const itemNames = input.items.map(
    (item) => nameById.get(item.productId) ?? "Unknown item",
  );
  const uniqueNames = [...new Set(itemNames)];
  const shortNames =
    uniqueNames.length > 3
      ? `${uniqueNames.slice(0, 3).join(", ")} +${uniqueNames.length - 3} more`
      : uniqueNames.join(", ");

  const description = `Purchase${input.supplierInvoiceNumber ? ` (Invoice ${input.supplierInvoiceNumber})` : ""} — ${shortNames}`;

  const note = lineDescriptions.join("\n");

  return { description, note };
}

// export async function createPurchase(
//   organizationId: string,
//   userId: string,
//   input: CreatePurchaseInput,
// ) {
//   const totals = calculatePurchaseTotals(input);

//   // 1. Create the purchase header first — items/batches need its id.
//   const [purchase] = await db
//     .insert(purchases)
//     .values({
//       organizationId,
//       supplierId: input.supplierId,
//       supplierInvoiceNumber: input.supplierInvoiceNumber,
//       purchaseDate: input.purchaseDate,
//       purcType: input.purcType,
//       paymentType: input.paymentType, // new
//       subtotal: totals.subtotal.toFixed(2),
//       discount: input.discount.toFixed(2),
//       freightCharges: input.freightCharges.toFixed(2),
//       vatAmount: totals.vatAmount.toFixed(2),
//       vatRefund: input.vatRefund.toFixed(2),
//       grandTotal: totals.grandTotal.toFixed(2),
//       createdByUserId: userId,
//     })
//     .returning({ id: purchases.id });

//   if (!purchase) {
//     throw new Error("Failed to create purchase");
//   }

//   try {
//     // 2. Insert all purchase_items in one batched call (not a loop of inserts).
//     const insertedItems = await db
//       .insert(purchaseItems)
//       .values(
//         input.items.map((item, i) => ({
//           purchaseId: purchase.id,
//           productId: item.productId,
//           batchNumber: item.batch.batchNumber,
//           manufacturingDate: item.batch.manufacturingDate,
//           expiryDate: item.batch.expiryDate,
//           quantity: item.batch.quantity,
//           purchaseRate: item.purchaseRate.toFixed(2),
//           mrp: (item.batch.mrp ?? 0).toFixed(2),
//           vatApplicable: item.vatApplicable,
//           lineTotal: totals.lineTotals[i].toFixed(2),
//         })),
//       )
//       .returning({ id: purchaseItems.id });

//     // 3. One batch per purchase item — 1:1, as designed.
//     const insertedBatches = await db
//       .insert(batches)
//       .values(
//         input.items.map((item) => ({
//           organizationId,
//           productId: item.productId,
//           supplierId: item.batch.supplierId ?? input.supplierId,
//           batchNumber: item.batch.batchNumber,
//           manufacturingDate: item.batch.manufacturingDate,
//           expiryDate: item.batch.expiryDate,
//           purchasePrice: item.purchaseRate.toFixed(2),
//           mrp: (item.batch.mrp ?? 0).toFixed(2),
//           salePrice:
//             item.batch.salePrice !== undefined
//               ? item.batch.salePrice.toFixed(2)
//               : null,
//           quantityReceived: item.batch.quantity,
//           quantityAvailable: item.batch.quantity,
//           status: "ACTIVE" as const,
//         })),
//       )
//       .returning({ id: batches.id });

//     // 4. Link each purchase_item back to the batch it created.
//     await Promise.all(
//       insertedItems.map((pi, i) =>
//         db
//           .update(purchaseItems)
//           .set({ batchId: insertedBatches[i].id })
//           .where(eq(purchaseItems.id, pi.id)),
//       ),
//     );

//     // 5. Increase stockQuantity per product — sum quantities per productId
//     // first, since one purchase can have multiple lines for the same product
//     // (different batches), and we want one UPDATE per product, not one per line.
//     const quantityByProduct = new Map<string, number>();
//     for (const item of input.items) {
//       quantityByProduct.set(
//         item.productId,
//         (quantityByProduct.get(item.productId) ?? 0) + item.batch.quantity,
//       );
//     }

//     await Promise.all(
//       Array.from(quantityByProduct.entries()).map(([productId, qty]) =>
//         db
//           .update(products)
//           .set({
//             stockQuantity: sql`${products.stockQuantity} + ${qty}`,
//             updatedAt: new Date(),
//           })
//           .where(eq(products.id, productId)),
//       ),
//     );
//     //6 insert into expenses

//     const { description, note } = buildPurchaseExpenseText(input, productRows);

//     // . Write the linked "Inventory" expense row.
//     await db.insert(expenses).values({
//       organizationId,
//       categoryId: inventoryCategory.id,
//       description,
//       note,
//       amount: totals.grandTotal.toFixed(2),
//       expenseDate: input.purchaseDate,
//       createdByUserId: userId,
//     });

//     // 7. Invalidate caches for everything this purchase just changed.
//     await Promise.all([
//       invalidateCache(`products:list:${organizationId}`),
//       ...Array.from(quantityByProduct.keys()).map((productId) =>
//         invalidateCache(`products:one:${organizationId}:${productId}`),
//       ),
//     ]);

//     return { purchaseId: purchase.id, totals };
//   } catch (error) {
//     await db.delete(purchases).where(eq(purchases.id, purchase.id));
//     throw error;
//   }
// }

// delete a purchase and all its items, batches, and stockQuantity changes
export async function createPurchase(
  organizationId: string,
  userId: string,
  input: CreatePurchaseInput,
) {
  const totals = calculatePurchaseTotals(input);

  // 1. Create the purchase header first — items/batches need its id.
  const [purchase] = await db
    .insert(purchases)
    .values({
      organizationId,
      supplierId: input.supplierId,
      supplierInvoiceNumber: input.supplierInvoiceNumber,
      purchaseDate: input.purchaseDate,
      purcType: input.purcType,
      paymentType: input.paymentType,
      subtotal: totals.subtotal.toFixed(2),
      discount: input.discount.toFixed(2),
      roundingDirection: input.roundingDirection,
      freightCharges: input.freightCharges.toFixed(2),
      vatAmount: totals.vatAmount.toFixed(2),
      vatRefund: input.vatRefund.toFixed(2),
      grandTotal: totals.grandTotal.toFixed(2),
      createdByUserId: userId,
    })
    .returning({ id: purchases.id });

  if (!purchase) {
    throw new Error("Failed to create purchase");
  }
  try {
    // 2. Insert purchase_items, build the expense text (fetches its own
    // product names internally), and get/create the Inventory category —
    // none of these three depend on each other's results, so run them
    // in parallel rather than one after another.
    const [insertedItems, { description, note }, inventoryCategory] =
      await Promise.all([
        db
          .insert(purchaseItems)
          .values(
            input.items.map((item, i) => ({
              purchaseId: purchase.id,
              productId: item.productId,
              batchNumber: item.batch.batchNumber,
              manufacturingDate: item.batch.manufacturingDate,
              expiryDate: item.batch.expiryDate,
              quantity: item.batch.quantity,
              purchaseRate: item.purchaseRate.toFixed(2),
              mrp: (item.batch.mrp ?? 0).toFixed(2),
              vatApplicable: item.vatApplicable,
              lineTotal: totals.lineTotals[i].toFixed(2),
            })),
          )
          .returning({ id: purchaseItems.id }),
        buildPurchaseExpenseText(input),
        getOrCreateInventoryCategory(organizationId), // cached — usually a Redis hit, not a DB call
      ]);
    // 3. One batch per purchase item — 1:1, as designed.
    const insertedBatches = await db
      .insert(batches)
      .values(
        input.items.map((item) => ({
          organizationId,
          productId: item.productId,
          supplierId: item.batch.supplierId ?? input.supplierId,
          batchNumber: item.batch.batchNumber,
          manufacturingDate: item.batch.manufacturingDate,
          expiryDate: item.batch.expiryDate,
          purchasePrice: item.purchaseRate.toFixed(2),
          mrp: (item.batch.mrp ?? 0).toFixed(2),
          salePrice:
            item.batch.salePrice !== undefined
              ? item.batch.salePrice.toFixed(2)
              : null,
          quantityReceived: item.batch.quantity,
          quantityAvailable: item.batch.quantity,
          status: "ACTIVE" as const,
          note: item.batch.note ?? null,
        })),
      )
      .returning({ id: batches.id });
    // 4. Link each purchase_item back to the batch it created.
    await Promise.all(
      insertedItems.map((pi: any, i: any) =>
        db
          .update(purchaseItems)
          .set({ batchId: insertedBatches[i].id })
          .where(eq(purchaseItems.id, pi.id)),
      ),
    );

    // 5. Increase stockQuantity per product.
    const quantityByProduct = new Map<string, number>();
    for (const item of input.items) {
      quantityByProduct.set(
        item.productId,
        (quantityByProduct.get(item.productId) ?? 0) + item.batch.quantity,
      );
    }

    await Promise.all(
      Array.from(quantityByProduct.entries()).map(([productId, qty]) =>
        db
          .update(products)
          .set({
            stockQuantity: sql`${products.stockQuantity} + ${qty}`,
            updatedAt: new Date(),
          })
          .where(eq(products.id, productId)),
      ),
    );

    // 6. Write the linked "Inventory" expense row, using the description/note
    // already built back in step 2.
    await db.insert(expenses).values({
      organizationId,
      categoryId: inventoryCategory.id,
      description,
      note,
      amount: totals.grandTotal.toFixed(2),
      expenseDate: input.purchaseDate,
      createdByUserId: userId,
    });

    // 7. Invalidate caches for everything this purchase just changed.
    await Promise.all([
      invalidateCache(`products:list:${organizationId}`),
      ...Array.from(quantityByProduct.keys()).map((productId) =>
        invalidateCache(`products:one:${organizationId}:${productId}`),
      ),
    ]);

    return { purchaseId: purchase.id, totals };
  } catch (error) {
    await db.delete(purchases).where(eq(purchases.id, purchase.id));
    throw error;
  }
}

export async function deletePurchase(
  organizationId: string,
  purchaseId: string,
) {
  const purchase = await db.query.purchases.findFirst({
    where: and(
      eq(purchases.id, purchaseId),
      eq(purchases.organizationId, organizationId),
    ),
    columns: { id: true },
    with: {
      items: {
        columns: { id: true, productId: true, quantity: true, batchId: true },
      },
    },
  });

  if (!purchase) {
    throw new Error("Purchase not found");
  }

  const batchIds = purchase.items
    .map((item) => item.batchId)
    .filter((id): id is string => !!id);

  if (batchIds.length > 0) {
    const relatedBatches = await db.query.batches.findMany({
      where: inArray(batches.id, batchIds),
      columns: { id: true, quantityReceived: true, quantityAvailable: true },
    });

    // Block if any batch from this purchase has already been sold/used.
    const usedBatch = relatedBatches.find(
      (b) => b.quantityAvailable < b.quantityReceived,
    );
    if (usedBatch) {
      throw new Error(
        "Cannot delete this purchase — stock from one of its batches has already been sold or moved",
      );
    }
  }
  const quantityByProduct = new Map<string, number>();
  for (const item of purchase.items) {
    quantityByProduct.set(
      item.productId,
      (quantityByProduct.get(item.productId) ?? 0) + item.quantity,
    );
  }

  await Promise.all(
    Array.from(quantityByProduct.entries()).map(([productId, qty]) =>
      db
        .update(products)
        .set({
          stockQuantity: sql`${products.stockQuantity} - ${qty}`,
          updatedAt: new Date(),
        })
        .where(eq(products.id, productId)),
    ),
  );
  if (batchIds.length > 0) {
    await db.delete(batches).where(inArray(batches.id, batchIds));
  }

  await db.delete(purchases).where(eq(purchases.id, purchaseId));

  await Promise.all([
    invalidateCache(`products:list:${organizationId}`),
    ...Array.from(quantityByProduct.keys()).map((productId) =>
      invalidateCache(`products:one:${organizationId}:${productId}`),
    ),
  ]);

  return { success: true };
}
// update a purchase and its items, batches, and stockQuantity changes
export async function updatePurchase(
  organizationId: string,
  purchaseId: string,
  input: UpdatePurchaseInput,
) {
  const existingPurchase = await db.query.purchases.findFirst({
    where: and(
      eq(purchases.id, purchaseId),
      eq(purchases.organizationId, organizationId),
    ),
    columns: { id: true },
    with: {
      items: {
        columns: { id: true, productId: true, quantity: true, batchId: true },
      },
    },
  });

  if (!existingPurchase) {
    throw new Error("Purchase not found");
  }
  const existingItemIds = new Set(existingPurchase.items.map((i) => i.id));
  const incomingItemIds = new Set(
    input.items.filter((i) => i.purchaseItemId).map((i) => i.purchaseItemId!),
  );
  // Lines present before but missing now = removed by the user.
  const removedItems = existingPurchase.items.filter(
    (i) => !incomingItemIds.has(i.id),
  );

  // Guard: don't let a removal or a quantity reduction touch a batch that's
  // already been partially sold.
  const touchedBatchIds = [
    ...removedItems.map((i) => i.batchId),
    ...input.items
      .filter((i) => i.purchaseItemId)
      .map(
        (i) =>
          existingPurchase.items.find((e) => e.id === i.purchaseItemId)
            ?.batchId,
      ),
  ].filter((id): id is string => !!id);
  if (touchedBatchIds.length > 0) {
    const relatedBatches = await db.query.batches.findMany({
      where: inArray(batches.id, touchedBatchIds),
      columns: { id: true, quantityReceived: true, quantityAvailable: true },
    });

    for (const item of input.items) {
      if (!item.purchaseItemId) continue;
      const existingItem = existingPurchase.items.find(
        (e) => e.id === item.purchaseItemId,
      );
      if (!existingItem?.batchId) continue;
      const batch = relatedBatches.find((b) => b.id === existingItem.batchId);
      if (!batch) continue;

      const soldSoFar = batch.quantityReceived - batch.quantityAvailable;
      if (item.batch.quantity < soldSoFar) {
        throw new Error(
          `Cannot reduce quantity below ${soldSoFar} units — that much has already been sold from this batch`,
        );
      }
    }
    for (const removed of removedItems) {
      const batch = relatedBatches.find((b) => b.id === removed.batchId);
      if (batch && batch.quantityAvailable < batch.quantityReceived) {
        throw new Error(
          "Cannot remove a line whose batch has already been sold from",
        );
      }
    }
  }

  const totals = calculatePurchaseTotals(input as any); // same calculation, update schema is shape-compatible

  const quantityDeltaByProduct = new Map<string, number>();
  try {
    // 1. Update the purchase header.
    await db
      .update(purchases)
      .set({
        supplierId: input.supplierId,
        supplierInvoiceNumber: input.supplierInvoiceNumber,
        purchaseDate: input.purchaseDate,
        purcType: input.purcType,
        subtotal: totals.subtotal.toFixed(2),
        roundingDirection: input.roundingDirection,
        discount: input.discount.toFixed(2),
        freightCharges: input.freightCharges.toFixed(2),
        vatAmount: totals.vatAmount.toFixed(2),
        vatRefund: input.vatRefund.toFixed(2),
        grandTotal: totals.grandTotal.toFixed(2),
      })
      .where(eq(purchases.id, purchaseId));

    // 2. Handle removed lines: reverse their batch + stock, then delete.
    for (const removed of removedItems) {
      if (removed.batchId) {
        await db.delete(batches).where(eq(batches.id, removed.batchId));
      }
      quantityDeltaByProduct.set(
        removed.productId,
        (quantityDeltaByProduct.get(removed.productId) ?? 0) - removed.quantity,
      );
    }
    if (removedItems.length > 0) {
      await db.delete(purchaseItems).where(
        inArray(
          purchaseItems.id,
          removedItems.map((i) => i.id),
        ),
      );
    }
    // 3. Handle existing lines: update purchase_item + its batch, track the delta.
    for (const [i, item] of input.items.entries()) {
      if (!item.purchaseItemId) continue;

      const existingItem = existingPurchase.items.find(
        (e) => e.id === item.purchaseItemId,
      )!;
      const delta = item.batch.quantity - existingItem.quantity;
      quantityDeltaByProduct.set(
        item.productId,
        (quantityDeltaByProduct.get(item.productId) ?? 0) + delta,
      );
      await db
        .update(purchaseItems)
        .set({
          productId: item.productId,
          batchNumber: item.batch.batchNumber,
          manufacturingDate: item.batch.manufacturingDate,
          expiryDate: item.batch.expiryDate,
          quantity: item.batch.quantity,
          purchaseRate: item.purchaseRate.toFixed(2),
          mrp: (item.batch.mrp ?? 0).toFixed(2),
          vatApplicable: item.vatApplicable,
          lineTotal: totals.lineTotals[i].toFixed(2),
        })
        .where(eq(purchaseItems.id, item.purchaseItemId));
      if (existingItem.batchId) {
        await db
          .update(batches)
          .set({
            batchNumber: item.batch.batchNumber,
            manufacturingDate: item.batch.manufacturingDate,
            expiryDate: item.batch.expiryDate,
            purchasePrice: item.purchaseRate.toFixed(2),
            mrp: (item.batch.mrp ?? 0).toFixed(2),
            salePrice:
              item.batch.salePrice !== undefined
                ? item.batch.salePrice.toFixed(2)
                : null,
            note: item.batch.note ?? null,
            quantityReceived: item.batch.quantity,
            quantityAvailable: sql`${batches.quantityAvailable} + ${delta}`,
            updatedAt: new Date(),
          })
          .where(eq(batches.id, existingItem.batchId));
      }
    }
    // 4. Handle new lines (no purchaseItemId): insert item + batch, same as create.
    const newItems = input.items.filter((i) => !i.purchaseItemId);
    if (newItems.length > 0) {
      const newLineTotals = newItems.map((item) => {
        const idx = input.items.indexOf(item);
        return totals.lineTotals[idx];
      });

      const insertedItems = await db
        .insert(purchaseItems)
        .values(
          newItems.map((item, i) => ({
            purchaseId,
            productId: item.productId,
            batchNumber: item.batch.batchNumber,
            manufacturingDate: item.batch.manufacturingDate,
            expiryDate: item.batch.expiryDate,
            quantity: item.batch.quantity,
            purchaseRate: item.purchaseRate.toFixed(2),
            mrp: (item.batch.mrp ?? 0).toFixed(2),
            vatApplicable: item.vatApplicable,
            lineTotal: newLineTotals[i].toFixed(2),
          })),
        )
        .returning({ id: purchaseItems.id });
      const insertedBatches = await db
        .insert(batches)
        .values(
          newItems.map((item) => ({
            organizationId,
            productId: item.productId,
            supplierId: item.batch.supplierId ?? input.supplierId,
            batchNumber: item.batch.batchNumber,
            manufacturingDate: item.batch.manufacturingDate,
            expiryDate: item.batch.expiryDate,
            purchasePrice: item.purchaseRate.toFixed(2),
            mrp: (item.batch.mrp ?? 0).toFixed(2),
            salePrice:
              item.batch.salePrice !== undefined
                ? item.batch.salePrice.toFixed(2)
                : null,
            quantityReceived: item.batch.quantity,
            quantityAvailable: item.batch.quantity,
            status: "ACTIVE" as const,
          })),
        )
        .returning({ id: batches.id });

      await Promise.all(
        insertedItems.map((pi, i) =>
          db
            .update(purchaseItems)
            .set({ batchId: insertedBatches[i].id })
            .where(eq(purchaseItems.id, pi.id)),
        ),
      );
      for (const item of newItems) {
        quantityDeltaByProduct.set(
          item.productId,
          (quantityDeltaByProduct.get(item.productId) ?? 0) +
            item.batch.quantity,
        );
      }
    }

    // 5. Apply the net stock delta per product (could be positive or negative).
    await Promise.all(
      Array.from(quantityDeltaByProduct.entries())
        .filter(([, delta]) => delta !== 0)
        .map(([productId, delta]) =>
          db
            .update(products)
            .set({
              stockQuantity: sql`${products.stockQuantity} + ${delta}`,
              updatedAt: new Date(),
            })
            .where(eq(products.id, productId)),
        ),
    );
    await Promise.all([
      invalidateCache(`products:list:${organizationId}`),
      ...Array.from(quantityDeltaByProduct.keys()).map((productId) =>
        invalidateCache(`products:one:${organizationId}:${productId}`),
      ),
    ]);

    return { purchaseId, totals };
  } catch (error) {
    console.error("updatePurchase failed partway through:", error);
    throw error;
  }
}
