import { CreateSaleInput, UpdateSaleInput } from "@/lib/validation/sales";
import { calculateSaleTotals, validateBatchSelection } from "../helper";
import { db } from "@/db";
import { batches, organizations, products, saleItems, sales } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { invalidateCache } from "@/lib/cache";

export async function createSale(
  organizationId: string,
  userId: string,
  input: CreateSaleInput
) {
  const totals = calculateSaleTotals(input);

  // 1. Validate every line's manually-selected batch has enough stock —
  // before writing anything. No FEFO fallback, no auto-picking; if the
  // chosen batch can't cover the quantity, the whole sale is rejected.
  for (const item of input.items) {
    await validateBatchSelection(organizationId, item.productId, item.batchId, item.quantity);
  }

  // 2. Reserve and atomically increment the organization's invoice number.
  const [org] = await db
    .update(organizations)
    .set({ nextInvoiceNumber: sql`${organizations.nextInvoiceNumber} + 1` })
    .where(eq(organizations.id, organizationId))
    .returning({ invoiceNumber: organizations.nextInvoiceNumber });

  if (!org) {
    throw new Error("Failed to reserve invoice number");
  }

  // The returned value is already incremented — this sale uses the number
  // from before the increment.
  const invoiceNumber = org.invoiceNumber - 1;

  // 3. Create the sale header.
  const [sale] = await db
    .insert(sales)
    .values({
      organizationId,
      invoiceNumber,
      customerId: input.customerId,
      saleDate: input.saleDate ? new Date(input.saleDate) : new Date(),
      paymentType: input.paymentType,
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
    // 4. Insert one sale_item row per line — direct 1:1 with the batch the
    // staff selected, no splitting across multiple batches.
    await db.insert(saleItems).values(
      input.items.map((item, i) => ({
        saleId: sale.id,
        productId: item.productId,
        batchId: item.batchId,
        quantity: item.quantity,
        salePrice: item.salePrice.toFixed(2),
        vatAmount: "0", // total VAT lives on the sale header, not split per line
        lineTotal: totals.lineTotals[i].toFixed(2),
      }))
    );

    // 5. Decrement quantityAvailable on each selected batch.
    await Promise.all(
      input.items.map((item) =>
        db
          .update(batches)
          .set({
            quantityAvailable: sql`${batches.quantityAvailable} - ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(batches.id, item.batchId))
      )
    );

    // 6. Decrease stockQuantity per product — sum quantities per productId
    // first, since a sale can have multiple lines for the same product
    // (different batches), so this issues one UPDATE per product, not per line.
    const quantityByProduct = new Map<string, number>();
    for (const item of input.items) {
      quantityByProduct.set(
        item.productId,
        (quantityByProduct.get(item.productId) ?? 0) + item.quantity
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
          .where(eq(products.id, productId))
      )
    );

    // 7. Invalidate caches for everything this sale touched.
    await Promise.all([
      invalidateCache(`products:list:${organizationId}`),
      ...Array.from(quantityByProduct.keys()).map((productId) =>
        invalidateCache(`products:one:${organizationId}:${productId}`)
      ),
    ]);

    return { saleId: sale.id, invoiceNumber, totals };
  } catch (error) {
    // Best-effort cleanup — same honest caveat as createPurchase: the Neon
    // HTTP driver has no true multi-statement rollback, so this deletes the
    // sale header if anything after it fails, but isn't a guaranteed atomic
    // rollback of every step above.
    await db.delete(sales).where(eq(sales.id, sale.id));
    throw error;
  }
}




export async function updateSale(
  organizationId: string,
  saleId: string,
  input: UpdateSaleInput
) {
  const existingSale = await db.query.sales.findFirst({
    where: and(eq(sales.id, saleId), eq(sales.organizationId, organizationId)),
    columns: { id: true },
    with: {
      items: { columns: { id: true, productId: true, batchId: true, quantity: true } },
    },
  });

  if (!existingSale) {
    throw new Error("Sale not found");
  }

  // Guard: reversing old stock must never push a batch's available quantity
  // above what it originally received — a sanity check before touching anything.
  const oldBatchIds = existingSale.items.map((item) => item.batchId);
  const oldBatches = await db.query.batches.findMany({
    where: inArray(batches.id, oldBatchIds),
    columns: { id: true, quantityReceived: true, quantityAvailable: true },
  });
  for (const item of existingSale.items) {
    const batch = oldBatches.find((b) => b.id === item.batchId);
    if (batch && batch.quantityAvailable + item.quantity > batch.quantityReceived) {
      throw new Error(
        "Cannot edit this sale — reversing its stock would push a batch above what it originally received"
      );
    }
  }

  const totals = calculateSaleTotals(input);

  try {
    // 1. Reverse the OLD allocation: give stock back to whichever batches
    // and products the original sale drew from.
    await Promise.all(
      existingSale.items.map((item) =>
        db
          .update(batches)
          .set({
            quantityAvailable: sql`${batches.quantityAvailable} + ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(batches.id, item.batchId))
      )
    );

    const oldQuantityByProduct = new Map<string, number>();
    for (const item of existingSale.items) {
      oldQuantityByProduct.set(
        item.productId,
        (oldQuantityByProduct.get(item.productId) ?? 0) + item.quantity
      );
    }
    await Promise.all(
      Array.from(oldQuantityByProduct.entries()).map(([productId, qty]) =>
        db
          .update(products)
          .set({ stockQuantity: sql`${products.stockQuantity} + ${qty}`, updatedAt: new Date() })
          .where(eq(products.id, productId))
      )
    );

    // 2. Validate every NEW line's chosen batch has enough stock — now that
    // the old stock has been given back, so a same-batch quantity change is
    // checked against its true available amount, not a stale pre-reversal figure.
    for (const item of input.items) {
      await validateBatchSelection(organizationId, item.productId, item.batchId, item.quantity);
    }

    // 3. Replace sale_items entirely with the new line set.
    await db.delete(saleItems).where(eq(saleItems.saleId, saleId));
    await db.insert(saleItems).values(
      input.items.map((item, i) => ({
        saleId,
        productId: item.productId,
        batchId: item.batchId,
        quantity: item.quantity,
        salePrice: item.salePrice.toFixed(2),
        vatAmount: "0",
        lineTotal: totals.lineTotals[i].toFixed(2),
      }))
    );

    // 4. Deduct the NEW quantities from whichever batches are now selected.
    await Promise.all(
      input.items.map((item) =>
        db
          .update(batches)
          .set({
            quantityAvailable: sql`${batches.quantityAvailable} - ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(batches.id, item.batchId))
      )
    );

    const newQuantityByProduct = new Map<string, number>();
    for (const item of input.items) {
      newQuantityByProduct.set(
        item.productId,
        (newQuantityByProduct.get(item.productId) ?? 0) + item.quantity
      );
    }
    await Promise.all(
      Array.from(newQuantityByProduct.entries()).map(([productId, qty]) =>
        db
          .update(products)
          .set({ stockQuantity: sql`${products.stockQuantity} - ${qty}`, updatedAt: new Date() })
          .where(eq(products.id, productId))
      )
    );

    // 5. Update the sale header with the new totals and fields.
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

    // 6. Invalidate caches for every product touched, on either the old or
    // new side of the change.
    const touchedProductIds = new Set([
      ...oldQuantityByProduct.keys(),
      ...newQuantityByProduct.keys(),
    ]);
    await Promise.all([
      invalidateCache(`products:list:${organizationId}`),
      ...Array.from(touchedProductIds).map((productId) =>
        invalidateCache(`products:one:${organizationId}:${productId}`)
      ),
    ]);

    return { saleId, totals };
  } catch (error) {
    console.error("updateSale failed partway through:", error);
    throw error;
  }
}