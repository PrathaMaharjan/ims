import { db } from "@/db";
import { batches, products, suppliers } from "@/db/schema";
import { and, asc, eq, gt, SQL, sql } from "drizzle-orm";

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
  supplierId: true,
  createdAt: true,
} as const;

const DEFAULT_NEAR_EXPIRY_DAYS = 15;

function daysUntil(expiryDate: string): number {
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
      supplier: { columns: { id: true, name: true } },
    },
    orderBy: (table, { asc }) => [asc(table.expiryDate)], // FEFO order — soonest expiry first
  });

  // Expiry status is derived here rather than trusted from the stored
  // `status` column — that column is written "ACTIVE" at purchase time and
  // nothing ever transitions it to EXPIRED, so relying on it silently
  // mislabels old stock as active. Same CASE logic as the expiry report,
  // so a batch never shows a different status on different screens.
  const withStatus = rows.map((b) => {
    const daysLeft = daysUntil(b.expiryDate);
    const status: "EXPIRED" | "NEAR_EXPIRY" | "ACTIVE" =
      daysLeft < 0
        ? "EXPIRED"
        : daysLeft <= withinDays
          ? "NEAR_EXPIRY"
          : "ACTIVE";
    return { ...b, status, daysLeft };
  });

  // Stock is still "available to sell" as long as it isn't expired — a
  // NEAR_EXPIRY batch is very much part of total stock, just flagged for
  // attention. Only EXPIRED (and depleted, quantityAvailable = 0) drop out.
  const totalStock = withStatus.reduce(
    (sum, b) => (b.status === "EXPIRED" ? sum : sum + b.quantityAvailable),
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
      WHEN ${batches.expiryDate} < CURRENT_DATE THEN 'EXPIRED'
      WHEN ${batches.expiryDate} <= CURRENT_DATE + ${withinDays}::int THEN 'NEAR_EXPIRY'
      ELSE 'ACTIVE'
    END`;
}

function statusFilter(status: string, withinDays: number): SQL | undefined {
  switch (status) {
    case "expired":
      return sql`${batches.expiryDate} < CURRENT_DATE`;
    case "near":
      return sql`${batches.expiryDate} >= CURRENT_DATE
        AND ${batches.expiryDate} <= CURRENT_DATE + ${withinDays}::int`;
    case "ok":
      return sql`${batches.expiryDate} > CURRENT_DATE + ${withinDays}::int`;
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
  supplierName: string | null;
  expiryDate: string; // "2026-10-12"
  daysLeft: number; // negative once expired
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
    gt(batches.quantityAvailable, 0),
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
        supplierName: suppliers.name,
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
      .leftJoin(suppliers, eq(batches.supplierId, suppliers.id))
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
    batches: rows.map((r) => ({
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
    readonly reason: "EXPIRED" | "NOT_FOUND" | "INSUFFICIENT_STOCK",
  ) {
    super(message);
    this.name = "BatchNotSellableError";
  }
}

export async function assertBatchSellable(
  tx: typeof db,
  organizationId: string,
  batchId: string,
  quantity: number,
): Promise<void> {
  const [batch] = await tx
    .select({
      id: batches.id,
      batchNumber: batches.batchNumber,
      quantityAvailable: batches.quantityAvailable,
      isExpired: sql<boolean>`${batches.expiryDate} < CURRENT_DATE`,
    })
    .from(batches)
    .where(
      and(eq(batches.id, batchId), eq(batches.organizationId, organizationId)),
    );

  if (!batch) {
    throw new BatchNotSellableError("Batch not found", batchId, "NOT_FOUND");
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
      expiredCount: sql<string>`count(*) filter (where ${batches.expiryDate} < CURRENT_DATE)`,
      expiredValue: sql<string>`coalesce(sum(${value}) filter (where ${batches.expiryDate} < CURRENT_DATE), 0)`,

      nearCount: sql<string>`count(*) filter (where ${batches.expiryDate} >= CURRENT_DATE AND ${batches.expiryDate} <= CURRENT_DATE + ${withinDays}::int)`,
      nearValue: sql<string>`coalesce(sum(${value}) filter (where ${batches.expiryDate} >= CURRENT_DATE AND ${batches.expiryDate} <= CURRENT_DATE + ${withinDays}::int), 0)`,
    })
    .from(batches)
    .where(
      and(
        eq(batches.organizationId, organizationId),
        gt(batches.quantityAvailable, 0),
      ),
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
