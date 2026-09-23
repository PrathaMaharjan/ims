import { db } from "@/db";
import { batches, products } from "@/db/schema";
import { and, eq } from "drizzle-orm";

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
  supplierId: true,
  createdAt: true,
} as const;

export async function listBatchesForProduct(organizationId: string, productId: string) {
  // Confirm the product actually belongs to this org before returning its batches —
  // prevents one tenant fetching another tenant's batches via a guessed productId.
  const product = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.organizationId, organizationId)),
    columns: { id: true, name: true, unit: true },
  });

   if (!product) {
    throw new Error("Product not found");
  }

  const rows = await db.query.batches.findMany({
    where: and(eq(batches.organizationId, organizationId), eq(batches.productId, productId)),
    columns: batchColumns,
    with: {
      supplier: { columns: { id: true, name: true } },
    },
    orderBy: (table, { asc }) => [asc(table.expiryDate)], // FEFO order — soonest expiry first
  });

  const totalStock = rows.reduce(
    (sum, b) => (b.status === "ACTIVE" ? sum + b.quantityAvailable : sum),
    0
  );

  return {
    product: { id: product.id, name: product.name, unit: product.unit },
    batches: rows,
    totalBatches: rows.length,
    totalStock,
  };
}

