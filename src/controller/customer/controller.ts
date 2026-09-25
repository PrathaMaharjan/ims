import { db } from "@/db";
import { customers } from "@/db/schema";
import { invalidateCachePattern } from "@/lib/cache";
import { CreateCustomerInput, ListCustomersQuery, UpdateCustomerInput } from "@/lib/validation/customer";
import { and, eq, ilike, sql } from "drizzle-orm";

function listCachePattern(organizationId: string) {
  return `customers:list:${organizationId}:*`;
}

const customerColumns = {
  id: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  status: true,
  createdAt: true,
} as const;

// get all custumer
export async function listCustomers(
  organizationId: string,
  query: ListCustomersQuery,
) {
  const { page, limit, search } = query;
  const offset = (page - 1) * limit;

  const whereClause = search
    ? and(
        eq(customers.organizationId, organizationId),
        ilike(customers.name, `%${search}%`),
      )
    : eq(customers.organizationId, organizationId);

  const [rows, countResult] = await Promise.all([
    db.query.customers.findMany({
      where: whereClause,
      columns: customerColumns,
      orderBy: (table, { asc }) => [asc(table.name)],
      limit,
      offset,
    }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(customers)
      .where(whereClause),
  ]);
  const total = Number(countResult[0]?.count ?? 0);

  return {
    customers: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// create customer 
export async function createCustomer(organizationId: string, input: CreateCustomerInput) {
  const [created] = await db
    .insert(customers)
    .values({ organizationId, ...input })
    .returning();

  await invalidateCachePattern(listCachePattern(organizationId));

  return created;
}

// update customer detail =s'
export async function updateCustomer(
  organizationId: string,
  id: string,
  input: UpdateCustomerInput
) {
  const [updated] = await db
    .update(customers)
    .set(input)
    .where(and(eq(customers.id, id), eq(customers.organizationId, organizationId)))
    .returning();

  if (!updated) {
    throw new Error("Customer not found");
  }

  await invalidateCachePattern(listCachePattern(organizationId));

  return updated;
}

export async function deleteCustomer(organizationId: string, id: string) {
  const [deleted] = await db
    .delete(customers)
    .where(and(eq(customers.id, id), eq(customers.organizationId, organizationId)))
    .returning({ id: customers.id });

  if (!deleted) {
    throw new Error("Customer not found");
  }

  await invalidateCachePattern(listCachePattern(organizationId));

  return deleted;
}

// get custumer by id
export async function getCustomerById(organizationId: string, id: string) {
  const result = await db.query.customers.findFirst({
    where: and(eq(customers.id, id), eq(customers.organizationId, organizationId)),
    columns: customerColumns,
  });

  if (!result) {
    throw new Error("Customer not found");
  }

  return result;
}

// stats
export async function getCustomerStats(organizationId: string) {
  const [totalsRow] = await db
    .select({
      totalCount: sql<number>`count(*)`,
      activeCount: sql<number>`count(*) filter (where ${customers.status} = true)`,
      inactiveCount: sql<number>`count(*) filter (where ${customers.status} = false)`,
    })
    .from(customers)
    .where(eq(customers.organizationId, organizationId));

  return {
    totalCount: Number(totalsRow?.totalCount ?? 0),
    activeCount: Number(totalsRow?.activeCount ?? 0),
    inactiveCount: Number(totalsRow?.inactiveCount ?? 0),
  };
}