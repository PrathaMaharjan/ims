"use client";

import { useState, useMemo, useEffect } from "react";
import {
    TrendingUp,
    TrendingDown,
    Wallet,
    Receipt,
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


interface MonthRow {
    month: string; // "2026-01"
    revenue: number;
    purchaseExpense: number;
    wastageExpense: number;
    manualExpense: number;
}

type ViewMode = "monthly" | "yearly" | "overall";

const MONTHS: MonthRow[] = [
    { month: "2026-01", revenue: 185000, purchaseExpense: 92000, wastageExpense: 3200, manualExpense: 14000 },
    { month: "2026-02", revenue: 172000, purchaseExpense: 88000, wastageExpense: 2100, manualExpense: 12500 },
    { month: "2026-03", revenue: 204000, purchaseExpense: 101000, wastageExpense: 4600, manualExpense: 15800 },
    { month: "2026-04", revenue: 198500, purchaseExpense: 97500, wastageExpense: 2800, manualExpense: 13200 },
    { month: "2026-05", revenue: 221000, purchaseExpense: 108000, wastageExpense: 3900, manualExpense: 16400 },
    { month: "2026-06", revenue: 213000, purchaseExpense: 103500, wastageExpense: 5200, manualExpense: 14900 },
    { month: "2026-07", revenue: 236500, purchaseExpense: 114000, wastageExpense: 3100, manualExpense: 17600 },
    { month: "2026-08", revenue: 229000, purchaseExpense: 110500, wastageExpense: 4400, manualExpense: 15200 },
    { month: "2026-09", revenue: 247500, purchaseExpense: 118000, wastageExpense: 2900, manualExpense: 18100 },
];

const VIEW_MODES: { value: ViewMode; label: string }[] = [
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" },
    { value: "overall", label: "Overall" },
];

const ITEMS_PER_PAGE = 6;
const COLORS = { revenue: "#044d73", expense: "#f43f5e", profit: "#0ea5e9" };
const PIE_COLORS = ["#044d73", "#f59e0b", "#94a3b8"];

function formatMonthLabel(month: string): string {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function withDerived(r: MonthRow) {
    const totalExpense = r.purchaseExpense + r.wastageExpense + r.manualExpense;
    return { ...r, totalExpense, netProfit: r.revenue - totalExpense };
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AnalyticsPage() {
    const [viewMode, setViewMode] = useState<ViewMode>("monthly");
    const [startMonth, setStartMonth] = useState(MONTHS[0].month);
    const [endMonth, setEndMonth] = useState(MONTHS[MONTHS.length - 1].month);
    const [tablePage, setTablePage] = useState(1);

    useEffect(() => { setTablePage(1); }, [viewMode]);

    const filteredMonths = useMemo(
        () => MONTHS.filter(m => m.month >= startMonth && m.month <= endMonth).map(withDerived),
        [startMonth, endMonth]
    );

    const yearlyRows = useMemo(() => {
        const byYear = new Map<string, ReturnType<typeof withDerived>[]>();
        filteredMonths.forEach(m => {
            const y = m.month.slice(0, 4);
            byYear.set(y, [...(byYear.get(y) ?? []), m]);
        });
        return Array.from(byYear.entries()).map(([year, rows]) => {
            const sum = (k: keyof ReturnType<typeof withDerived>) => rows.reduce((s, r) => s + (r[k] as number), 0);
            return {
                label: year,
                revenue: sum("revenue"),
                purchaseExpense: sum("purchaseExpense"),
                wastageExpense: sum("wastageExpense"),
                manualExpense: sum("manualExpense"),
                totalExpense: sum("totalExpense"),
                netProfit: sum("netProfit"),
            };
        });
    }, [filteredMonths]);

    const overallRow = useMemo(() => {
        const sum = (k: keyof ReturnType<typeof withDerived>) => filteredMonths.reduce((s, r) => s + (r[k] as number), 0);
        return {
            label: "Overall",
            revenue: sum("revenue"),
            purchaseExpense: sum("purchaseExpense"),
            wastageExpense: sum("wastageExpense"),
            manualExpense: sum("manualExpense"),
            totalExpense: sum("totalExpense"),
            netProfit: sum("netProfit"),
        };
    }, [filteredMonths]);

    const tableRows = useMemo(() => {
        if (viewMode === "overall") return [overallRow];
        if (viewMode === "yearly") return [...yearlyRows].reverse();
        return [...filteredMonths.map(m => ({ ...m, label: formatMonthLabel(m.month) }))].reverse();
    }, [viewMode, filteredMonths, yearlyRows, overallRow]);

    const chartData = useMemo(() => {
        if (viewMode === "overall") return [{ label: "Overall", Revenue: overallRow.revenue, Expense: overallRow.totalExpense, "Net Profit": overallRow.netProfit }];
        if (viewMode === "yearly") return yearlyRows.map(y => ({ label: y.label, Revenue: y.revenue, Expense: y.totalExpense, "Net Profit": y.netProfit }));
        return filteredMonths.map(m => ({ label: formatMonthLabel(m.month), Revenue: m.revenue, Expense: m.totalExpense, "Net Profit": m.netProfit }));
    }, [viewMode, filteredMonths, yearlyRows, overallRow]);

    const pieData = useMemo(() => [
        { name: "Purchase", value: overallRow.purchaseExpense },
        { name: "Manual", value: overallRow.manualExpense },
        { name: "Wastage", value: overallRow.wastageExpense },
    ], [overallRow]);

    const tableTotalPages = Math.max(1, Math.ceil(tableRows.length / ITEMS_PER_PAGE));
    const paginatedRows = tableRows.slice((tablePage - 1) * ITEMS_PER_PAGE, tablePage * ITEMS_PER_PAGE);

    const isProfitPositive = overallRow.netProfit >= 0;

    const money = (v: number) => `Rs. ${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    const tooltipFormatter = (value: any, name: any) =>
        typeof value === "number" ? [money(value), name] : [value, name];

    return (
        <div className="flex flex-col gap-8">
            {/* Header */}
            <div className="rounded-xl bg-[#044d73] px-6 py-5 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
                </div>
                <div className="bg-white/10 border border-white/20 p-1 rounded-xl flex items-center gap-1">
                    {VIEW_MODES.map(m => (
                        <button
                            key={m.value}
                            onClick={() => setViewMode(m.value)}
                            className={`font-bold text-xs px-4 py-1.5 rounded-lg transition-all ${viewMode === m.value ? "bg-white text-[#044d73]" : "text-white/80 hover:text-white"
                                }`}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Range controls */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">Date Range</div>
                <div className="flex items-center gap-2 flex-wrap">
                    <input type="month" value={startMonth} onChange={e => setStartMonth(e.target.value)}
                        className="rounded-lg py-1.5 px-2.5 text-xs outline-none border border-slate-200 bg-white text-slate-700 focus:border-[#044d73]" />
                    <span className="text-xs text-slate-400">to</span>
                    <input type="month" value={endMonth} onChange={e => setEndMonth(e.target.value)}
                        className="rounded-lg py-1.5 px-2.5 text-xs outline-none border border-slate-200 bg-white text-slate-700 focus:border-[#044d73]" />
                </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border-l-4 border-l-[#044d73] border border-slate-200 bg-white p-5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Revenue</p>
                        <p className="text-3xl font-bold text-slate-800 mt-1">{money(overallRow.revenue)}</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#044d73]/10 text-[#044d73]">
                        <Wallet className="h-6 w-6" />
                    </div>
                </div>

                <div className="rounded-xl border-l-4 border-l-rose-500 border border-slate-200 bg-white p-5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Expense</p>
                        <p className="text-3xl font-bold text-slate-800 mt-1">{money(overallRow.totalExpense)}</p>

                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                        <Receipt className="h-6 w-6" />
                    </div>
                </div>

                <div className={`rounded-xl border-l-4 ${isProfitPositive ? "border-l-emerald-500" : "border-l-rose-500"} border border-slate-200 bg-white p-5 shadow-sm flex items-center justify-between`}>
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Net Profit</p>
                        <p className={`text-3xl font-bold mt-1 ${isProfitPositive ? "text-emerald-600" : "text-rose-600"}`}>
                            {money(overallRow.netProfit)}
                        </p>
                    </div>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${isProfitPositive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                        {isProfitPositive ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
                    </div>
                </div>
            </div>

            {/* Trend chart + expense split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Area + line combo chart */}
                <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#044d73]/10 flex items-center justify-center">
                            <TrendingUp className="w-3.5 h-3.5 text-[#044d73]" />
                        </div>
                        <span className="text-sm font-semibold text-slate-700">Revenue vs Expense</span>
                        <span className="text-xs text-slate-400">— {viewMode}</span>
                    </div>

                    {chartData.length === 0 ? (
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
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#044d73]/10 flex items-center justify-center">
                            <PieIcon className="w-3.5 h-3.5 text-[#044d73]" />
                        </div>
                        <span className="text-sm font-semibold text-slate-700">Expense Split</span>
                    </div>

                    {overallRow.totalExpense === 0 ? (
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
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Receipt className="w-4 h-4 text-slate-400" />
                        Breakdown
                    </div>
                    {tableRows.length > 0 && (
                        <span className="text-xs text-slate-400 font-medium">
                            {tableRows.length} {viewMode === "monthly" ? "months" : viewMode === "yearly" ? "years" : "row"}
                        </span>
                    )}
                </div>

                {tableRows.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">No data for this range.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    {["Period", "Revenue", "Purchase Exp.", "Wastage Exp.", "Manual Exp.", "Total Expense", "Net Profit"].map((h, i) => (
                                        <th key={h} className={`text-[10px] font-bold uppercase tracking-widest px-4 py-3 ${i === 0 ? "text-left" : "text-right"} text-slate-400`}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedRows.map(row => (
                                    <tr key={row.label} className="border-b last:border-0 border-slate-50 hover:bg-slate-50/60 transition-colors">
                                        <td className="px-4 py-3 font-semibold text-slate-800">{row.label}</td>
                                        <td className="px-4 py-3 text-right text-slate-700">{money(row.revenue)}</td>
                                        <td className="px-4 py-3 text-right text-slate-500">{money(row.purchaseExpense)}</td>
                                        <td className="px-4 py-3 text-right text-slate-500">{money(row.wastageExpense)}</td>
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