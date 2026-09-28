import { db } from "@/db";
import { batches, categories, expenseCategories, expenses, organizations, parties, products, purchases, saleItems, sales } from "@/db/schema";
import { DashboardSummaryQuery } from "@/lib/validation/dashboard";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";

const NEAR_EXPIRY_DAYS = 15;

export interface DashboardRange {
  mode: "monthly" | "yearly";
  startDate: string;
  endDateExclusive: string;
  label: { start: string; end: string };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export async function resolveDashboardRange(
  organizationId: string,
  input: DashboardSummaryQuery,
): Promise<DashboardRange> {
  const now = new Date();

  if (input.mode === "monthly") {
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    const [startYear, startMonthNum] = input.startMonth
      ? input.startMonth.split("-").map(Number)
      : [currentYear, 1];
    const [endYear, endMonthNum] = input.endMonth
      ? input.endMonth.split("-").map(Number)
      : [currentYear, currentMonth];

    const startDate = `${startYear}-${pad(startMonthNum)}-01`;

    // Exclusive upper bound = first day of the month AFTER endMonth.
    const endExclusiveYear = endMonthNum === 12 ? endYear + 1 : endYear;
    const endExclusiveMonth = endMonthNum === 12 ? 1 : endMonthNum + 1;
    const endDateExclusive = `${endExclusiveYear}-${pad(endExclusiveMonth)}-01`;

    return {
      mode: "monthly",
      startDate,
      endDateExclusive,
      label: {
        start: `${startYear}-${pad(startMonthNum)}`,
        end: `${endYear}-${pad(endMonthNum)}`,
      },
    };
  }
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
    columns: { createdAt: true },
  });
  const orgCreatedYear = org?.createdAt
    ? new Date(org.createdAt).getFullYear()
    : now.getFullYear();

  const startYear = input.startYear ?? orgCreatedYear;
  const endYear = input.endYear ?? now.getFullYear();

  return {
    mode: "yearly",
    startDate: `${startYear}-01-01`,
    endDateExclusive: `${endYear + 1}-01-01`,
    label: { start: `${startYear}`, end: `${endYear}` },
  };
}

export interface DashboardStats {
  totalSales: number;
  purchases: number;
  outflow: number;
  netProfit: number;
  profitMargin: number;
}

// Revenue + purchases/outflow for the resolved range. Both purchases and
// outflow come from the `expenses` table split by category name — NOT from
// `purchases.grandTotal` — matching the convention already established in
// the analytics controllers ("expenses mean no inventory category data and
// purchases mean inventory category data").
export async function getDashboardStats(
  organizationId: string,
  range: DashboardRange,
): Promise<DashboardStats> {
  const [salesRow] = await db
    .select({
      totalSales: sql<string>`coalesce(sum(${sales.grandTotal}), 0)`,
    })
    .from(sales)
    .where(
      and(
        eq(sales.organizationId, organizationId),
        gte(sales.saleDate, new Date(range.startDate)),
        lt(sales.saleDate, new Date(range.endDateExclusive)),
      ),
    );
 
  const [expenseRow] = await db
    .select({
      purchases: sql<string>`coalesce(sum(${expenses.amount}) filter (where ${expenseCategories.name} = 'Inventory'), 0)`,
      outflow: sql<string>`coalesce(sum(${expenses.amount}) filter (where ${expenseCategories.name} != 'Inventory'), 0)`,
    })
    .from(expenses)
    .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .where(
      and(
        eq(expenses.organizationId, organizationId),
        gte(expenses.expenseDate, range.startDate),
        lt(expenses.expenseDate, range.endDateExclusive),
      ),
    );
 
  const totalSales = Number(salesRow?.totalSales ?? 0);
  const purchases = Number(expenseRow?.purchases ?? 0);
  const outflow = Number(expenseRow?.outflow ?? 0);
  const netProfit = totalSales - (purchases + outflow);
  const profitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;
 
  return { totalSales, purchases, outflow, netProfit, profitMargin };
}
 
