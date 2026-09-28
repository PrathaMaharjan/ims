import { db } from "@/db";
import { batches, products } from "@/db/schema";
import { and, eq, SQL, sql } from "drizzle-orm";

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
