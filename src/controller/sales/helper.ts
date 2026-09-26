// calculate totals for sales 

import { db } from "@/db";
import { batches } from "@/db/schema";
import { CreateSaleInput } from "@/lib/validation/sales";
import { and, eq, gt } from "drizzle-orm";

export interface SaleTotals {
  subtotal: number;
  vatAmount: number;
  grandTotal: number;
  lineTotals: number[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateSaleTotals(input: CreateSaleInput): SaleTotals {
  const lineTotals = input.items.map((item) => round2(item.quantity * item.salePrice));
  const subtotal = round2(lineTotals.reduce((sum, t) => sum + t, 0));

  const vatableSubtotal = input.items.reduce(
    (sum, item, i) => (item.vatApplicable ? sum + lineTotals[i] : sum),
    0
  );
  const vatAmount = round2((vatableSubtotal * input.vatRate) / 100);

  const afterAdjustments = subtotal - input.discount + vatAmount;

  const grandTotal =
    input.roundingDirection === "UP" ? Math.ceil(afterAdjustments) : Math.floor(afterAdjustments);

  return { subtotal, vatAmount, grandTotal, lineTotals };
}

// FEFO PROCESS AND CALCULATION
export interface FefoAllocation {
  batchId: string;
  quantity: number;
}

export async function allocateFefo(
  organizationId: string,
  productId: string,
  quantityNeeded: number
): Promise<FefoAllocation[]> {
  const availableBatches = await db.query.batches.findMany({
    where: and(
      eq(batches.organizationId, organizationId),
      eq(batches.productId, productId),
      eq(batches.status, "ACTIVE"),
      gt(batches.quantityAvailable, 0)
    ),
    columns: { id: true, quantityAvailable: true },
    orderBy: (table, { asc }) => [asc(table.expiryDate)], // FEFO — soonest expiry first
  });

  const allocations: FefoAllocation[] = [];
  let remaining = quantityNeeded;

  for (const batch of availableBatches) {
    if (remaining <= 0) break;
    const takeFromThisBatch = Math.min(batch.quantityAvailable, remaining);
    allocations.push({ batchId: batch.id, quantity: takeFromThisBatch });
    remaining -= takeFromThisBatch;
  }

  if (remaining > 0) {
    throw new Error(
      `Insufficient stock: need ${quantityNeeded} units but only ${quantityNeeded - remaining} available`
    );
  }

  return allocations;
}


// Validates that the staff-selected batch belongs to this product/org, is
// active, and has enough stock. No FEFO fallback — if the chosen batch
// doesn't have enough, this throws; it never spills into a different batch.
export async function validateBatchSelection(
  organizationId: string,
  productId: string,
  batchId: string,
  quantity: number
): Promise<void> {
    console.log(batchId)
  const batch = await db.query.batches.findFirst({
    where: and(
      eq(batches.id, batchId),
      eq(batches.organizationId, organizationId),
      eq(batches.productId, productId),
      eq(batches.status, "ACTIVE")
    ),
    columns: { id: true, quantityAvailable: true, batchNumber: true },
  });

  if (!batch) {
    throw new Error("Selected batch is not available for this product");
  }

  if (batch.quantityAvailable < quantity) {
    throw new Error(
      `Insufficient stock in batch ${batch.batchNumber}: requested ${quantity}, only ${batch.quantityAvailable} available`
    );
  }
}