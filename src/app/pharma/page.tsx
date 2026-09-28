"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    TrendingUp,
    Wallet,
    Receipt,
    Calendar,
    AlertTriangle,
    ShoppingCart,
    Clock,
    Plus,
    ArrowUpRight,
    BarChart3,
    DollarSign,
    RotateCcw,
} from "lucide-react";
import {
    ComposedChart,
    Area,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import { api } from "@/lib/api-client";

type ViewMode = "monthly" | "yearly";

const PIE_COLORS = ["#044d73", "#0ea5e9", "#10b981", "#f59e0b", "#94a3b8", "#8b5cf6", "#ec4899", "#64748b"];

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const DEFAULT_MONTH_FROM = `${CURRENT_YEAR}-01`;
const DEFAULT_MONTH_TO = `${CURRENT_YEAR}-${String(now.getMonth() + 1).padStart(2, "0")}`;

function formatMoney(amount: number): string {
    return "Rs. " + Number(amount || 0).toLocaleString("en-NP", { maximumFractionDigits: 0 });
}

interface SummaryStats {
    totalSales: number;
    purchases: number;
    outflow: number;
    netProfit: number;
    profitMargin: number;
}

interface InventoryStatus {
    totalItems: number;
    lowStockCount: number;
    expiringCount: number;
}

interface WatchlistItem {
    status: "EXPIRED" | "NEAR_EXPIRY" | "LOW_STOCK";
    name: string;
    manufacturer: string | null;
    batchNumber: string | null;
    expiryDate: string | null;
    quantityAvailable: number;
    quantityReceived: number | null;
}

interface TransactionItem {
    type: "SALE" | "PURCHASE" | "EXPENSE";
    id: string;
    voucherNo: string;
    partyName: string;
    amount: string;
    date: string;
    paymentType: string | null;
}

interface BreakdownSlice {
    label: string;
    amount: number;
    percent: number;
}

interface TrendPoint {
    label: string;
    revenue: number;
    expenses: number;
    netProfit: number;
}

const WATCHLIST_STATUS_STYLE: Record<WatchlistItem["status"], string> = {
    EXPIRED: "bg-red-50 text-red-700 border-red-200",
    NEAR_EXPIRY: "bg-rose-50 text-rose-700 border-rose-200",
    LOW_STOCK: "bg-amber-50 text-amber-700 border-amber-200",
};

const WATCHLIST_STATUS_LABEL: Record<WatchlistItem["status"], string> = {
    EXPIRED: "Expired",
    NEAR_EXPIRY: "Expiring Soon",
    LOW_STOCK: "Low Stock",
};

export default function DashboardPage() {
    const [viewMode, setViewMode] = useState<ViewMode>("monthly");

    // Monthly and yearly keep their own range state — switching modes shouldn't
    // leave a "2026-01" value sitting in a year input.
    const [monthFrom, setMonthFrom] = useState(DEFAULT_MONTH_FROM);
    const [monthTo, setMonthTo] = useState(DEFAULT_MONTH_TO);
    const [yearFrom, setYearFrom] = useState(String(CURRENT_YEAR));
    const [yearTo, setYearTo] = useState(String(CURRENT_YEAR));

    const [breakdownType, setBreakdownType] = useState<"category" | "payment">("category");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<SummaryStats | null>(null);
    const [inventoryStatus, setInventoryStatus] = useState<InventoryStatus | null>(null);
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
    const [transactions, setTransactions] = useState<TransactionItem[]>([]);
    const [breakdown, setBreakdown] = useState<BreakdownSlice[]>([]);
    const [trend, setTrend] = useState<TrendPoint[]>([]);

    useEffect(() => {
        let cancelled = false;

        const rangeParams =
            viewMode === "monthly"
                ? { mode: "monthly", startMonth: monthFrom, endMonth: monthTo }
                : { mode: "yearly", startYear: yearFrom, endYear: yearTo };

        async function load() {
            setLoading(true);
            setError(null);

            // allSettled, not all — one broken endpoint shouldn't blank the whole page.
            const results = await Promise.allSettled([
                api.get("/api/dashboard/stats", { params: rangeParams }),
                api.get("/api/dashboard/watchlist"),
                api.get("/api/dashboard/recent", { params: { limit: 5 } }),
                api.get("/api/dashboard/breakdown", { params: { ...rangeParams, by: breakdownType } }),
                api.get("/api/dashboard/trend", { params: rangeParams }),
            ]);

            if (cancelled) return;

            const [summaryRes, watchlistRes, transactionsRes, breakdownRes, trendRes] = results;

            if (summaryRes.status === "fulfilled") {
                setStats(summaryRes.value.data.stats);
                setInventoryStatus(summaryRes.value.data.inventoryStatus);
            }
            if (watchlistRes.status === "fulfilled") setWatchlist(watchlistRes.value.data.items ?? []);
            if (transactionsRes.status === "fulfilled") setTransactions(transactionsRes.value.data.items ?? []);
            if (breakdownRes.status === "fulfilled") setBreakdown(breakdownRes.value.data.slices ?? []);
            if (trendRes.status === "fulfilled") setTrend(trendRes.value.data.points ?? []);

            const failed = results.filter((r) => r.status === "rejected");
            if (failed.length) {
                failed.forEach((r) => console.error("Dashboard fetch failed:", (r as PromiseRejectedResult).reason));
                setError(`${failed.length} of ${results.length} dashboard requests failed — check the console.`);
            }

            setLoading(false);
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [viewMode, monthFrom, monthTo, yearFrom, yearTo, breakdownType]);

    const resetFilters = () => {
        setMonthFrom(DEFAULT_MONTH_FROM);
        setMonthTo(DEFAULT_MONTH_TO);
        setYearFrom(String(CURRENT_YEAR));
        setYearTo(String(CURRENT_YEAR));
        setViewMode("monthly");
    };

    const isFiltered =
        viewMode !== "monthly" || monthFrom !== DEFAULT_MONTH_FROM || monthTo !== DEFAULT_MONTH_TO;

    const totalOutflow = (stats?.purchases ?? 0) + (stats?.outflow ?? 0);
    const chartData = trend.map((t) => ({
        label: t.label,
        Revenue: t.revenue,
        Expenses: t.expenses,
        "Net Profit": t.netProfit,
    }));

    return (
        <div className="flex flex-col gap-8 pb-12">
            {/* Header with View Mode Toggles */}
            <div className="rounded-xl bg-[#044d73] p-4 sm:px-6 sm:py-6 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h1>
                </div>

                <div className="flex items-center gap-1 self-stretch sm:self-auto rounded-xl bg-white/10 p-1 border border-white/20 overflow-x-auto justify-between sm:justify-start">
                    {(["monthly", "yearly"] as ViewMode[]).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => setViewMode(mode)}
                            className={`flex-1 sm:flex-none text-center rounded-lg px-3 sm:px-4 py-1.5 text-xs font-bold capitalize transition-all ${viewMode === mode
                                ? "bg-white text-[#044d73] shadow-sm"
                                : "text-white/80 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                    {error}
                </div>
            )}

            {/* Filter & Date Range Bar */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <Calendar className="h-4 w-4 text-[#044d73]" />
                        <span>Date Range:</span>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {viewMode === "monthly" ? (
                            <>
                                <input
                                    type="month"
                                    value={monthFrom}
                                    max={monthTo || undefined}
                                    onChange={(e) => setMonthFrom(e.target.value)}
                                    className="flex-1 sm:flex-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[#044d73]"
                                />
                                <span className="text-xs text-slate-400">to</span>
                                <input
                                    type="month"
                                    value={monthTo}
                                    min={monthFrom || undefined}
                                    onChange={(e) => setMonthTo(e.target.value)}
                                    className="flex-1 sm:flex-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[#044d73]"
                                />
                            </>
                        ) : (
                            <>
                                <input
                                    type="number"
                                    min={2000}
                                    max={2100}
                                    value={yearFrom}
                                    onChange={(e) => setYearFrom(e.target.value)}
                                    className="flex-1 sm:flex-none w-24 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[#044d73]"
                                />
                                <span className="text-xs text-slate-400">to</span>
                                <input
                                    type="number"
                                    min={2000}
                                    max={2100}
                                    value={yearTo}
                                    onChange={(e) => setYearTo(e.target.value)}
                                    className="flex-1 sm:flex-none w-24 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[#044d73]"
                                />
                            </>
                        )}
                    </div>

                    {isFiltered && (
                        <button
                            type="button"
                            onClick={resetFilters}
                            className="flex items-center gap-1 text-xs text-[#044d73] hover:underline font-semibold self-start sm:self-auto"
                        >
                            <RotateCcw className="h-3 w-3" />
                            Reset
                        </button>
                    )}

                    {loading && <span className="text-xs text-slate-400">Loading…</span>}
                </div>
            </div>

            {/* KPI Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border-l-4 border-l-[#044d73] border border-slate-200 bg-white p-5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Sales</p>
                        <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1">{formatMoney(stats?.totalSales ?? 0)}</p>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#044d73]/10 text-[#044d73]">
                        <DollarSign className="h-6 w-6" />
                    </div>
                </div>

                <div className="rounded-xl border-l-4 border-l-emerald-500 border border-slate-200 bg-white p-5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Net Profit</p>
                        <p className="text-2xl sm:text-3xl font-bold text-emerald-600 mt-1">{formatMoney(stats?.netProfit ?? 0)}</p>
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 font-medium">
                            <span className="font-bold text-emerald-700">{(stats?.profitMargin ?? 0).toFixed(1)}%</span>
                            <span className="text-slate-400">profit margin</span>
                        </div>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                        <TrendingUp className="h-6 w-6" />
                    </div>
                </div>

                <div className="rounded-xl border-l-4 border-l-rose-500 border border-slate-200 bg-white p-5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Purchases & Outflow</p>
                        <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1">{formatMoney(totalOutflow)}</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                            Pur: {formatMoney(stats?.purchases ?? 0)} · Exp: {formatMoney(stats?.outflow ?? 0)}
                        </p>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                        <Receipt className="h-6 w-6" />
                    </div>
                </div>

                {/* Inventory Status is fixed/unfiltered — always live stock, ignores the date range */}
                <div className="rounded-xl border-l-4 border-l-amber-500 border border-slate-200 bg-white p-5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Inventory Status</p>
                        <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1">{inventoryStatus?.totalItems ?? 0} Items</p>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                {inventoryStatus?.lowStockCount ?? 0} Low Stock
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                {inventoryStatus?.expiringCount ?? 0} Expiring
                            </span>
                        </div>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                        <AlertTriangle className="h-6 w-6" />
                    </div>
                </div>
            </div>

            {/* Trend Chart + Revenue Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm flex flex-col gap-4 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-[#044d73]/10 text-[#044d73] flex items-center justify-center">
                                <BarChart3 className="h-4 w-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Revenue, Outflows & Profit Trends</h3>
                                <p className="text-xs text-slate-400">Comparative business performance over time</p>
                            </div>
                        </div>

                        <span className="text-xs font-semibold text-[#044d73] bg-[#044d73]/5 px-2.5 py-1 rounded-md self-start sm:self-auto capitalize">
                            View: {viewMode}
                        </span>
                    </div>

                    <div className="w-full h-72 sm:h-80 pt-2 min-w-0">
                        {chartData.length === 0 && !loading ? (
                            <div className="h-full flex items-center justify-center text-xs text-slate-400">
                                No data for this range.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="dashRevGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#044d73" stopOpacity={0.35} />
                                            <stop offset="95%" stopColor="#044d73" stopOpacity={0.02} />
                                        </linearGradient>
                                        <linearGradient id="dashExpGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} />
                                    <YAxis
                                        tick={{ fontSize: 11, fill: "#64748b" }}
                                        tickFormatter={(v) => `Rs.${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
                                    />
                                    <Tooltip
                                        formatter={(value: any, name: any) =>
                                            typeof value === "number" ? [formatMoney(value), name] : [value, name]
                                        }
                                        contentStyle={{
                                            backgroundColor: "#ffffff",
                                            border: "1px solid #e2e8f0",
                                            borderRadius: "10px",
                                            fontSize: "12px",
                                        }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                                    <Area type="monotone" dataKey="Revenue" stroke="#044d73" strokeWidth={2.5} fill="url(#dashRevGrad)" />
                                    <Area type="monotone" dataKey="Expenses" stroke="#f43f5e" strokeWidth={2} fill="url(#dashExpGrad)" />
                                    <Line type="monotone" dataKey="Net Profit" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3.5, fill: "#10b981" }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Donut Chart: Revenue Breakdown */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm flex flex-col justify-between gap-4 min-w-0">
                    <div>
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
                            <h3 className="text-sm font-bold text-slate-900">Revenue Breakdown</h3>
                            <div className="flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold">
                                <button
                                    type="button"
                                    onClick={() => setBreakdownType("category")}
                                    className={`px-2 py-0.5 rounded-md transition-colors ${breakdownType === "category" ? "bg-white text-[#044d73] shadow-sm" : "text-slate-500"}`}
                                >
                                    Category
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBreakdownType("payment")}
                                    className={`px-2 py-0.5 rounded-md transition-colors ${breakdownType === "payment" ? "bg-white text-[#044d73] shadow-sm" : "text-slate-500"}`}
                                >
                                    Payment
                                </button>
                            </div>
                        </div>

                        <div className="h-52 w-full flex items-center justify-center">
                            {breakdown.length === 0 ? (
                                <span className="text-xs text-slate-400">{loading ? "Loading…" : "No revenue in this range."}</span>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={breakdown} dataKey="percent" nameKey="label" innerRadius={55} outerRadius={75} paddingAngle={3}>
                                            {breakdown.map((entry, i) => (
                                                <Cell key={entry.label} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(val: any, name: any) => [`${val}%`, name]} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                        {breakdown.map((item, i) => (
                            <div key={item.label} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                    <span className="text-slate-600 font-medium">{item.label}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-400">{item.percent}%</span>
                                    <span className="font-semibold text-slate-800">{formatMoney(item.amount)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Section: Critical Stock Watchlist & Recent Transactions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm space-y-4 min-w-0">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <h3 className="text-sm font-bold text-slate-900">Critical Stock & Expiry Watchlist</h3>
                        </div>
                        <Link href="/pharma/inventory" className="text-xs font-semibold text-[#044d73] hover:underline flex items-center gap-1">
                            View All Items
                            <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {watchlist.map((item, i) => (
                            <div key={`${item.name}-${item.batchNumber ?? i}`} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-xs font-bold text-slate-800 truncate">{item.name}</h4>
                                        {item.manufacturer && (
                                            <span className="text-[10px] font-semibold text-[#044d73] bg-[#044d73]/10 px-1.5 rounded shrink-0">
                                                {item.manufacturer}
                                            </span>
                                        )}
                                    </div>
                                    {item.batchNumber && (
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                            Batch: {item.batchNumber} · Exp: {item.expiryDate}
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                    <div>
                                        <span className="text-xs font-bold text-slate-800 block">
                                            {item.quantityAvailable} / {item.quantityReceived ?? "—"}
                                        </span>
                                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${WATCHLIST_STATUS_STYLE[item.status]}`}>
                                            {WATCHLIST_STATUS_LABEL[item.status]}
                                        </span>
                                    </div>
                                    <Link
                                        href="/pharma/purchase"
                                        title="Create purchase order for this item"
                                        className="rounded-lg bg-slate-50 hover:bg-[#044d73]/10 text-slate-600 hover:text-[#044d73] p-1.5 transition-colors border border-slate-200"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                    </Link>
                                </div>
                            </div>
                        ))}
                        {!loading && watchlist.length === 0 && (
                            <p className="py-6 text-center text-xs text-slate-400">Nothing needs attention right now.</p>
                        )}
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm space-y-4 min-w-0">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-[#044d73]" />
                            <h3 className="text-sm font-bold text-slate-900">Recent Transactions</h3>
                        </div>
                        <Link href="/pharma/analytics" className="text-xs font-semibold text-[#044d73] hover:underline flex items-center gap-1">
                            Full Report
                            <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {transactions.map((tx) => (
                            <div key={tx.id} className="py-3 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div
                                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${tx.type === "SALE"
                                            ? "bg-emerald-50 text-emerald-600"
                                            : tx.type === "PURCHASE"
                                                ? "bg-[#044d73]/10 text-[#044d73]"
                                                : "bg-rose-50 text-rose-600"
                                            }`}
                                    >
                                        {tx.type === "SALE" ? (
                                            <ShoppingCart className="h-4 w-4" />
                                        ) : tx.type === "PURCHASE" ? (
                                            <Receipt className="h-4 w-4" />
                                        ) : (
                                            <Wallet className="h-4 w-4" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-800 truncate">{tx.voucherNo}</span>
                                            <span className="text-[10px] text-slate-400">({tx.type})</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{tx.partyName}</p>
                                    </div>
                                </div>

                                <div className="text-right shrink-0">
                                    <span className="text-xs font-bold text-slate-800 block">{formatMoney(Number(tx.amount))}</span>
                                    <div className="flex items-center justify-end gap-1.5 text-[10px] text-slate-400 mt-0.5">
                                        {tx.paymentType && <span>{tx.paymentType}</span>}
                                        <span>•</span>
                                        <span>{new Date(tx.date).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {!loading && transactions.length === 0 && (
                            <p className="py-6 text-center text-xs text-slate-400">No transactions yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}