export interface InventoryStatus {
  totalItems: number;
  lowStockCount: number;
  expiringCount: number;
}

export async function getInventoryStatus(organizationId: string): Promise<InventoryStatus> {
  const [productRow] = await db
    .select({
      totalItems: sql<string>`count(*) filter (where ${products.isActive} = true)`,
      lowStockCount: sql<string>`count(*) filter (
        where ${products.isActive} = true
          and ${products.lowStockThreshold} is not null
          and ${products.stockQuantity} <= ${products.lowStockThreshold}
      )`,
    })
    .from(products)
    .where(eq(products.organizationId, organizationId));
 
  const [batchRow] = await db
    .select({
      expiringCount: sql<string>`count(*)`,
    })
    .from(batches)
    .where(
      and(
        eq(batches.organizationId, organizationId),
        sql`${batches.quantityAvailable} > 0`,
        sql`${batches.expiryDate} >= CURRENT_DATE`,
        sql`${batches.expiryDate} <= CURRENT_DATE + ${NEAR_EXPIRY_DAYS}::int`,
      ),
    );
 
  return {
    totalItems: Number(productRow?.totalItems ?? 0),
    lowStockCount: Number(productRow?.lowStockCount ?? 0),
    expiringCount: Number(batchRow?.expiringCount ?? 0),
  };
}

// Critical Stock & Expiry Watchlist
 

export async function getCriticalWatchlist(organizationId: string) {
  const lowStock = await db
    .select({
      productId: products.id,
      name: products.name,
      manufacturer: products.manufacturer,
      unit: products.unit,
      stockQuantity: products.stockQuantity,
      lowStockThreshold: products.lowStockThreshold,
    })
    .from(products)
    .where(
      and(
        eq(products.organizationId, organizationId),
        eq(products.isActive, true),
        sql`${products.lowStockThreshold} is not null`,
        sql`${products.stockQuantity} <= ${products.lowStockThreshold}`,
      ),
    );

  const expiring = await db
    .select({
      batchNumber: batches.batchNumber,
      expiryDate: batches.expiryDate,
      quantityAvailable: batches.quantityAvailable,
      quantityReceived: batches.quantityReceived,
      name: products.name,
      manufacturer: products.manufacturer,
      unit: products.unit,
    })
    .from(batches)
    .innerJoin(products, eq(batches.productId, products.id))
    .where(
      and(
        eq(batches.organizationId, organizationId),
        sql`${batches.quantityAvailable} > 0`,
        sql`${batches.expiryDate} <= CURRENT_DATE + ${NEAR_EXPIRY_DAYS}::int`,
      ),
    )
    .orderBy(batches.expiryDate);

  const items = [
    ...lowStock.map((p) => ({
      status: "LOW_STOCK" as const,
      name: p.name,
      manufacturer: p.manufacturer,
      batchNumber: null,
      expiryDate: null,
      quantityAvailable: p.stockQuantity,
      quantityReceived: p.lowStockThreshold,
    })),
    ...expiring.map((b) => ({
      status: daysUntil(b.expiryDate) < 0 ? "EXPIRED" as const : "NEAR_EXPIRY" as const,
      name: b.name,
      manufacturer: b.manufacturer,
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate,
      quantityAvailable: b.quantityAvailable,
      quantityReceived: b.quantityReceived,
    })),
  ];

  const rank = { EXPIRED: 0, NEAR_EXPIRY: 1, LOW_STOCK: 2 };
  items.sort((a, b) => rank[a.status] - rank[b.status]);

  return items;
}

function daysUntil(expiryDate: string): number {
  const [y, m, d] = expiryDate.split("-").map(Number);
  const expiry = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((expiry - today) / 86_400_000);
}

// Recent Transactions

