import { db } from "@/db";
import { expenses } from "@/db/schema";
import { invalidateCachePattern } from "@/lib/cache";
import { CreateExpenseInput, ListExpensesQuery, UpdateExpenseInput } from "@/lib/validation/expense-categories";
import { and, eq, gte, lte, sql } from "drizzle-orm";

function listCachePattern(organizationId: string) {
  return `expenses:list:${organizationId}:*`;
}

const expenseColumns = {
  id: true,
  categoryId: true,
  description: true,
  note: true,
  amount: true,
  expenseDate: true,
  createdByUserId: true,
  createdAt: true,
} as const;

// get list of expenses
export async function listExpenses(
  organizationId: string,
  query: ListExpensesQuery,
) {
  const { page, limit, categoryId, date, startDate, endDate } = query;
  const offset = (page - 1) * limit;

  const conditions = [eq(expenses.organizationId, organizationId)];

  if (categoryId) {
    conditions.push(eq(expenses.categoryId, categoryId));
  }

  if (date) {
    conditions.push(eq(expenses.expenseDate, date));
  } else if (startDate && endDate) {
    conditions.push(gte(expenses.expenseDate, startDate));
    conditions.push(lte(expenses.expenseDate, endDate));
  }
  const whereClause = and(...conditions);

  const [rows, countResult] = await Promise.all([
    db.query.expenses.findMany({
      where: whereClause,
      columns: expenseColumns,
      with: { category: { columns: { id: true, name: true } } },
      orderBy: (table, { desc }) => [desc(table.expenseDate)],
      limit,
      offset,
    }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(expenses)
      .where(whereClause),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  return {
    expenses: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// create wxpenses 
export async function createExpense(
  organizationId: string,
  userId: string,
  input: CreateExpenseInput
) {
  const [created] = await db
    .insert(expenses)
    .values({
      organizationId,
      categoryId: input.categoryId,
      description: input.description,
      note: input.note,
      amount: input.amount.toFixed(2),
      expenseDate: input.expenseDate,
      createdByUserId: userId,
    })
    .returning();

  await invalidateCachePattern(listCachePattern(organizationId));

  return created;
}
// update expenses
export async function updateExpense(
  organizationId: string,
  id: string,
  input: UpdateExpenseInput
) {
  const { amount, ...rest } = input;

  const [updated] = await db
    .update(expenses)
    .set({
      ...rest,
      ...(amount !== undefined ? { amount: amount.toFixed(2) } : {}),
    })
    .where(and(eq(expenses.id, id), eq(expenses.organizationId, organizationId)))
    .returning();

  if (!updated) {
    throw new Error("Expense not found");
  }

  await invalidateCachePattern(listCachePattern(organizationId));

  return updated;
}
// delete
export async function deleteExpense(organizationId: string, id: string) {
  const [deleted] = await db
    .delete(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.organizationId, organizationId)))
    .returning({ id: expenses.id });

  if (!deleted) {
    throw new Error("Expense not found");
  }

  await invalidateCachePattern(listCachePattern(organizationId));

  return deleted;
}

// get one expnses
export async function getExpenseById(organizationId: string, id: string) {
  const result = await db.query.expenses.findFirst({
    where: and(eq(expenses.id, id), eq(expenses.organizationId, organizationId)),
    columns: expenseColumns,
    with: { category: { columns: { id: true, name: true } } },
  });

  if (!result) {
    throw new Error("Expense not found");
  }

  return result;
}