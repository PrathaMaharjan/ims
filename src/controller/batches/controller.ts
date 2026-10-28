import { db } from "@/db";
import {
  batches,
  parties,
  products,
  purchaseReturns,
  stockWriteOffs,
} from "@/db/schema";
import { invalidateCache } from "@/lib/cache";
import { UpdateBatchInput } from "@/lib/validation/batches";
import { and, asc, eq, exists, gt, or, SQL, sql } from "drizzle-orm";

function visibleOnExpiryScreen(): SQL | undefined {
  return or(
    gt(batches.quantityAvailable, 0),
    exists(
      db
        .select({ one: sql`1` })
        .from(purchaseReturns)
        .where(eq(purchaseReturns.batchId, batches.id)),
    ),
    exists(
      db
        .select({ one: sql`1` })
        .from(stockWriteOffs)
        .where(eq(stockWriteOffs.batchId, batches.id)),
    ),
  );
}
//comment

const batchColumns = {
  id: true,
  batchNumber: true,
  manufacturingDate: true,
  expiryDate: true,
  purchasePrice: true,
  mrp: true,
  salePrice: true,
  quantityReceived: true,
  quantityAvailable: true,
  status: true,
  note: true,
  partyId: true,
  createdAt: true,
} as const;

const DEFAULT_NEAR_EXPIRY_DAYS = 90;

function daysUntil(expiryDate?: string | null): number {
  if (!expiryDate) return 999999;
  const [y, m, d] = expiryDate.split("-").map(Number);
  const expiry = Date.UTC(y, m - 1, d);

  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.round((expiry - today) / 86_400_000);
}