export async function getRecentTransactions(organizationId: string, limit = 10) {
  const [saleRows, purchaseRows, expenseRows] = await Promise.all([
    db
      .select({
        id: sales.id,
        invoiceNumber: sales.invoiceNumber,
        amount: sales.grandTotal,
        date: sales.saleDate,
        paymentType: sales.paymentType,
        partyName: parties.name,
      })
      .from(sales)
      .leftJoin(parties, eq(sales.partyId, parties.id))
      .where(eq(sales.organizationId, organizationId))
      .orderBy(desc(sales.saleDate))
      .limit(limit),
 
    db
      .select({
        id: purchases.id,
        supplierInvoiceNumber: purchases.supplierInvoiceNumber,
        amount: purchases.grandTotal,
        date: purchases.purchaseDate,
        paymentType: purchases.paymentType,
        partyName: parties.name,
      })
      .from(purchases)
      .innerJoin(parties, eq(purchases.partyId, parties.id))
      .where(eq(purchases.organizationId, organizationId))
      .orderBy(desc(purchases.purchaseDate))
      .limit(limit),
 
    db
      .select({
        id: expenses.id,
        amount: expenses.amount,
        date: expenses.expenseDate,
        description: expenses.description,
        categoryName: expenseCategories.name,
      })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(eq(expenses.organizationId, organizationId))
      .orderBy(desc(expenses.expenseDate))
      .limit(limit),
  ]);
 
  const merged = [
    ...saleRows.map((r) => ({
      type: "SALE" as const,
      id: r.id,
      voucherNo: `VCH-${r.invoiceNumber}`,
      partyName: r.partyName ?? "Walk-in Patient",
      amount: r.amount,
      date: r.date,
      paymentType: r.paymentType,
    })),
    ...purchaseRows.map((r) => ({
      type: "PURCHASE" as const,
      id: r.id,
      voucherNo: r.supplierInvoiceNumber ?? `PUR-${r.id.slice(0, 8)}`,
      partyName: r.partyName,
      amount: r.amount,
      date: r.date,
      paymentType: r.paymentType,
    })),
    ...expenseRows.map((r) => ({
      type: "EXPENSE" as const,
      id: r.id,
      voucherNo: `EXP-${r.id.slice(0, 8)}`,
      partyName: r.description ?? r.categoryName ?? "Expense",
      amount: r.amount,
      date: r.date,
      paymentType: null,
    })),
  ];
 
  merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
 
  return merged.slice(0, limit);
}
// reenue breakdown
export interface BreakdownSlice {
  label: string;
  amount: number;
  percent: number;
}
 
