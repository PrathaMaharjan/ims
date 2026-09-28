import { db } from "@/db";
import { parties } from "@/db/schema";
import { invalidateCachePattern } from "@/lib/cache";
import {
  CreatePartyInput,
  ListPartiesQuery,
  PartyStatsQuery,
  UpdatePartyInput,
} from "@/lib/validation/party";
import { and, eq, ilike, inArray, sql, SQL } from "drizzle-orm";

function listCachePattern(organizationId: string) {
  return `parties:list:${organizationId}:*`;
}

const partyColumns = {
  id: true,
  name: true,
  partyType: true,
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

// A "BOTH" party is a valid supplier and a valid customer.
function typeFilter(type: "SUPPLIER" | "CUSTOMER" | undefined): SQL | undefined {
  if (!type) return undefined;
  return inArray(parties.partyType, [type, "BOTH"]);
}

export async function listParties(organizationId: string, query: ListPartiesQuery) {
  const { page, limit, search, type } = query;
  const offset = (page - 1) * limit;

  const whereClause = and(
    eq(parties.organizationId, organizationId),
    search ? ilike(parties.name, `%${search}%`) : undefined,
    typeFilter(type),
  );

  const [rows, countResult] = await Promise.all([
    db.query.parties.findMany({
      where: whereClause,
      columns: partyColumns,
      orderBy: (table, { asc }) => [asc(table.name)],
      limit,
      offset,
    }),
    db.select({ count: sql<number>`count(*)` }).from(parties).where(whereClause),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  return {
    parties: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getPartyById(organizationId: string, id: string) {
  return db.query.parties.findFirst({
    where: and(eq(parties.id, id), eq(parties.organizationId, organizationId)),
    columns: partyColumns,
  });
}

export async function createParty(organizationId: string, input: CreatePartyInput) {
  const [created] = await db
    .insert(parties)
    .values({ organizationId, ...input })
    .returning();

  await invalidateCachePattern(listCachePattern(organizationId));

  return created;
}

export async function updateParty(
  organizationId: string,
  id: string,
  input: UpdatePartyInput,
) {
  const [updated] = await db
    .update(parties)
    .set(input)
    .where(and(eq(parties.id, id), eq(parties.organizationId, organizationId)))
    .returning();

  if (!updated) {
    throw new Error("Party not found");
  }

  await invalidateCachePattern(listCachePattern(organizationId));

  return updated;
}

export async function deleteParty(organizationId: string, id: string) {
  const [deleted] = await db
    .delete(parties)
    .where(and(eq(parties.id, id), eq(parties.organizationId, organizationId)))
    .returning({ id: parties.id });

  if (!deleted) {
    throw new Error("Party not found");
  }

  await invalidateCachePattern(listCachePattern(organizationId));

  return deleted;
}

export async function getPartyStats(organizationId: string, query: PartyStatsQuery) {
  const [totalsRow] = await db
    .select({
      totalCount: sql<number>`count(*)`,
      activeCount: sql<number>`count(*) filter (where ${parties.status} = true)`,
      inactiveCount: sql<number>`count(*) filter (where ${parties.status} = false)`,
      supplierCount: sql<number>`count(*) filter (where ${parties.partyType} in ('SUPPLIER', 'BOTH'))`,
      customerCount: sql<number>`count(*) filter (where ${parties.partyType} in ('CUSTOMER', 'BOTH'))`,
    })
    .from(parties)
    .where(and(eq(parties.organizationId, organizationId), typeFilter(query.type)));

  return {
    totalCount: Number(totalsRow?.totalCount ?? 0),
    activeCount: Number(totalsRow?.activeCount ?? 0),
    inactiveCount: Number(totalsRow?.inactiveCount ?? 0),
    supplierCount: Number(totalsRow?.supplierCount ?? 0),
    customerCount: Number(totalsRow?.customerCount ?? 0),
  };
}
