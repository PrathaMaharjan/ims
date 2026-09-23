import { db } from "@/db";
import { products } from "@/db/schema";
import { getCached, invalidateCache, setCached } from "@/lib/cache";
import {
  CreateProductInput,
  UpdateProductInput,
} from "@/lib/validation/products";
import { and, eq } from "drizzle-orm";

function listCacheKey(organizationId: string) {
  return `products:list:${organizationId}`;
}

function oneCacheKey(organizationId: string, id: string) {
  return `products:one:${organizationId}:${id}`;
}



// List all products for an organization, with caching and sorted by name. Returns an array of products with the above columns.


const productColumns = {
  id: true,
  name: true,
  aliasName: true,
  manufacturer: true,
  categoryId: true,
  hsnCode: true,
  unit: true,
  alternativeUnit: true,
  lowStockThreshold: true,
  stockQuantity: true,
  isActive: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface ProductWithBatchSummary {
  id: string;
  name: string;
  aliasName: string | null;
  manufacturer: string | null;
  categoryId: string | null;
  hsnCode: string | null;
  unit: string;
  alternativeUnit: string | null;
  lowStockThreshold: number | null;
  stockQuantity: number;
  isActive: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  totalBatches: number;
  totalStock: number; // sum of quantityAvailable across active batches — cross-check against stockQuantity
}

export async function listProducts(organizationId: string): Promise<ProductWithBatchSummary[]> {
  const cached = await getCached<ProductWithBatchSummary[]>(listCacheKey(organizationId));
  if (cached) return cached;

  // One relational query — products with their batches nested, no N+1.
  const rows = await db.query.products.findMany({
    where: eq(products.organizationId, organizationId),
    columns: productColumns,
    with: {
      batches: {
        columns: { quantityAvailable: true, status: true },
      },
    },
    orderBy: (table, { asc }) => [asc(table.name)],
  });

  const result: ProductWithBatchSummary[] = rows.map((product) => {
    const activeBatches = product.batches.filter((b) => b.status === "ACTIVE");
    return {
      ...product,
      batches: undefined, // strip the raw nested array from the response — only the summary is needed
      totalBatches: activeBatches.length,
      totalStock: activeBatches.reduce((sum, b) => sum + b.quantityAvailable, 0),
    } as ProductWithBatchSummary;
  });

  await setCached(listCacheKey(organizationId), result, 60 * 5);

  return result;
}

// get product by id
export async function getProductById(organizationId: string, id: string) {
  const cached = await getCached(oneCacheKey(organizationId, id));
  if (cached) return cached;

  const result = await db.query.products.findFirst({
    where: and(
      eq(products.id, id),
      eq(products.organizationId, organizationId),
    ),
    columns: productColumns,
  });

  if (!result) return null;

  await setCached(oneCacheKey(organizationId, id), result, 60 * 5);

  return result;
}

export async function createProduct(
  organizationId: string,
  input: CreateProductInput,
) {
  const [created] = await db
    .insert(products)
    .values({ organizationId, ...input })
    .returning();

  await invalidateCache(listCacheKey(organizationId));

  return created;
}

// update product by id
export async function updateProduct(
  organizationId: string,
  id: string,
  input: UpdateProductInput,
) {
  const [updated] = await db
    .update(products)
    .set({ ...input, updatedAt: new Date() })
    .where(
      and(eq(products.id, id), eq(products.organizationId, organizationId)),
    )
    .returning();

  if (!updated) {
    throw new Error("Product not found");
  }

  await Promise.all([
    invalidateCache(listCacheKey(organizationId)),
    invalidateCache(oneCacheKey(organizationId, id)),
  ]);

  return updated;
}

// Updates exactly one column at a time.
// Why updateProductField is separate from updateProduct: dynamically setting { [field]: value } on a full-row update is fine when field is validated against a fixed enum (as Zod does above) — but it's a distinct code path from the "update several fields at once"
//case, since the two have different callers (a single-cell inline edit in a table UI vs. a full edit form submit)
//  and different validation shapes.
export async function updateProductField(
  organizationId: string,
  id: string,
  field: string,
  value: string | number | boolean | null
) {
  const [updated] = await db
    .update(products)
    .set({ [field]: value, updatedAt: new Date() })
    .where(and(eq(products.id, id), eq(products.organizationId, organizationId)))
    .returning();

  if (!updated) {
    throw new Error("Product not found");
  }

  await Promise.all([
    invalidateCache(listCacheKey(organizationId)),
    invalidateCache(oneCacheKey(organizationId, id)),
  ]);

  return getProductById(organizationId, id); // same fix
}

export async function deleteProduct(organizationId: string, id: string) {
  const [deleted] = await db
    .delete(products)
    .where(
      and(eq(products.id, id), eq(products.organizationId, organizationId)),
    )
    .returning({ id: products.id });

  if (!deleted) {
    throw new Error("Product not found");
  }

  await Promise.all([
    invalidateCache(listCacheKey(organizationId)),
    invalidateCache(oneCacheKey(organizationId, id)),
  ]);

  return deleted;
}
