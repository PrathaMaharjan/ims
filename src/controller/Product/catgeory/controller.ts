import { db } from "@/db";
import { categories } from "@/db/schema";
import { getCached, invalidateCache, setCached } from "@/lib/cache";
import { and, asc, eq } from "drizzle-orm";

function cacheKey(organizationId: string) {
  return `categories:list:${organizationId}`;
}

export async function listCategories(organizationId: string) {
  const cached = await getCached<Array<{ id: string; name: string }>>(
    cacheKey(organizationId),
  );
  if (cached) return cached;

  const result = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.organizationId, organizationId))
    .orderBy(asc(categories.name));

  await setCached(cacheKey(organizationId), result, 60 * 10); // 10 min — categories change rarely

  return result;
}

export async function createCategory(organizationId: string, name: string) {
  try {
    const [created] = await db
      .insert(categories)
      .values({ organizationId, name })
      .returning({ id: categories.id, name: categories.name });

    await invalidateCache(cacheKey(organizationId));

    return created;
  } catch (error) {
    console.error("Error creating category:", error);
    throw error;
  }
}


export async function updateCategory(organizationId: string, id: string, name: string) {
  const [updated] = await db
    .update(categories)
    .set({ name })
    .where(and(eq(categories.id, id), eq(categories.organizationId, organizationId)))
    .returning({ id: categories.id, name: categories.name });

  if (!updated) {
    throw new Error("Category not found");
  }

  await invalidateCache(cacheKey(organizationId));

  return updated;
}

export async function deleteCategory(organizationId: string, id: string) {
  const [deleted] = await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.organizationId, organizationId)))
    .returning({ id: categories.id });

  if (!deleted) {
    throw new Error("Category not found");
  }

  await invalidateCache(cacheKey(organizationId));

  return deleted;
}