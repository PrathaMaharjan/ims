import { db } from "@/db";
import { expenseCategories, expenses, sales } from "@/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";

export interface SummaryCards {
  revenue: number;
  totalExpense: number;
  netProfit: number;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0); // day 0 of next month = last day of `month`
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface RevenueVsExpenseRow {
  period: string; // "January", "February", ... for monthly, or "2026", "2027", ... for yearly
  revenue: number;
  totalExpense: number;
  netProfit: number;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function monthKeysBetween(startMonth: string, endMonth: string): string[] {
  const [sy, sm] = startMonth.split("-").map(Number);
  const [ey, em] = endMonth.split("-").map(Number);

  const keys: string[] = [];
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    keys.push(`${y}-${pad(m)}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
}

function yearsBetween(startYear: number, endYear: number): string[] {
  const years: string[] = [];
  for (let y = startYear; y <= endYear; y++) years.push(String(y));
  return years;
}

export async function getRevenueVsExpensesMonthly(
  organizationId: string,
  startMonth: string,
  endMonth: string,
): Promise<RevenueVsExpenseRow[]> {
  const [sy, sm] = startMonth.split("-").map(Number);
  const [ey, em] = endMonth.split("-").map(Number);

  const startDate = `${sy}-${pad(sm)}-01`;
  const endDate = lastDayOfMonth(ey, em);

  const [revenueRows, expenseRows] = await Promise.all([
    db
      .select({
        monthKey: sql<string>`to_char(date_trunc('month', ${sales.saleDate}), 'YYYY-MM')`,
        revenue: sql<string>`coalesce(sum(${sales.grandTotal}), 0)`,
      })
      .from(sales)
      .where(
        and(
          eq(sales.organizationId, organizationId),
          gte(sales.saleDate, new Date(startDate)),
          lte(sales.saleDate, new Date(endDate)),
        ),
      )
      .groupBy(sql`date_trunc('month', ${sales.saleDate})`),
    db
      .select({
        monthKey: sql<string>`to_char(date_trunc('month', ${expenses.expenseDate}), 'YYYY-MM')`,
        totalExpense: sql<string>`coalesce(sum(${expenses.amount}), 0)`,
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.organizationId, organizationId),
          gte(expenses.expenseDate, startDate),
          lte(expenses.expenseDate, endDate),
        ),
      )
      .groupBy(sql`date_trunc('month', ${expenses.expenseDate})`),
  ]);

  const monthKeys = monthKeysBetween(startMonth, endMonth);
  const byMonthKey = new Map<string, RevenueVsExpenseRow>(
    monthKeys.map((key) => {
      const monthNum = Number(key.split("-")[1]);
      return [
        key,
        {
          period: MONTH_NAMES[monthNum - 1],
          revenue: 0,
          totalExpense: 0,
          netProfit: 0,
        },
      ];
    }),
  );

  for (const r of revenueRows) {
    const row = byMonthKey.get(r.monthKey);
    if (row) row.revenue = Number(r.revenue);
  }

  for (const e of expenseRows) {
    const row = byMonthKey.get(e.monthKey);
    if (row) row.totalExpense = Number(e.totalExpense);
  }

  for (const row of byMonthKey.values()) {
    row.netProfit = row.revenue - row.totalExpense;
  }

  return monthKeys.map((key) => byMonthKey.get(key)!);
}

export async function getRevenueVsExpensesYearly(
  organizationId: string,
  startYear: number,
  endYear: number,
): Promise<RevenueVsExpenseRow[]> {
  const startDate = `${startYear}-01-01`;
  const endDate = `${endYear}-12-31`;

  const [revenueRows, expenseRows] = await Promise.all([
    db
      .select({
        year: sql<string>`to_char(date_trunc('year', ${sales.saleDate}), 'YYYY')`,
        revenue: sql<string>`coalesce(sum(${sales.grandTotal}), 0)`,
      })
      .from(sales)
      .where(
        and(
          eq(sales.organizationId, organizationId),
          gte(sales.saleDate, new Date(startDate)),
          lte(sales.saleDate, new Date(endDate)),
        ),
      )
      .groupBy(sql`date_trunc('year', ${sales.saleDate})`),

    db
      .select({
        year: sql<string>`to_char(date_trunc('year', ${expenses.expenseDate}), 'YYYY')`,
        totalExpense: sql<string>`coalesce(sum(${expenses.amount}), 0)`,
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.organizationId, organizationId),
          gte(expenses.expenseDate, startDate),
          lte(expenses.expenseDate, endDate),
        ),
      )
      .groupBy(sql`date_trunc('year', ${expenses.expenseDate})`),
  ]);
  const years = yearsBetween(startYear, endYear);
  const byYear = new Map<string, RevenueVsExpenseRow>(
    years.map((y) => [
      y,
      { period: y, revenue: 0, totalExpense: 0, netProfit: 0 },
    ]),
  );

  for (const r of revenueRows) {
    const row = byYear.get(r.year);
    if (row) row.revenue = Number(r.revenue);
  }

  for (const e of expenseRows) {
    const row = byYear.get(e.year);
    if (row) row.totalExpense = Number(e.totalExpense);
  }

  for (const row of byYear.values()) {
    row.netProfit = row.revenue - row.totalExpense;
  }

  return years.map((y) => byYear.get(y)!);
}

export interface CategoryTotal {
  category: string; // the actual category name, e.g. "Inventory", "Rent", "Wastage", "Utilities"
  amount: number;
}

export interface ExpenseSplit {
  categories: CategoryTotal[]; // every category that had at least one expense in range, sorted highest first
  total: number;
}

async function getExpenseSplitForRange(
  organizationId: string,
  startDate: string,
  endDate: string,
): Promise<ExpenseSplit> {
  const rows = await db
    .select({
      category: sql<string>`coalesce(${expenseCategories.name}, 'Uncategorized')`,
      amount: sql<string>`coalesce(sum(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .where(
      and(
        eq(expenses.organizationId, organizationId),
        gte(expenses.expenseDate, startDate),
        lte(expenses.expenseDate, endDate),
      ),
    )
    .groupBy(sql`coalesce(${expenseCategories.name}, 'Uncategorized')`);

  const categories = rows
    .map((r) => ({ category: r.category, amount: Number(r.amount) }))
    .sort((a, b) => b.amount - a.amount);

  const total = categories.reduce((sum, c) => sum + c.amount, 0);

  return { categories, total };
}

export async function getExpenseSplitMonthly(
  organizationId: string,
  startMonth: string,
  endMonth: string,
): Promise<ExpenseSplit> {
  const [sy, sm] = startMonth.split("-").map(Number);
  const [ey, em] = endMonth.split("-").map(Number);

  const startDate = `${sy}-${pad(sm)}-01`;
  const endDate = lastDayOfMonth(ey, em);

  return getExpenseSplitForRange(organizationId, startDate, endDate);
}

export async function getExpenseSplitYearly(
  organizationId: string,
  startYear: number,
  endYear: number,
): Promise<ExpenseSplit> {
  const startDate = `${startYear}-01-01`;
  const endDate = `${endYear}-12-31`;

  return getExpenseSplitForRange(organizationId, startDate, endDate);
}

// break down
export interface BreakdownRow {
  period: string; // "January".."December" for monthly, or "2026","2027",... for yearly
  purchaseExpense: number; // "Inventory" category
  manualExpense: number; // every other category
  totalExpense: number;
  revenue: number;
  netProfit: number;
}

function emptyRow(period: string): BreakdownRow {
  return {
    period,
    purchaseExpense: 0,
    manualExpense: 0,
    totalExpense: 0,
    revenue: 0,
    netProfit: 0,
  };
}

function applyExpenseRow(
  row: BreakdownRow,
  categoryName: string | null,
  amount: number,
) {
  if (categoryName === "Inventory") row.purchaseExpense += amount;
  else row.manualExpense += amount;
}

export async function getBreakdownMonthly(
  organizationId: string,
  startMonth: string,
  endMonth: string,
): Promise<BreakdownRow[]> {
  const [sy, sm] = startMonth.split("-").map(Number);
  const [ey, em] = endMonth.split("-").map(Number);

  const startDate = `${sy}-${pad(sm)}-01`;
  const endDate = lastDayOfMonth(ey, em);

  const [revenueRows, expenseRows] = await Promise.all([
    db
      .select({
        monthKey: sql<string>`to_char(date_trunc('month', ${sales.saleDate}), 'YYYY-MM')`,
        revenue: sql<string>`coalesce(sum(${sales.grandTotal}), 0)`,
      })
      .from(sales)
      .where(
        and(
          eq(sales.organizationId, organizationId),
          gte(sales.saleDate, new Date(startDate)),
          lte(sales.saleDate, new Date(endDate)),
        ),
      )
      .groupBy(sql`date_trunc('month', ${sales.saleDate})`),

    db
      .select({
        monthKey: sql<string>`to_char(date_trunc('month', ${expenses.expenseDate}), 'YYYY-MM')`,
        categoryName: expenseCategories.name,
        amount: sql<string>`coalesce(sum(${expenses.amount}), 0)`,
      })
      .from(expenses)
      .leftJoin(
        expenseCategories,
        eq(expenses.categoryId, expenseCategories.id),
      )
      .where(
        and(
          eq(expenses.organizationId, organizationId),
          gte(expenses.expenseDate, startDate),
          lte(expenses.expenseDate, endDate),
        ),
      )
      .groupBy(
        sql`date_trunc('month', ${expenses.expenseDate})`,
        expenseCategories.name,
      ),
  ]);

  const monthKeys = monthKeysBetween(startMonth, endMonth);
  const byMonthKey = new Map<string, BreakdownRow>(
    monthKeys.map((key) => {
      const monthNum = Number(key.split("-")[1]);
      return [key, emptyRow(MONTH_NAMES[monthNum - 1])];
    }),
  );

  for (const r of revenueRows) {
    const row = byMonthKey.get(r.monthKey);
    if (row) row.revenue = Number(r.revenue);
  }

  for (const e of expenseRows) {
    const row = byMonthKey.get(e.monthKey);
    if (row) applyExpenseRow(row, e.categoryName, Number(e.amount));
  }

  for (const row of byMonthKey.values()) {
    row.totalExpense = row.purchaseExpense + row.manualExpense;
    row.netProfit = row.revenue - row.totalExpense;
  }

  return monthKeys.map((key) => byMonthKey.get(key)!);
}

export async function getBreakdownYearly(
  organizationId: string,
  startYear: number,
  endYear: number,
): Promise<BreakdownRow[]> {
  const startDate = `${startYear}-01-01`;
  const endDate = `${endYear}-12-31`;

  const [revenueRows, expenseRows] = await Promise.all([
    db
      .select({
        year: sql<string>`to_char(date_trunc('year', ${sales.saleDate}), 'YYYY')`,
        revenue: sql<string>`coalesce(sum(${sales.grandTotal}), 0)`,
      })
      .from(sales)
      .where(
        and(
          eq(sales.organizationId, organizationId),
          gte(sales.saleDate, new Date(startDate)),
          lte(sales.saleDate, new Date(endDate)),
        ),
      )
      .groupBy(sql`date_trunc('year', ${sales.saleDate})`),

    db
      .select({
        year: sql<string>`to_char(date_trunc('year', ${expenses.expenseDate}), 'YYYY')`,
        categoryName: expenseCategories.name,
        amount: sql<string>`coalesce(sum(${expenses.amount}), 0)`,
      })
      .from(expenses)
      .leftJoin(
        expenseCategories,
        eq(expenses.categoryId, expenseCategories.id),
      )
      .where(
        and(
          eq(expenses.organizationId, organizationId),
          gte(expenses.expenseDate, startDate),
          lte(expenses.expenseDate, endDate),
        ),
      )
      .groupBy(
        sql`date_trunc('year', ${expenses.expenseDate})`,
        expenseCategories.name,
      ),
  ]);
  const years = yearsBetween(startYear, endYear);
  const byYear = new Map<string, BreakdownRow>(
    years.map((y) => [y, emptyRow(y)]),
  );

  for (const r of revenueRows) {
    const row = byYear.get(r.year);
    if (row) row.revenue = Number(r.revenue);
  }

  for (const e of expenseRows) {
    const row = byYear.get(e.year);
    if (row) applyExpenseRow(row, e.categoryName, Number(e.amount));
  }

  for (const row of byYear.values()) {
    row.totalExpense = row.purchaseExpense + row.manualExpense;
    row.netProfit = row.revenue - row.totalExpense;
  }

  return years.map((y) => byYear.get(y)!);
}


// getSTATs
export async function getSummaryCardsMonthly(
  organizationId: string,
  startMonth: string,
  endMonth: string,
): Promise<SummaryCards> {
  const [sy, sm] = startMonth.split("-").map(Number);
  const [ey, em] = endMonth.split("-").map(Number);

  const startDate = `${sy}-${pad(sm)}-01`;
  const endDate = lastDayOfMonth(ey, em);

  const salesFilter = and(
    eq(sales.organizationId, organizationId),
    gte(sales.saleDate, new Date(startDate)),
    lte(sales.saleDate, new Date(endDate)),
  );

  const expenseFilter = and(
    eq(expenses.organizationId, organizationId),
    gte(expenses.expenseDate, startDate),
    lte(expenses.expenseDate, endDate),
  );

  const [salesRow, expenseRow] = await Promise.all([
    db
      .select({ revenue: sql<string>`coalesce(sum(${sales.grandTotal}), 0)` })
      .from(sales)
      .where(salesFilter),
    db
      .select({ totalExpense: sql<string>`coalesce(sum(${expenses.amount}), 0)` })
      .from(expenses)
      .where(expenseFilter),
  ]);

  const revenue = Number(salesRow[0]?.revenue ?? 0);
  const totalExpense = Number(expenseRow[0]?.totalExpense ?? 0);

  return { revenue, totalExpense, netProfit: revenue - totalExpense };
}

export async function getSummaryCardsYearly(
  organizationId: string,
  startYear: number,
  endYear: number,
): Promise<SummaryCards> {
  const startDate = `${startYear}-01-01`;
  const endDate = `${endYear}-12-31`;

  const salesFilter = and(
    eq(sales.organizationId, organizationId),
    gte(sales.saleDate, new Date(startDate)),
    lte(sales.saleDate, new Date(endDate)),
  );

  const expenseFilter = and(
    eq(expenses.organizationId, organizationId),
    gte(expenses.expenseDate, startDate),
    lte(expenses.expenseDate, endDate),
  );

  const [salesRow, expenseRow] = await Promise.all([
    db
      .select({ revenue: sql<string>`coalesce(sum(${sales.grandTotal}), 0)` })
      .from(sales)
      .where(salesFilter),
    db
      .select({ totalExpense: sql<string>`coalesce(sum(${expenses.amount}), 0)` })
      .from(expenses)
      .where(expenseFilter),
  ]);

  const revenue = Number(salesRow[0]?.revenue ?? 0);
  const totalExpense = Number(expenseRow[0]?.totalExpense ?? 0);

  return { revenue, totalExpense, netProfit: revenue - totalExpense };
}


// get All
export interface AnalyticsAll {
  stats: SummaryCards;
  revenueVsExpenses: RevenueVsExpenseRow[];
  expenseSplit: ExpenseSplit;
  breakdown: BreakdownRow[];
}

export async function getAllMonthly(
  organizationId: string,
  startMonth: string,
  endMonth: string,
): Promise<AnalyticsAll> {
  const [stats, revenueVsExpenses, expenseSplit, breakdown] = await Promise.all([
    getSummaryCardsMonthly(organizationId, startMonth, endMonth),
    getRevenueVsExpensesMonthly(organizationId, startMonth, endMonth),
    getExpenseSplitMonthly(organizationId, startMonth, endMonth),
    getBreakdownMonthly(organizationId, startMonth, endMonth),
  ]);

  return { stats, revenueVsExpenses, expenseSplit, breakdown };
}

export async function getAllYearly(
  organizationId: string,
  startYear: number,
  endYear: number,
): Promise<AnalyticsAll> {
  const [stats, revenueVsExpenses, expenseSplit, breakdown] = await Promise.all([
    getSummaryCardsYearly(organizationId, startYear, endYear),
    getRevenueVsExpensesYearly(organizationId, startYear, endYear),
    getExpenseSplitYearly(organizationId, startYear, endYear),
    getBreakdownYearly(organizationId, startYear, endYear),
  ]);

  return { stats, revenueVsExpenses, expenseSplit, breakdown };
}