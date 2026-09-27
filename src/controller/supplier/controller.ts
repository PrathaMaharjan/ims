import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { invalidateCachePattern } from "@/lib/cache";
import { CreateSupplierInput, UpdateSupplierInput } from "@/lib/validation/schema";
import { ListSuppliersQuery } from "@/lib/validation/supplier";
import { and, eq, ilike, sql } from "drizzle-orm";

function listCachePattern(organizationId: string) {
  return `suppliers:list:${organizationId}:*`;
}

const supplierColumns = {
  id: true,
  name: true,
  contactPerson: true,
  panVatNumber: true,
  address: true,
  phone: true,
  email: true,
  paymentTerms: true,
  status: true,
  notes: true,
  createdAt: true,
} as const;

export async function listSuppliers(organizationId: string, query: ListSuppliersQuery) {
  const { page, limit, search } = query;
  const offset = (page - 1) * limit;

  const whereClause = search
    ? and(eq(suppliers.organizationId, organizationId), ilike(suppliers.name, `%${search}%`))
    : eq(suppliers.organizationId, organizationId);

  const [rows, countResult] = await Promise.all([
    db.query.suppliers.findMany({
      where: whereClause,
      columns: supplierColumns,
      orderBy: (table, { asc }) => [asc(table.name)],
      limit,
      offset,
    }),
    db.select({ count: sql<number>`count(*)` }).from(suppliers).where(whereClause),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  return {
    suppliers: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}


export async function getSupplierById(organizationId: string, id: string) {
  return db.query.suppliers.findFirst({
    where: and(eq(suppliers.id, id), eq(suppliers.organizationId, organizationId)),
    columns: supplierColumns,
  });
}

export async function createSupplier(organizationId: string, input: CreateSupplierInput) {
  const [created] = await db
    .insert(suppliers)
    .values({ organizationId, ...input })
    .returning();

  await invalidateCachePattern(listCachePattern(organizationId));

  return created;
}

export async function updateSupplier(
  organizationId: string,
  id: string,
  input: UpdateSupplierInput
) {
  const [updated] = await db
    .update(suppliers)
    .set(input)
    .where(and(eq(suppliers.id, id), eq(suppliers.organizationId, organizationId)))
    .returning();

  if (!updated) {
    throw new Error("Supplier not found");
  }

  await invalidateCachePattern(listCachePattern(organizationId));

  return updated;
}

export async function deleteSupplier(organizationId: string, id: string) {
  const [deleted] = await db
    .delete(suppliers)
    .where(and(eq(suppliers.id, id), eq(suppliers.organizationId, organizationId)))
    .returning({ id: suppliers.id });

  if (!deleted) {
    throw new Error("Supplier not found");
  }

  await invalidateCachePattern(listCachePattern(organizationId));

  return deleted;
}

export async function getSupplierStats(organizationId: string) {
  const [totalsRow] = await db
    .select({
      totalCount: sql<number>`count(*)`,
      activeCount: sql<number>`count(*) filter (where ${suppliers.status} = true)`,
      inactiveCount: sql<number>`count(*) filter (where ${suppliers.status} = false)`,
    })
    .from(suppliers)
    .where(eq(suppliers.organizationId, organizationId));

  return {
    totalCount: Number(totalsRow?.totalCount ?? 0),
    activeCount: Number(totalsRow?.activeCount ?? 0),
    inactiveCount: Number(totalsRow?.inactiveCount ?? 0),
  };
}