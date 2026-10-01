"use client";

import { useState, useMemo, useEffect } from "react";
import {
    TrendingUp,
    TrendingDown,
    Wallet,
    Receipt,
    Calendar,
    RotateCcw,
    ChevronLeft,
    ChevronRight,
    PieChart as PieIcon,
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
import { AnimatedStatValue } from "../_components/ui/animated-stat-value";

/* ------------------------------------------------------------------ */
/* Types — mirror the analytics controller's return shapes             */
/* ------------------------------------------------------------------ */

interface SummaryCards {
    revenue: number;
    totalExpense: number;
    netProfit: number;
}

interface BreakdownRow {
    period: string; // "January".."December" (monthly) or "2026","2027" (yearly)
    purchaseExpense: number;
    manualExpense: number;
    totalExpense: number;
    revenue: number;
    netProfit: number;
}

interface CategoryTotal {
    category: string;
    amount: number;
}

interface ExpenseSplit {
    categories: CategoryTotal[];
    total: number;
}

interface RevenueVsExpenseRow {
    period: string;
    revenue: number;
    totalExpense: number;
    netProfit: number;
}

type ViewMode = "monthly" | "yearly";

const ITEMS_PER_PAGE = 6;
const COLORS = { revenue: "#044d73", expense: "#f43f5e", profit: "#0ea5e9" };
// expense-split returns whatever categories exist, so the palette cycles.
const PIE_COLORS = ["#044d73", "#f59e0b", "#0ea5e9", "#94a3b8", "#a855f7", "#22c55e", "#ef4444", "#14b8a6"];

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const DEFAULT_MONTH_FROM = `${CURRENT_YEAR}-01`;
const DEFAULT_MONTH_TO = `${CURRENT_YEAR}-${String(now.getMonth() + 1).padStart(2, "0")}`;

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AnalyticsPage() {
    const [viewMode, setViewMode] = useState<ViewMode>("monthly");
    const [monthFrom, setMonthFrom] = useState(DEFAULT_MONTH_FROM);
    const [monthTo, setMonthTo] = useState(DEFAULT_MONTH_TO);
    const [yearFrom, setYearFrom] = useState(String(CURRENT_YEAR));
    const [yearTo, setYearTo] = useState(String(CURRENT_YEAR));
    const [tablePage, setTablePage] = useState(1);

    const [stats, setStats] = useState<SummaryCards>({ revenue: 0, totalExpense: 0, netProfit: 0 });
    const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
    const [expenseSplit, setExpenseSplit] = useState<ExpenseSplit>({ categories: [], total: 0 });
    const [trend, setTrend] = useState<RevenueVsExpenseRow[]>([]);

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    // Hits the four analytics endpoints in parallel — one per widget, the
    // way the routes are built. Every route takes the same params: `mode`
    // plus the month span (monthly) or the year span (yearly).
    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setLoadError(null);

            const rangeParams =
                viewMode === "monthly"
                    ? { mode: "monthly", startMonth: monthFrom, endMonth: monthTo }
                    : { mode: "yearly", startYear: yearFrom, endYear: yearTo };

            try {
                const [cardsRes, breakdownRes, splitRes, trendRes] = await Promise.all([
                    api.get("/api/Analytics/stats", { params: rangeParams }),
                    api.get("/api/Analytics/breakdown", { params: rangeParams }),
                    api.get("/api/Analytics/expense-split", { params: rangeParams }),
                    api.get("/api/Analytics/revenue-vs-expenses", { params: rangeParams }),
                ]);

                if (cancelled) return;

                setStats(cardsRes.data);
                setBreakdown(breakdownRes.data);
                setExpenseSplit(splitRes.data);
                setTrend(trendRes.data);
                setTablePage(1);
            } catch {
                if (!cancelled) setLoadError("Failed to load analytics.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [viewMode, monthFrom, monthTo, yearFrom, yearTo]);

    const resetFilters = () => {
        setMonthFrom(DEFAULT_MONTH_FROM);
        setMonthTo(DEFAULT_MONTH_TO);
        setYearFrom(String(CURRENT_YEAR));
        setYearTo(String(CURRENT_YEAR));
        setViewMode("monthly");
    };

    const isFiltered =
        viewMode !== "monthly" ||
        monthFrom !== DEFAULT_MONTH_FROM ||
        monthTo !== DEFAULT_MONTH_TO ||
        yearFrom !== String(CURRENT_YEAR) ||
        yearTo !== String(CURRENT_YEAR);

    // Newest period first in the table, chronological in the chart.
    const tableRows = useMemo(() => [...breakdown].reverse(), [breakdown]);

    const chartData = useMemo(
        () =>
            trend.map((r) => ({
                label: r.period,
                Revenue: r.revenue,
                Expense: r.totalExpense,
                "Net Profit": r.netProfit,
            })),
        [trend]
    );

    const pieData = useMemo(
        () => expenseSplit.categories.map((c) => ({ name: c.category, value: c.amount })),
        [expenseSplit]
    );

    const tableTotalPages = Math.max(1, Math.ceil(tableRows.length / ITEMS_PER_PAGE));
    const paginatedRows = tableRows.slice((tablePage - 1) * ITEMS_PER_PAGE, tablePage * ITEMS_PER_PAGE);

    const isProfitPositive = stats.netProfit >= 0;

    const money = (v: number) => `Rs. ${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    // The animated counter rounds to whole numbers, so the stat cards animate
    // in paisa (value × 100) and convert back here to keep both decimals.
    const moneyFromPaisa = (v: number) => money(v / 100);
    const tooltipFormatter = (value: any, name: any) =>
        typeof value === "number" ? [money(value), name] : [value, name];

    return (
        <div className="flex flex-col gap-8">
            {/* Header with View Mode Toggles */}
            <div className="rounded-xl bg-[#044d73] p-4 sm:px-6 sm:py-6 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Analytics</h1>
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

            {loadError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                    {loadError}
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

            {/* Stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border-l-4 border-l-[#044d73] border border-slate-200 bg-white p-4 sm:p-5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Revenue</p>
                        <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1"><AnimatedStatValue value={Math.round(stats.revenue * 100)} format={moneyFromPaisa} /></p>
                    </div>
                    <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-[#044d73]/10 text-[#044d73]">
                        <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                </div>

                <div className="rounded-xl border-l-4 border-l-rose-500 border border-slate-200 bg-white p-4 sm:p-5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Expense</p>
                        <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1"><AnimatedStatValue value={Math.round(stats.totalExpense * 100)} format={moneyFromPaisa} /></p>
                    </div>
                    <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                        <Receipt className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                </div>

                <div className={`rounded-xl border-l-4 ${isProfitPositive ? "border-l-emerald-500" : "border-l-rose-500"} border border-slate-200 bg-white p-4 sm:p-5 shadow-sm flex items-center justify-between`}>
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Net Profit</p>
                        <p className={`text-2xl sm:text-3xl font-bold mt-1 ${isProfitPositive ? "text-emerald-600" : "text-rose-600"}`}>
                            <AnimatedStatValue value={Math.round(stats.netProfit * 100)} format={moneyFromPaisa} />
                        </p>
                    </div>
                    <div className={`flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl ${isProfitPositive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                        {isProfitPositive ? <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" /> : <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6" />}
                    </div>
                </div>
            </div>

            {/* Trend chart + expense split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Area + line combo chart */}
                <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5 flex flex-col gap-4 min-w-0">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#044d73]/10 flex items-center justify-center">
                            <TrendingUp className="w-3.5 h-3.5 text-[#044d73]" />
                        </div>
                        <span className="text-sm font-semibold text-slate-700">Revenue vs Expense</span>
                        <span className="text-xs text-slate-400">— {viewMode}</span>
                    </div>

                    {loading ? (
                        <div className="h-72 flex items-center justify-center text-xs text-slate-400">Loading…</div>
                    ) : chartData.length === 0 ? (
                        <div className="h-72 flex items-center justify-center text-xs text-slate-400">No data for this range.</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={320}>
                            <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS.revenue} stopOpacity={0.35} />
                                        <stop offset="95%" stopColor={COLORS.revenue} stopOpacity={0.02} />
                                    </linearGradient>
                                    <linearGradient id="expFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS.expense} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={COLORS.expense} stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} />
                                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px" }}
                                    formatter={tooltipFormatter}
                                />
                                <Legend wrapperStyle={{ fontSize: "12px" }} />
                                <Area type="monotone" dataKey="Revenue" stroke={COLORS.revenue} fill="url(#revFill)" strokeWidth={2} />
                                <Area type="monotone" dataKey="Expense" stroke={COLORS.expense} fill="url(#expFill)" strokeWidth={2} />
                                <Line type="monotone" dataKey="Net Profit" stroke={COLORS.profit} strokeWidth={2.5} dot={{ r: 3 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Expense breakdown donut */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5 flex flex-col gap-4 min-w-0">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#044d73]/10 flex items-center justify-center">
                            <PieIcon className="w-3.5 h-3.5 text-[#044d73]" />
                        </div>
                        <span className="text-sm font-semibold text-slate-700">Expense Split</span>
                    </div>

                    {loading ? (
                        <div className="h-56 flex items-center justify-center text-xs text-slate-400">Loading…</div>
                    ) : expenseSplit.total === 0 ? (
                        <div className="h-56 flex items-center justify-center text-xs text-slate-400">No expense data.</div>
                    ) : (
                        <>
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2}>
                                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(v: any) => money(Number(v))} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="space-y-2">
                                {pieData.map((d, i) => (
                                    <div key={d.name} className="flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-2 text-slate-600">
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                            {d.name}
                                        </span>
                                        <span className="font-semibold text-slate-700">{money(d.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Detail table */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Receipt className="w-4 h-4 text-slate-400" />
                        Breakdown
                    </div>
                    {tableRows.length > 0 && (
                        <span className="text-xs text-slate-400 font-medium">
                            {tableRows.length} {viewMode === "monthly" ? "months" : "years"}
                        </span>
                    )}
                </div>

                {loading ? (
                    <p className="text-xs text-slate-400 text-center py-6">Loading…</p>
                ) : tableRows.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">No data for this range.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    {["Period", "Revenue", "Purchase Exp.", "Manual Exp.", "Total Expense", "Net Profit"].map((h, i) => (
                                        <th key={h} className={`text-[10px] font-bold uppercase tracking-widest px-4 py-3 ${i === 0 ? "text-left" : "text-right"} text-slate-400`}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedRows.map(row => (
                                    <tr key={row.period} className="border-b last:border-0 border-slate-50 hover:bg-slate-50/60 transition-colors">
                                        <td className="px-4 py-3 font-semibold text-slate-800">{row.period}</td>
                                        <td className="px-4 py-3 text-right text-slate-700">{money(row.revenue)}</td>
                                        <td className="px-4 py-3 text-right text-slate-500">{money(row.purchaseExpense)}</td>
                                        <td className="px-4 py-3 text-right text-slate-500">{money(row.manualExpense)}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-slate-700">{money(row.totalExpense)}</td>
                                        <td className={`px-4 py-3 text-right font-bold ${row.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                            {money(row.netProfit)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {tableRows.length > 0 && (
                    <div className="flex flex-col gap-4 items-center justify-between border-t border-slate-100 pt-4 sm:flex-row">
                        <div className="text-sm text-slate-500 hidden sm:block"></div>
                        <div className="flex items-center justify-between w-full sm:w-auto gap-6">
                            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                                Page {tablePage} of {tableTotalPages}
                            </span>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setTablePage(p => Math.max(p - 1, 1))} disabled={tablePage === 1}
                                    className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-20 disabled:pointer-events-none transition-colors">
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                                <button onClick={() => setTablePage(p => Math.min(p + 1, tableTotalPages))} disabled={tablePage === tableTotalPages}
                                    className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-20 disabled:pointer-events-none transition-colors">
                                    <ChevronRight className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}