export async function listBatchesForProduct(
  organizationId: string,
  productId: string,
  withinDays: number = DEFAULT_NEAR_EXPIRY_DAYS,
) {
  // Confirm the product actually belongs to this org before returning its batches —
  // prevents one tenant fetching another tenant's batches via a guessed productId.
  const product = await db.query.products.findFirst({
    where: and(
      eq(products.id, productId),
      eq(products.organizationId, organizationId),
    ),
    columns: { id: true, name: true, unit: true },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  const rows = await db.query.batches.findMany({
    where: and(
      eq(batches.organizationId, organizationId),
      eq(batches.productId, productId),
    ),
    columns: batchColumns,
    with: {
      party: { columns: { id: true, name: true } },
    },
    orderBy: (table: any, { asc }: any) => [asc(table.expiryDate)], // FEFO order — soonest expiry first
  });


  const withStatus = rows.map((b) => {
    const daysLeft = b.expiryDate ? daysUntil(b.expiryDate) : null;
    const status: "EXPIRED" | "NEAR_EXPIRY" | "ACTIVE" =
      !b.expiryDate
        ? "ACTIVE"
        : (daysLeft ?? 0) < 0
          ? "EXPIRED"
          : (daysLeft ?? 0) <= withinDays
            ? "NEAR_EXPIRY"
            : "ACTIVE";
    return { ...b, status, daysLeft };
  });

  const totalStock = withStatus.reduce(
    (sum: number, b: any) => (b.status === "EXPIRED" ? sum : sum + b.quantityAvailable),
    0,
  );

  return {
    product: { id: product.id, name: product.name, unit: product.unit },
    batches: withStatus,
    totalBatches: withStatus.length,
    totalStock,
  };
}

export type ExpiryStatus = "EXPIRED" | "NEAR_EXPIRY" | "ACTIVE";

function expiryStatusSql(withinDays: number): SQL<ExpiryStatus> {
  return sql<ExpiryStatus>`
    CASE
      WHEN ${batches.expiryDate} IS NULL THEN 'ACTIVE'
      WHEN ${batches.expiryDate} < CURRENT_DATE THEN 'EXPIRED'
      WHEN ${batches.expiryDate} <= CURRENT_DATE + ${withinDays}::int THEN 'NEAR_EXPIRY'
      ELSE 'ACTIVE'
    END`;
}

function statusFilter(status: string, withinDays: number): SQL | undefined {
  switch (status) {
    case "expired":
      return sql`${batches.expiryDate} IS NOT NULL AND ${batches.expiryDate} < CURRENT_DATE`;
    case "near":
      return sql`${batches.expiryDate} IS NOT NULL AND ${batches.expiryDate} >= CURRENT_DATE
        AND ${batches.expiryDate} <= CURRENT_DATE + ${withinDays}::int`;
    case "ok":
      return sql`${batches.expiryDate} IS NULL OR ${batches.expiryDate} > CURRENT_DATE + ${withinDays}::int`;
    default:
      return undefined; // "all"
  }
}

export interface ExpiryBatchRow {
  batchId: string;
  batchNumber: string;
  productId: string;
  productName: string;
  unit: string;
  partyName: string | null;
  manufacturingDate: string | null;
  expiryDate: string | null; // "2026-10-12" or null
  daysLeft: number | null; // negative once expired, null if no expiry date
  quantityAvailable: number;
  purchasePrice: number;
  valueAtRisk: number; // quantityAvailable * purchasePrice — what a write-off costs
  status: ExpiryStatus;
  note: string | null;
}

export interface ExpiryBatchesResult {
  batches: ExpiryBatchRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ExpiryBatchesParams {
  status: string;
  withinDays: number;
  page: number;
  limit: number;
}
// get expire batches list
export async function getExpiringBatches(
  organizationId: string,
  { status, withinDays, page, limit }: ExpiryBatchesParams,
): Promise<ExpiryBatchesResult> {
  const where = and(
    eq(batches.organizationId, organizationId),
    visibleOnExpiryScreen(),
    statusFilter(status, withinDays),
  );
  const [rows, countRows] = await Promise.all([
    db
      .select({
        batchId: batches.id,
        batchNumber: batches.batchNumber,
        productId: batches.productId,
        productName: products.name,
        unit: products.unit,
        partyName: parties.name,
        manufacturingDate: batches.manufacturingDate,
        expiryDate: batches.expiryDate,
        daysLeft: sql<number>`(${batches.expiryDate} - CURRENT_DATE)::int`,
        quantityAvailable: batches.quantityAvailable,
        purchasePrice: batches.purchasePrice,
        valueAtRisk: sql<string>`(${batches.quantityAvailable} * ${batches.purchasePrice})`,
        status: expiryStatusSql(withinDays),
        note: batches.note,
      })
      .from(batches)
      .innerJoin(products, eq(batches.productId, products.id))
      .leftJoin(parties, eq(batches.partyId, parties.id))
      .where(where)
      .orderBy(asc(batches.expiryDate), asc(batches.batchNumber))
      .limit(limit)
      .offset((page - 1) * limit),

    db
      .select({ total: sql<string>`count(*)` })
      .from(batches)
      .where(where),
  ]);

  const total = Number(countRows[0]?.total ?? 0);

  return {
    batches: rows.map((r: any) => ({
      ...r,
      purchasePrice: Number(r.purchasePrice),
      valueAtRisk: Number(r.valueAtRisk),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

// slaes garud
export class BatchNotSellableError extends Error {
  constructor(
    message: string,
    readonly batchId: string,
    readonly reason:
      | "EXPIRED"
      | "NOT_FOUND"
      | "INSUFFICIENT_STOCK"
      | "WRONG_PRODUCT",
  ) {
    super(message);
    this.name = "BatchNotSellableError";
  }
}

export async function assertBatchSellable(
  organizationId: string,
  productId: string,
  batchId: string,
  quantity: number,
): Promise<void> {
  const [batch] = await db
    .select({
      id: batches.id,
      productId: batches.productId,
      batchNumber: batches.batchNumber,
      quantityAvailable: batches.quantityAvailable,
      isExpired: sql<boolean>`${batches.expiryDate} IS NOT NULL AND ${batches.expiryDate} < CURRENT_DATE`,
    })
    .from(batches)
    .where(
      and(eq(batches.id, batchId), eq(batches.organizationId, organizationId)),
    );

  if (!batch) {
    throw new BatchNotSellableError("Batch not found", batchId, "NOT_FOUND");
  }

  // Guards against the batch belonging to a different product than the line
  // says — otherwise batch stock and product stock drift apart.
  if (batch.productId !== productId) {
    throw new BatchNotSellableError(
      `Batch ${batch.batchNumber} does not belong to the selected product`,
      batchId,
      "WRONG_PRODUCT",
    );
  }

  if (batch.isExpired) {
    throw new BatchNotSellableError(
      `Batch ${batch.batchNumber} has expired and cannot be sold`,
      batchId,
      "EXPIRED",
    );
  }

  if (batch.quantityAvailable < quantity) {
    throw new BatchNotSellableError(
      `Batch ${batch.batchNumber} has only ${batch.quantityAvailable} left`,
      batchId,
      "INSUFFICIENT_STOCK",
    );
  }
}

// expire summary
export interface ExpirySummary {
  expired: { count: number; value: number };
  nearExpiry: { count: number; value: number };
  withinDays: number;
}

export async function getExpirySummary(
  organizationId: string,
  withinDays: number,
): Promise<ExpirySummary> {
  const value = sql`${batches.quantityAvailable} * ${batches.purchasePrice}`;

  const [row] = await db
    .select({
      expiredCount: sql<string>`count(*) filter (where ${batches.expiryDate} IS NOT NULL AND ${batches.expiryDate} < CURRENT_DATE)`,
      expiredValue: sql<string>`coalesce(sum(${value}) filter (where ${batches.expiryDate} IS NOT NULL AND ${batches.expiryDate} < CURRENT_DATE), 0)`,

      nearCount: sql<string>`count(*) filter (where ${batches.expiryDate} IS NOT NULL AND ${batches.expiryDate} >= CURRENT_DATE AND ${batches.expiryDate} <= CURRENT_DATE + ${withinDays}::int)`,
      nearValue: sql<string>`coalesce(sum(${value}) filter (where ${batches.expiryDate} IS NOT NULL AND ${batches.expiryDate} >= CURRENT_DATE AND ${batches.expiryDate} <= CURRENT_DATE + ${withinDays}::int), 0)`,
    })
    .from(batches)
    .where(
      and(eq(batches.organizationId, organizationId), visibleOnExpiryScreen()),
    );
  return {
    expired: {
      count: Number(row?.expiredCount ?? 0),
      value: Number(row?.expiredValue ?? 0),
    },
    nearExpiry: {
      count: Number(row?.nearCount ?? 0),
      value: Number(row?.nearValue ?? 0),
    },
    withinDays,
  };
}

// update
export class BatchUpdateError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BatchUpdateError";
  }
}

export async function updateBatch(
  organizationId: string,
  batchId: string,
  input: UpdateBatchInput,
) {
  // Scoped by org so one tenant can't edit another tenant's batch via a guessed id.
  const existing = await db.query.batches.findFirst({
    where: and(
      eq(batches.id, batchId),
      eq(batches.organizationId, organizationId),
    ),
    columns: {
      id: true,
      productId: true,
      quantityReceived: true,
      quantityAvailable: true,
      manufacturingDate: true,
      expiryDate: true,
    },
  });
  if (!existing) {
    throw new BatchUpdateError("Batch not found", 404);
  }

  // Available can't exceed received — purchase edits derive "sold so far"
  // as received - available, which would go negative otherwise.
  if (
    input.quantityAvailable !== undefined &&
    input.quantityAvailable > existing.quantityReceived
  ) {
    throw new BatchUpdateError(
      `Available stock cannot exceed quantity received (${existing.quantityReceived})`,
      400,
    );
  }
  const mfg =
    input.manufacturingDate !== undefined
      ? input.manufacturingDate
      : existing.manufacturingDate;
  const exp =
    input.expiryDate !== undefined
      ? input.expiryDate
      : existing.expiryDate;
  if (mfg && exp && mfg > exp) {
    throw new BatchUpdateError(
      "Expiry date must be after manufacturing date",
      400,
    );
  }

  const updates: Partial<typeof batches.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.batchNumber !== undefined) updates.batchNumber = input.batchNumber;
  if (input.expiryDate !== undefined) updates.expiryDate = input.expiryDate;
  if (input.manufacturingDate !== undefined)
    updates.manufacturingDate = input.manufacturingDate;
  if (input.quantityAvailable !== undefined)
    updates.quantityAvailable = input.quantityAvailable;
  if (input.purchasePrice !== undefined)
    updates.purchasePrice = input.purchasePrice.toFixed(2);
  if (input.mrp !== undefined) updates.mrp = input.mrp.toFixed(2);
  if (input.salePrice !== undefined)
    updates.salePrice =
      input.salePrice === null ? null : input.salePrice.toFixed(2);
  if (input.note !== undefined) updates.note = input.note;

  const delta =
    input.quantityAvailable !== undefined
      ? input.quantityAvailable - existing.quantityAvailable
      : 0;

  // Both stock changes must commit together.
  const updated = await db.transaction(async (tx: any) => {
    const [updatedBatch] = await tx
      .update(batches)
      .set(updates)
      .where(
        and(eq(batches.id, batchId), eq(batches.organizationId, organizationId)),
      )
      .returning();

    if (!updatedBatch) {
      throw new BatchUpdateError("Batch not found", 404);
    }

    if (delta !== 0) {
      const [updatedProduct] = await tx
        .update(products)
        .set({ stockQuantity: sql`${products.stockQuantity} + ${delta}` })
        .where(
          and(
            eq(products.id, existing.productId),
            eq(products.organizationId, organizationId),
          ),
        )
        .returning({ id: products.id });

      if (!updatedProduct) {
        throw new Error("Product not found");
      }
    }

    return updatedBatch;
  });

  // Product list/detail are cached with batch-derived stock totals.
  await Promise.all([
    invalidateCache(`products:list:${organizationId}`),
    invalidateCache(`products:one:${organizationId}:${existing.productId}`),
  ]);

  return updated;
}
