import { and, count, desc, eq, ilike, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { getCached, setCached, invalidateCachePattern } from "@/lib/cache";
import type {
  CreateStaffInput,
  ListStaffInput,
  UpdateStaffInput,
} from "@/lib/validation/staff";
import { sendStaffWelcomeEmail } from "@/lib/email/sendStaffmail";

export type StaffErrorReason =
  | "NOT_FOUND"
  | "EMAIL_TAKEN"
  | "CANNOT_DELETE_SELF";

export class StaffError extends Error {
  constructor(
    public reason: StaffErrorReason,
    message: string,
  ) {
    super(message);
    this.name = "StaffError";
  }
}

const TTL = 300; // seconds

const listKey = (
  org: string,
  userId: string,
  page: number,
  limit: number,
  search: string,
) => `staff:list:${org}:${userId}:${page}:${limit}:${search}`;
const itemKey = (org: string, id: string) => `staff:item:${org}:${id}`;
const invalidateStaff = (org: string) =>
  invalidateCachePattern(`staff:*:${org}:*`);

// Never select the password hash.
const publicColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  createdAt: users.createdAt,
};

type StaffRow = {
  id: string;
  name: string;
  email: string;
  createdAt: Date | string;
};

async function assertEmailFree(email: string, excludeId?: string) {
  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      excludeId
        ? and(eq(users.email, email), ne(users.id, excludeId))
        : eq(users.email, email),
    )
    .limit(1);
  if (taken) throw new StaffError("EMAIL_TAKEN", "Email is already in use");
}

// Two requests can pass the check above at once; the unique index catches it.
function isUniqueViolation(err: unknown) {
  return (err as { code?: string })?.code === "23505";
}

// ---------- CREATE ----------
export async function createStaff(
  organizationId: string,
  input: CreateStaffInput,
) {
  await assertEmailFree(input.email);
  const password = await hashPassword(input.password);

  let row: StaffRow;
  try {
    [row] = await db
      .insert(users)
      .values({
        organizationId,
        name: input.name,
        email: input.email,
        passwordHash: password,
      })
      .returning(publicColumns);
  } catch (err) {
    if (isUniqueViolation(err))
      throw new StaffError("EMAIL_TAKEN", "Email is already in use");
    throw err;
  }

  await invalidateStaff(organizationId);

  // Account exists at this point; an email failure must not undo it.
  let emailSent = true;
  try {
    await sendStaffWelcomeEmail({
      to: input.email,
      name: input.name,
      temporaryPassword: input.password,
    });
  } catch (err) {
    emailSent = false;
    console.error("Staff welcome email failed:", err);
  }

  return { ...row, emailSent };
}

// ---------- LIST ----------
async function listStaffFromDb(
  organizationId: string,
  currentUserId: string,
  page: number,
  limit: number,
  search: string
) {
  const where = and(
    eq(users.organizationId, organizationId),
    ne(users.id, currentUserId), // hide the logged-in user
    search
      ? or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`))
      : undefined
  );

  const [items, [{ total }]] = await Promise.all([
    db
      .select(publicColumns)
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ total: count() }).from(users).where(where),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function listStaff(
  organizationId: string,
  currentUserId: string,
  input: ListStaffInput
) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;
  const search = input.search ?? "";
  const key = listKey(organizationId, currentUserId, page, limit, search);

  const hit = await getCached<Awaited<ReturnType<typeof listStaffFromDb>>>(key);
  if (hit) return hit;

  const result = await listStaffFromDb(organizationId, currentUserId, page, limit, search);
  await setCached(key, result, TTL);
  return result;
}
// ---------- GET ONE ----------
export async function getStaff(organizationId: string, id: string) {
  const key = itemKey(organizationId, id);
  const hit = await getCached<StaffRow>(key);
  if (hit) return hit;

  const [row] = await db
    .select(publicColumns)
    .from(users)
    .where(and(eq(users.organizationId, organizationId), eq(users.id, id)))
    .limit(1);
  if (!row) throw new StaffError("NOT_FOUND", "Staff member not found");

  await setCached(key, row, TTL);
  return row;
}

// ---------- UPDATE ----------
export async function updateStaff(
  organizationId: string,
  id: string,
  input: UpdateStaffInput,
) {
  await getStaff(organizationId, id); // 404 first
  if (input.email) await assertEmailFree(input.email, id);

  const patch: Partial<typeof users.$inferInsert> = {};
  if (input.name) patch.name = input.name;
  if (input.email) patch.email = input.email;
  if (input.password) patch.passwordHash = await hashPassword(input.password);

  try {
    const [row] = await db
      .update(users)
      .set(patch)
      .where(and(eq(users.organizationId, organizationId), eq(users.id, id)))
      .returning(publicColumns);
    if (!row) throw new StaffError("NOT_FOUND", "Staff member not found");
    await invalidateStaff(organizationId);
    return row;
  } catch (err) {
    if (isUniqueViolation(err))
      throw new StaffError("EMAIL_TAKEN", "Email is already in use");
    throw err;
  }
}

// ---------- DELETE ----------
export async function deleteStaff(
  organizationId: string,
  currentUserId: string,
  id: string,
) {
  if (id === currentUserId) {
    throw new StaffError(
      "CANNOT_DELETE_SELF",
      "You cannot delete your own account",
    );
  }
  const [row] = await db
    .delete(users)
    .where(and(eq(users.organizationId, organizationId), eq(users.id, id)))
    .returning({ id: users.id });
  if (!row) throw new StaffError("NOT_FOUND", "Staff member not found");
  await invalidateStaff(organizationId);
  return { id: row.id };
}
