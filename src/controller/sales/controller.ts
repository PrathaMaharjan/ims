import { db } from "@/db";
import { allocateFefo, calculateSaleTotals } from "./helper";
import {
  batches,
  organizations,
  products,
  saleItems,
  sales,
} from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { CreateSaleInput, updateSaleInput } from "@/lib/validation/sales";
import { invalidateCache } from "@/lib/cache";

export async function createSale(
  organizationId: string,
  userId: string,
  input: CreateSaleInput,
) {
  const totals = calculateSaleTotals(input);
  // 1. Allocate FEFO batches for every line item up front — before writing
  // anything — so an insufficient-stock error never leaves a half-created sale.
  const allocationsByItem: Array<{
    item: (typeof input.items)[number];
    allocations: Awaited<ReturnType<typeof allocateFefo>>;
  }> = [];

  for (const item of input.items) {
    const allocations = await allocateFefo(
      organizationId,
      item.productId,
      item.quantity,
    );
    allocationsByItem.push({ item, allocations });
  }
  // 2. Reserve and increment the organization's invoice number atomically.
  const [org] = await db
    .update(organizations)
    .set({ nextInvoiceNumber: sql`${organizations.nextInvoiceNumber} + 1` })
    .where(eq(organizations.id, organizationId))
    .returning({ invoiceNumber: organizations.nextInvoiceNumber });

  if (!org) {
    throw new Error("Failed to reserve invoice number");
  }

  // The returned value is already incremented — the invoice we're creating
  // uses the number *before* this increment, so subtract 1.
  const invoiceNumber = org.invoiceNumber - 1;

  // 3. Create the sale header.
  const [sale] = await db
    .insert(sales)
    .values({
      organizationId,
      invoiceNumber,
      customerId: input.customerId,
      saleDate: input.saleDate ? new Date(input.saleDate) : new Date(),
      roundingDirection: input.roundingDirection,
      subtotal: totals.subtotal.toFixed(2),
      discount: input.discount.toFixed(2),
      vatAmount: totals.vatAmount.toFixed(2),
      grandTotal: totals.grandTotal.toFixed(2),
      prescriptionNote: input.prescriptionNote,
      createdByUserId: userId,
    })
    .returning({ id: sales.id });

  if (!sale) {
    throw new Error("Failed to create sale");
  }
  try {
    // 4. Insert one sale_item row per (item, batch) allocation — a single
    // line item can span multiple sale_items if FEFO spilled across batches.
    const saleItemRows: Array<typeof saleItems.$inferInsert> = [];
    for (let i = 0; i < allocationsByItem.length; i++) {
      const { item, allocations } = allocationsByItem[i];
      for (const alloc of allocations) {
        const proportionalTotal = round2ForLine(
          item,
          alloc.quantity,
          totals.lineTotals[i],
        );
        saleItemRows.push({
          saleId: sale.id,
          productId: item.productId,
          batchId: alloc.batchId,
          quantity: alloc.quantity,
          salePrice: item.salePrice.toFixed(2),
          vatAmount: "0", // per-line VAT breakdown not split across FEFO splits; total VAT lives on the sale header
          lineTotal: proportionalTotal.toFixed(2),
        });
      }
    }
    await db.insert(saleItems).values(saleItemRows);

    // 5. Decrement quantityAvailable on every batch that was drawn from.
    const allAllocations = allocationsByItem.flatMap((a) => a.allocations);
    await Promise.all(
      allAllocations.map((alloc) =>
        db
          .update(batches)
          .set({
            quantityAvailable: sql`${batches.quantityAvailable} - ${alloc.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(batches.id, alloc.batchId)),
      ),
    );
    // 6. Decrease stockQuantity per product — summed per product first,
    // same pattern as createPurchase's increment.
    const quantityByProduct = new Map<string, number>();
    for (const item of input.items) {
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

    // 7. Invalidate caches for everything this sale touched.
    await Promise.all([
      invalidateCache(`products:list:${organizationId}`),
      ...Array.from(quantityByProduct.keys()).map((productId) =>
        invalidateCache(`products:one:${organizationId}:${productId}`),
      ),
    ]);

    return { saleId: sale.id, invoiceNumber, totals };
  } catch (error) {
    // Best-effort cleanup, same honest caveat as createPurchase: no true
    // multi-statement rollback with the Neon HTTP driver.
    await db.delete(sales).where(eq(sales.id, sale.id));
    throw error;
  }
}

function round2ForLine(
  item: { quantity: number; salePrice: number },
  allocQuantity: number,
  fullLineTotal: number,
): number {
  // Proportional share of the line's total for this specific batch split.
  return (
    Math.round(fullLineTotal * (allocQuantity / item.quantity) * 100) / 100
  );
}

// delete sales
export async function deleteSale(organizationId: string, saleId: string) {
  const sale = await db.query.sales.findFirst({
    where: and(eq(sales.id, saleId), eq(sales.organizationId, organizationId)),
    columns: { id: true },
    with: {
      items: {
        columns: { id: true, productId: true, batchId: true, quantity: true },
      },
    },
  });

  if (!sale) {
    throw new Error("Sale not found");
  }

  const batchIds = sale.items.map((item) => item.batchId);
  const relatedBatches = await db.query.batches.findMany({
    where: inArray(batches.id, batchIds),
    columns: { id: true, quantityReceived: true, quantityAvailable: true },
  });

  // Guard: giving stock back must never push a batch's available quantity
  // above what it originally received — that would signal something else
  // has already changed this batch inconsistently since the sale happened.
  for (const item of sale.items) {
    const batch = relatedBatches.find((b) => b.id === item.batchId);
    if (
      batch &&
      batch.quantityAvailable + item.quantity > batch.quantityReceived
    ) {
      throw new Error(
        "Cannot delete this sale — reversing it would push a batch's stock above what it originally received",
      );
    }
  }
  await Promise.all(
    sale.items.map((item) =>
      db
        .update(batches)
        .set({
          quantityAvailable: sql`${batches.quantityAvailable} + ${item.quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(batches.id, item.batchId)),
    ),
  );

  const quantityByProduct = new Map<string, number>();
  for (const item of sale.items) {
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
          stockQuantity: sql`${products.stockQuantity} + ${qty}`,
          updatedAt: new Date(),
        })
        .where(eq(products.id, productId)),
    ),
  );

  await db.delete(sales).where(eq(sales.id, saleId)); // sale_items cascade-delete via the FK

  await Promise.all([
    invalidateCache(`products:list:${organizationId}`),
    ...Array.from(quantityByProduct.keys()).map((productId) =>
      invalidateCache(`products:one:${organizationId}:${productId}`),
    ),
  ]);

  return { success: true };
}

