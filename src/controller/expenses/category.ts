import { db } from "@/db";
import { expenseCategories } from "@/db/schema";
import { getCached, invalidateCache, setCached } from "@/lib/cache";
import { and, asc, eq } from "drizzle-orm";

function listCacheKey(organizationId: string) {
  return `expense-categories:list:${organizationId}`;
}

function oneCacheKey(organizationId: string, id: string) {
  return `expense-categories:one:${organizationId}:${id}`;
}

function inventoryCategoryCacheKey(organizationId: string) {
  return `expense-categories:inventory:${organizationId}`;
}

export async function listExpenseCategories(organizationId: string) {
  const cached = await getCached(listCacheKey(organizationId));
  if (cached) return cached;

  const result = await db
    .select({ id: expenseCategories.id, name: expenseCategories.name })
    .from(expenseCategories)
    .where(eq(expenseCategories.organizationId, organizationId))
    .orderBy(asc(expenseCategories.name));

  await setCached(listCacheKey(organizationId), result, 60 * 10); // rarely change

  return result;
}

// create the expense category
export async function createExpenseCategory(
  organizationId: string,
  name: string,
) {
  const [created] = await db
    .insert(expenseCategories)
    .values({ organizationId, name })
    .returning({ id: expenseCategories.id, name: expenseCategories.name });

  await invalidateCache(listCacheKey(organizationId));

  return created;
}

// update the expense category
export async function updateExpenseCategory(
  organizationId: string,
  id: string,
  name: string,
) {
  const [updated] = await db
    .update(expenseCategories)
    .set({ name })
    .where(
      and(
        eq(expenseCategories.id, id),
        eq(expenseCategories.organizationId, organizationId),
      ),
    )
    .returning({ id: expenseCategories.id, name: expenseCategories.name });

  if (!updated) {
    throw new Error("Expense category not found");
  }

  await Promise.all([
    invalidateCache(listCacheKey(organizationId)),
    invalidateCache(oneCacheKey(organizationId, id)),
    invalidateCache(inventoryCategoryCacheKey(organizationId)),
  ]);

  return updated;
}

export async function getExpenseCategoryById(
  organizationId: string,
  id: string,
) {
  const cached = await getCached(oneCacheKey(organizationId, id));
  if (cached) return cached;

  const [result] = await db
    .select({ id: expenseCategories.id, name: expenseCategories.name })
    .from(expenseCategories)
    .where(
      and(
        eq(expenseCategories.id, id),
        eq(expenseCategories.organizationId, organizationId),
      ),
    );

  if (!result) {
    throw new Error("Expense category not found");
  }

  await setCached(oneCacheKey(organizationId, id), result, 60 * 10);

  return result;
}

// delete
export async function deleteExpenseCategory(
  organizationId: string,
  id: string,
) {
  const [deleted] = await db
    .delete(expenseCategories)
    .where(
      and(
        eq(expenseCategories.id, id),
        eq(expenseCategories.organizationId, organizationId),
      ),
    )
    .returning({ id: expenseCategories.id });

  if (!deleted) {
    throw new Error("Expense category not found");
  }

  await Promise.all([
    invalidateCache(listCacheKey(organizationId)),
    invalidateCache(oneCacheKey(organizationId, id)),
    invalidateCache(inventoryCategoryCacheKey(organizationId)),
  ]);

  return deleted;
}

// Cached get-or-create — the common case (category already exists) is served
// entirely from Redis, with zero Postgres round-trips.
interface CategoryRef {
  id: string;
  name: string;
}
export async function getOrCreateInventoryCategory(
  organizationId: string,
): Promise<CategoryRef> {
  const cached = await getCached<CategoryRef>(
    inventoryCategoryCacheKey(organizationId),
  );
  if (cached) return cached;

  const existing = await db.query.expenseCategories.findFirst({
    where: and(
      eq(expenseCategories.organizationId, organizationId),
      eq(expenseCategories.name, "Inventory"),
    ),
    columns: { id: true, name: true },
  });
  const category: CategoryRef =
    existing ??
    (await db
      .insert(expenseCategories)
      .values({ organizationId, name: "Inventory" })
      .returning({ id: expenseCategories.id, name: expenseCategories.name })
      .then(([row]) => row));

  if (!existing) {
    await invalidateCache(listCacheKey(organizationId));
  }

  return category;
}