// Revenue split by product category — sums saleItems.lineTotal, not
// sales.grandTotal, since a single sale can span multiple categories.
export async function getRevenueByCategory(
  organizationId: string,
  range: DashboardRange,
): Promise<BreakdownSlice[]> {
  const rows = await db
    .select({
      categoryName: sql<string>`coalesce(${categories.name}, 'Uncategorized')`,
      amount: sql<string>`sum(${saleItems.lineTotal})`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .innerJoin(products, eq(saleItems.productId, products.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(
      and(
        eq(sales.organizationId, organizationId),
        gte(sales.saleDate, new Date(range.startDate)),
        lt(sales.saleDate, new Date(range.endDateExclusive)),
      ),
    )
    .groupBy(categories.name)
    .orderBy(sql`sum(${saleItems.lineTotal}) desc`);
 
  return toSlices(rows.map((r) => ({ label: r.categoryName, amount: Number(r.amount) })));
}
 
// Revenue split by how the sale was paid for.
export async function getRevenueByPayment(
  organizationId: string,
  range: DashboardRange,
): Promise<BreakdownSlice[]> {
  const rows = await db
    .select({
      paymentType: sales.paymentType,
      amount: sql<string>`sum(${sales.grandTotal})`,
    })
    .from(sales)
    .where(
      and(
        eq(sales.organizationId, organizationId),
        gte(sales.saleDate, new Date(range.startDate)),
        lt(sales.saleDate, new Date(range.endDateExclusive)),
      ),
    )
    .groupBy(sales.paymentType)
    .orderBy(sql`sum(${sales.grandTotal}) desc`);
 
  return toSlices(rows.map((r) => ({ label: r.paymentType, amount: Number(r.amount) })));
}
 
function toSlices(rows: { label: string; amount: number }[]): BreakdownSlice[] {
  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  return rows.map((r) => ({
    label: r.label,
    amount: r.amount,
    percent: total > 0 ? Math.round((r.amount / total) * 100) : 0,
  }));
}

// revenuse vs expense
export interface TrendPoint {
  label: string; // "Jan 26" for monthly, "2026" for yearly
  revenue: number;
  expenses: number;
  netProfit: number;
}
 
const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
 
export async function getRevenueTrend(
  organizationId: string,
  range: DashboardRange,
): Promise<TrendPoint[]> {
  const revenueRows = await db
    .select({
      bucket: sql<string>`to_char(${sales.saleDate}, 'YYYY-MM')`,
      amount: sql<string>`sum(${sales.grandTotal})`,
    })
    .from(sales)
    .where(
      and(
        eq(sales.organizationId, organizationId),
        gte(sales.saleDate, new Date(range.startDate)),
        lt(sales.saleDate, new Date(range.endDateExclusive)),
      ),
    )
    .groupBy(sql`to_char(${sales.saleDate}, 'YYYY-MM')`);
 
  const expenseRows = await db
    .select({
      bucket: sql<string>`to_char(${expenses.expenseDate}, 'YYYY-MM')`,
      amount: sql<string>`sum(${expenses.amount})`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.organizationId, organizationId),
        gte(expenses.expenseDate, range.startDate),
        lt(expenses.expenseDate, range.endDateExclusive),
      ),
    )
    .groupBy(sql`to_char(${expenses.expenseDate}, 'YYYY-MM')`);
 
  const revenueByMonth = new Map(revenueRows.map((r) => [r.bucket, Number(r.amount)]));
  const expensesByMonth = new Map(expenseRows.map((r) => [r.bucket, Number(r.amount)]));
 
  const months = monthsBetween(range.startDate, range.endDateExclusive);
 
  if (range.mode === "monthly") {
    return months.map(({ key, year, month }) => {
      const revenue = revenueByMonth.get(key) ?? 0;
      const expense = expensesByMonth.get(key) ?? 0;
      return {
        label: `${MONTH_LABELS[month - 1]} ${String(year).slice(2)}`,
        revenue,
        expenses: expense,
        netProfit: revenue - expense,
      };
    });
  }
 
  // Yearly mode: roll the monthly buckets up into one point per year.
  const byYear = new Map<number, { revenue: number; expenses: number }>();
  for (const { key, year } of months) {
    const entry = byYear.get(year) ?? { revenue: 0, expenses: 0 };
    entry.revenue += revenueByMonth.get(key) ?? 0;
    entry.expenses += expensesByMonth.get(key) ?? 0;
    byYear.set(year, entry);
  }
 
  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, { revenue, expenses: expense }]) => ({
      label: String(year),
      revenue,
      expenses: expense,
      netProfit: revenue - expense,
    }));
}
 
// Every calendar month from startDate (inclusive) up to endDateExclusive (exclusive).
function monthsBetween(startDate: string, endDateExclusive: string) {
  const [startYear, startMonth] = startDate.split("-").map(Number);
  const [endYear, endMonth] = endDateExclusive.split("-").map(Number);
 
  const months: { key: string; year: number; month: number }[] = [];
  let year = startYear;
  let month = startMonth;
 
  while (year < endYear || (year === endYear && month < endMonth)) {
    months.push({ key: `${year}-${String(month).padStart(2, "0")}`, year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
 
  return months;
}