// updated
export async function updateSale(
  organizationId: string,
  saleId: string,
  input: updateSaleInput,
) {
  const existingSale = await db.query.sales.findFirst({
    where: and(eq(sales.id, saleId), eq(sales.organizationId, organizationId)),
    columns: { id: true },
    with: {
      items: {
        columns: { id: true, productId: true, batchId: true, quantity: true },
      },
    },
  });

  if (!existingSale) {
    throw new Error("Sale not found");
  }

  // Guard against the same inconsistency check as delete, before touching anything.
  const oldBatchIds = existingSale.items.map((item) => item.batchId);
  const oldBatches = await db.query.batches.findMany({
    where: inArray(batches.id, oldBatchIds),
    columns: { id: true, quantityReceived: true, quantityAvailable: true },
  });

  for (const item of existingSale.items) {
    const batch = oldBatches.find((b) => b.id === item.batchId);
    if (
      batch &&
      batch.quantityAvailable + item.quantity > batch.quantityReceived
    ) {
      throw new Error(
        "Cannot edit this sale — reversing its stock would push a batch above what it originally received",
      );
    }
  }
  const totals = calculateSaleTotals(input);

  try {
    // 1. Reverse the old allocation: give stock back to the old batches and product totals.
    await Promise.all(
      existingSale.items.map((item) =>
        db
          .update(batches)
          .set({
            quantityAvailable: sql`${batches.quantityAvailable} + ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(batches.id, item.batchId)),
      ),
    );
    const oldQuantityByProduct = new Map<string, number>();
    for (const item of existingSale.items) {
      oldQuantityByProduct.set(
        item.productId,
        (oldQuantityByProduct.get(item.productId) ?? 0) + item.quantity,
      );
    }
    await Promise.all(
      Array.from(oldQuantityByProduct.entries()).map(([productId, qty]) =>
        db
          .update(products)
          .set({
            stockQuantity: sql`${products.stockQuantity} + ${qty}`,
            updatedAt: new Date(),
          })
          .where(eq(products.id, productId)),
      ),
    );
    // 2. Delete the old sale_items rows.
    await db.delete(saleItems).where(eq(saleItems.saleId, saleId));

    // 3. Re-run FEFO fresh, now that old stock has been given back — this
    // may allocate against entirely different batches than before.
    const allocationsByItem: Array<{
      item: (typeof input.items)[number];
      allocations: Awaited<ReturnType<typeof allocateFefo>>;
    }> = [];
    for (const item of input.items) {
      const allocations = await allocateFefo(
        organizationId,
        item.productId,
        item.quantity,
      );
      allocationsByItem.push({ item, allocations });
    }
    // 4. Insert the new sale_items rows.
    const saleItemRows: Array<typeof saleItems.$inferInsert> = [];
    for (let i = 0; i < allocationsByItem.length; i++) {
      const { item, allocations } = allocationsByItem[i];
      for (const alloc of allocations) {
        const proportionalTotal =
          Math.round(
            totals.lineTotals[i] * (alloc.quantity / item.quantity) * 100,
          ) / 100;
        saleItemRows.push({
          saleId,
          productId: item.productId,
          batchId: alloc.batchId,
          quantity: alloc.quantity,
          salePrice: item.salePrice.toFixed(2),
          vatAmount: "0",
          lineTotal: proportionalTotal.toFixed(2),
        });
      }
    }
    await db.insert(saleItems).values(saleItemRows);

    // 5. Deduct new stock: batches and product totals.
    const allAllocations = allocationsByItem.flatMap((a) => a.allocations);
    await Promise.all(
      allAllocations.map((alloc) =>
        db
          .update(batches)
          .set({
            quantityAvailable: sql`${batches.quantityAvailable} - ${alloc.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(batches.id, alloc.batchId)),
      ),
    );

    const newQuantityByProduct = new Map<string, number>();
    for (const item of input.items) {
      newQuantityByProduct.set(
        item.productId,
        (newQuantityByProduct.get(item.productId) ?? 0) + item.quantity,
      );
    }
    await Promise.all(
      Array.from(newQuantityByProduct.entries()).map(([productId, qty]) =>
        db
          .update(products)
          .set({
            stockQuantity: sql`${products.stockQuantity} - ${qty}`,
            updatedAt: new Date(),
          })
          .where(eq(products.id, productId)),
      ),
    );
    // 6. Update the sale header.
    await db
      .update(sales)
      .set({
        customerId: input.customerId,
        saleDate: input.saleDate ? new Date(input.saleDate) : undefined,
        paymentType: input.paymentType,
        roundingDirection: input.roundingDirection,
        subtotal: totals.subtotal.toFixed(2),
        discount: input.discount.toFixed(2),
        vatAmount: totals.vatAmount.toFixed(2),
        grandTotal: totals.grandTotal.toFixed(2),
        prescriptionNote: input.prescriptionNote,
      })
      .where(eq(sales.id, saleId));

    // 7. Invalidate caches for every product touched, on either side.
    const touchedProductIds = new Set([
      ...oldQuantityByProduct.keys(),
      ...newQuantityByProduct.keys(),
    ]);
    await Promise.all([
      invalidateCache(`products:list:${organizationId}`),
      ...Array.from(touchedProductIds).map((productId) =>
        invalidateCache(`products:one:${organizationId}:${productId}`),
      ),
    ]);

    return { saleId, totals };
  } catch (error) {
    console.error("updateSale failed partway through:", error);
    throw error;
  }
}

export async function getSaleStats(organizationId: string) {
  const [row] = await db
    .select({
      totalCount: sql<number>`count(*)`,
      totalRevenue: sql<string>`coalesce(sum(${sales.grandTotal}), 0)`,
      cashCount: sql<number>`count(*) filter (where ${sales.paymentType} = 'CASH')`,
      cashRevenue: sql<string>`coalesce(sum(${sales.grandTotal}) filter (where ${sales.paymentType} = 'CASH'), 0)`,
      creditCount: sql<number>`count(*) filter (where ${sales.paymentType} = 'CREDIT')`,
      creditRevenue: sql<string>`coalesce(sum(${sales.grandTotal}) filter (where ${sales.paymentType} = 'CREDIT'), 0)`,
    })
    .from(sales)
    .where(eq(sales.organizationId, organizationId));

  return {
    totalCount: Number(row?.totalCount ?? 0),
    totalRevenue: Number(row?.totalRevenue ?? 0),
    cashCount: Number(row?.cashCount ?? 0),
    cashRevenue: Number(row?.cashRevenue ?? 0),
    creditCount: Number(row?.creditCount ?? 0),
    creditRevenue: Number(row?.creditRevenue ?? 0),
  };
}