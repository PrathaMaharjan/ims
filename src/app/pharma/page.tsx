"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
    TrendingUp,
    TrendingDown,
    Wallet,
    Receipt,
    Calendar,
    Boxes,
    Package,
    AlertTriangle,
    ShoppingCart,
    Clock,
    Plus,
    ArrowUpRight,
    Users,
    BarChart3,
    CheckCircle2,
    DollarSign,
    Percent,
    RotateCcw,
} from "lucide-react";
import {
    ComposedChart,
    Area,
    Line,
    Bar,
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

/* ------------------------------------------------------------------ */
/* Types & Static Seed Data                                            */
/* ------------------------------------------------------------------ */

type ViewMode = "monthly" | "yearly" | "overall";

interface MonthMetric {
    month: string;
    label: string;
    revenue: number;
    purchaseCost: number;
    operatingExpense: number;
    salesCount: number;
    purchaseCount: number;
}

const TIMELINE_DATA: MonthMetric[] = [
    { month: "2026-01", label: "Jan 26", revenue: 185000, purchaseCost: 88000, operatingExpense: 17200, salesCount: 420, purchaseCount: 14 },
    { month: "2026-02", label: "Feb 26", revenue: 172000, purchaseCost: 82000, operatingExpense: 14600, salesCount: 390, purchaseCount: 12 },
    { month: "2026-03", label: "Mar 26", revenue: 204000, purchaseCost: 96000, operatingExpense: 20400, salesCount: 465, purchaseCount: 16 },
    { month: "2026-04", label: "Apr 26", revenue: 198500, purchaseCost: 92500, operatingExpense: 16000, salesCount: 440, purchaseCount: 15 },
    { month: "2026-05", label: "May 26", revenue: 221000, purchaseCost: 104000, operatingExpense: 20300, salesCount: 510, purchaseCount: 18 },
    { month: "2026-06", label: "Jun 26", revenue: 213000, purchaseCost: 98500, operatingExpense: 20100, salesCount: 480, purchaseCount: 17 },
    { month: "2026-07", label: "Jul 26", revenue: 236500, purchaseCost: 110000, operatingExpense: 20700, salesCount: 540, purchaseCount: 19 },
    { month: "2026-08", label: "Aug 26", revenue: 229000, purchaseCost: 106000, operatingExpense: 19600, salesCount: 525, purchaseCount: 18 },
    { month: "2026-09", label: "Sep 26", revenue: 247500, purchaseCost: 115000, operatingExpense: 21000, salesCount: 570, purchaseCount: 21 },
];

const YEARLY_DATA = [
    { year: "2024", label: "2024", revenue: 1890000, purchaseCost: 920000, operatingExpense: 185000 },
    { year: "2025", label: "2025", revenue: 2340000, purchaseCost: 1150000, operatingExpense: 215000 },
    { year: "2026", label: "2026 (YTD)", revenue: 1906500, purchaseCost: 892000, operatingExpense: 169900 },
];

const CATEGORY_SPLIT = [
    { name: "Antibiotics", value: 38, amount: 94050, color: "#044d73" },
    { name: "Analgesics & Pain", value: 24, amount: 59400, color: "#0ea5e9" },
    { name: "Gastro & Antacids", value: 18, amount: 44550, color: "#10b981" },
    { name: "Supplements", value: 12, amount: 29700, color: "#f59e0b" },
    { name: "Surgical & Others", value: 8, amount: 19800, color: "#94a3b8" },
];

const PAYMENT_METHODS = [
    { name: "Cash", percentage: 58, amount: 143550, color: "#044d73" },
    { name: "Fonepay / QR", percentage: 32, amount: 79200, color: "#10b981" },
    { name: "Credit / Due", percentage: 10, amount: 24750, color: "#f59e0b" },
];

const CRITICAL_ITEMS = [
    {
        name: "Cefixime 200 MG",
        brand: "Cipla",
        unit: "Tab",
        stock: 50,
        min: 100,
        batch: "AB2511015",
        exp: "Oct 2026",
        status: "Low Stock",
        statusCls: "bg-amber-50 text-amber-700 border-amber-200",
    },
    {
        name: "Absorbant Cotton Wool",
        brand: "Generic",
        unit: "Pcs",
        stock: 12,
        min: 20,
        batch: "CW-901",
        exp: "May 2028",
        status: "Low Stock",
        statusCls: "bg-amber-50 text-amber-700 border-amber-200",
    },
    {
        name: "Amoxicillin 500 MG",
        brand: "Alkem",
        unit: "Cap",
        stock: 140,
        min: 80,
        batch: "AMX-402",
        exp: "Nov 2026",
        status: "Expiring Soon",
        statusCls: "bg-rose-50 text-rose-700 border-rose-200",
    },
    {
        name: "Paracetamol 650 MG",
        brand: "Sun Pharma",
        unit: "Tab",
        stock: 25,
        min: 150,
        batch: "PC-881",
        exp: "Jan 2027",
        status: "Critical",
        statusCls: "bg-red-50 text-red-700 border-red-200",
    },
];

const RECENT_ACTIVITIES = [
    { id: "s-1", type: "Sale", vch: "VCH-1092", party: "Walk-in Patient", payment: "Cash", amount: 1450, time: "12 mins ago" },
    { id: "p-1", type: "Purchase", vch: "PUR-2026-003", party: "MedSupply Pvt. Ltd.", payment: "Credit", amount: 42800, time: "2 hours ago" },
    { id: "s-2", type: "Sale", vch: "VCH-1091", party: "Ram Shrestha", payment: "Fonepay / QR", amount: 3200, time: "3 hours ago" },
    { id: "e-1", type: "Expense", vch: "EXP-084", party: "Store Electricity & Power", payment: "Cash", amount: 8500, time: "Yesterday" },
    { id: "s-3", type: "Sale", vch: "VCH-1090", party: "Anita Sharma", payment: "Cash", amount: 820, time: "Yesterday" },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatMoney(amount: number): string {
    return "Rs. " + amount.toLocaleString("en-NP", { maximumFractionDigits: 0 });
}

export default function DashboardPage() {
    const [viewMode, setViewMode] = useState<ViewMode>("monthly");
    const [dateFrom, setDateFrom] = useState("2026-01");
    const [dateTo, setDateTo] = useState("2026-09");
    const [breakdownType, setBreakdownType] = useState<"category" | "payment">("category");

    // Filter timeline data based on date range
    const filteredTimeline = useMemo(() => {
        return TIMELINE_DATA.filter((d) => (!dateFrom || d.month >= dateFrom) && (!dateTo || d.month <= dateTo));
    }, [dateFrom, dateTo]);

    // Aggregate values based on viewMode and filters
    const stats = useMemo(() => {
        if (viewMode === "yearly") {
            const totalRev = YEARLY_DATA.reduce((s, y) => s + y.revenue, 0);
            const totalPur = YEARLY_DATA.reduce((s, y) => s + y.purchaseCost, 0);
            const totalExp = YEARLY_DATA.reduce((s, y) => s + y.operatingExpense, 0);
            const totalOutflow = totalPur + totalExp;
            const netProfit = totalRev - totalOutflow;
            const margin = totalRev > 0 ? ((netProfit / totalRev) * 100).toFixed(1) : "0";
            return {
                revenue: totalRev,
                purchaseCost: totalPur,
                operatingExpense: totalExp,
                totalOutflow,
                netProfit,
                margin,
                salesCount: 14500,
                purchaseCount: 420,
            };
        }

        // Monthly or Overall (using filtered timeline)
        const totalRev = filteredTimeline.reduce((s, m) => s + m.revenue, 0);
        const totalPur = filteredTimeline.reduce((s, m) => s + m.purchaseCost, 0);
        const totalExp = filteredTimeline.reduce((s, m) => s + m.operatingExpense, 0);
        const totalOutflow = totalPur + totalExp;
        const netProfit = totalRev - totalOutflow;
        const margin = totalRev > 0 ? ((netProfit / totalRev) * 100).toFixed(1) : "0";
        const totalSales = filteredTimeline.reduce((s, m) => s + m.salesCount, 0);
        const totalPurchases = filteredTimeline.reduce((s, m) => s + m.purchaseCount, 0);

        return {
            revenue: totalRev,
            purchaseCost: totalPur,
            operatingExpense: totalExp,
            totalOutflow,
            netProfit,
            margin,
            salesCount: totalSales,
            purchaseCount: totalPurchases,
        };
    }, [viewMode, filteredTimeline]);

    // Chart Data depending on viewMode
    const chartData = useMemo(() => {
        if (viewMode === "yearly") {
            return YEARLY_DATA.map((y) => {
                const totalOutflow = y.purchaseCost + y.operatingExpense;
                return {
                    label: y.label,
                    Revenue: y.revenue,
                    Expenses: totalOutflow,
                    "Net Profit": y.revenue - totalOutflow,
                };
            });
        }

        if (viewMode === "overall") {
            // Group by quarters or cumulative
            return [
                {
                    label: "Q1 (Jan-Mar)",
                    Revenue: 561000,
                    Expenses: 266000 + 52200,
                    "Net Profit": 561000 - (266000 + 52200),
                },
                {
                    label: "Q2 (Apr-Jun)",
                    Revenue: 632500,
                    Expenses: 295000 + 56400,
                    "Net Profit": 632500 - (295000 + 56400),
                },
                {
                    label: "Q3 (Jul-Sep)",
                    Revenue: 713000,
                    Expenses: 331000 + 61300,
                    "Net Profit": 713000 - (331000 + 61300),
                },
            ];
        }

        // Monthly view
        return filteredTimeline.map((m) => {
            const totalOutflow = m.purchaseCost + m.operatingExpense;
            return {
                label: m.label,
                Revenue: m.revenue,
                Expenses: totalOutflow,
                "Net Profit": m.revenue - totalOutflow,
            };
        });
    }, [viewMode, filteredTimeline]);

    const resetFilters = () => {
        setDateFrom("2026-01");
        setDateTo("2026-09");
        setViewMode("monthly");
    };

    return (
        <div className="flex flex-col gap-8 pb-12">
            {/* Header with View Mode Toggles */}
            <div className="rounded-xl bg-[#044d73] px-6 py-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

                </div>

                {/* View Mode Pill Switcher */}
                <div className="flex items-center gap-1.5 self-start md:self-auto rounded-xl bg-white/10 p-1 border border-white/20">
                    {(["monthly", "yearly", "overall"] as ViewMode[]).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => setViewMode(mode)}
                            className={`rounded-lg px-4 py-1.5 text-xs font-bold capitalize transition-all ${viewMode === mode
                                ? "bg-white text-[#044d73] shadow-sm"
                                : "text-white/80 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
            </div>

            {/* Filter & Date Range Bar */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <Calendar className="h-4 w-4 text-[#044d73]" />
                        <span>Date Range:</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="month"
                            value={dateFrom}
                            max={dateTo || undefined}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[#044d73]"
                        />
                        <span className="text-xs text-slate-400">to</span>
                        <input
                            type="month"
                            value={dateTo}
                            min={dateFrom || undefined}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[#044d73]"
                        />
                    </div>

                    {(dateFrom !== "2026-01" || dateTo !== "2026-09" || viewMode !== "monthly") && (
                        <button
                            type="button"
                            onClick={resetFilters}
                            className="flex items-center gap-1 text-xs text-[#044d73] hover:underline font-semibold ml-1"
                        >
                            <RotateCcw className="h-3 w-3" />
                            Reset
                        </button>
                    )}
                </div>


            </div>



            {/* KPI Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Revenue */}
                <div className="rounded-xl border-l-4 border-l-[#044d73] border border-slate-200 bg-white p-5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Sales</p>
                        <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1">{formatMoney(stats.revenue)}</p>
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-600 font-semibold">
                            <TrendingUp className="h-3.5 w-3.5" />
                            <span>+11.8%</span>
                            <span className="text-slate-400 font-normal">vs prev period</span>
                        </div>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#044d73]/10 text-[#044d73]">
                        <DollarSign className="h-6 w-6" />
                    </div>
                </div>

                {/* Net Profit */}
                <div className="rounded-xl border-l-4 border-l-emerald-500 border border-slate-200 bg-white p-5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Net Profit</p>
                        <p className="text-2xl sm:text-3xl font-bold text-emerald-600 mt-1">{formatMoney(stats.netProfit)}</p>
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 font-medium">
                            <span className="font-bold text-emerald-700">{stats.margin}%</span>
                            <span className="text-slate-400">profit margin</span>
                        </div>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                        <TrendingUp className="h-6 w-6" />
                    </div>
                </div>

                {/* Total Purchases & Expenses */}
                <div className="rounded-xl border-l-4 border-l-rose-500 border border-slate-200 bg-white p-5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Purchases & Outflow</p>
                        <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1">{formatMoney(stats.totalOutflow)}</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                            Pur: {formatMoney(stats.purchaseCost)} · Exp: {formatMoney(stats.operatingExpense)}
                        </p>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                        <Receipt className="h-6 w-6" />
                    </div>
                </div>

                {/* Critical Stock & Batch Alerts */}
                <div className="rounded-xl border-l-4 border-l-amber-500 border border-slate-200 bg-white p-5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Inventory Status</p>
                        <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1">128 Items</p>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                3 Low Stock
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                2 Expiring
                            </span>
                        </div>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                        <AlertTriangle className="h-6 w-6" />
                    </div>
                </div>
            </div>

            {/* Recharts Analytics Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Trends Chart (Area + Line) */}
                <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-4">
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

                    <div className="w-full h-80 pt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
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
                                <Area
                                    type="monotone"
                                    dataKey="Revenue"
                                    stroke="#044d73"
                                    strokeWidth={2.5}
                                    fill="url(#dashRevGrad)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="Expenses"
                                    stroke="#f43f5e"
                                    strokeWidth={2}
                                    fill="url(#dashExpGrad)"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="Net Profit"
                                    stroke="#10b981"
                                    strokeWidth={2.5}
                                    dot={{ r: 3.5, fill: "#10b981" }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Donut Chart: Sales Breakdown (Categories / Payment Types) */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between gap-4">
                    <div>
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
                            <h3 className="text-sm font-bold text-slate-900">Revenue Breakdown</h3>
                            <div className="flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold">
                                <button
                                    type="button"
                                    onClick={() => setBreakdownType("category")}
                                    className={`px-2 py-0.5 rounded-md transition-colors ${breakdownType === "category" ? "bg-white text-[#044d73] shadow-sm" : "text-slate-500"
                                        }`}
                                >
                                    Category
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBreakdownType("payment")}
                                    className={`px-2 py-0.5 rounded-md transition-colors ${breakdownType === "payment" ? "bg-white text-[#044d73] shadow-sm" : "text-slate-500"
                                        }`}
                                >
                                    Payment
                                </button>
                            </div>
                        </div>

                        <div className="h-52 w-full flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={breakdownType === "category" ? CATEGORY_SPLIT : PAYMENT_METHODS}
                                        dataKey={breakdownType === "category" ? "value" : "percentage"}
                                        nameKey="name"
                                        innerRadius={55}
                                        outerRadius={75}
                                        paddingAngle={3}
                                    >
                                        {(breakdownType === "category" ? CATEGORY_SPLIT : PAYMENT_METHODS).map((entry) => (
                                            <Cell key={entry.name} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(val: any, name: any) => [
                                            `${val}%`,
                                            name,
                                        ]}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                        {(breakdownType === "category" ? CATEGORY_SPLIT : PAYMENT_METHODS).map((item) => (
                            <div key={item.name} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span className="text-slate-600 font-medium">{item.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-400">
                                        {"value" in item ? `${item.value}%` : `${item.percentage}%`}
                                    </span>
                                    <span className="font-semibold text-slate-800">{formatMoney(item.amount)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Section: Critical Stock Watchlist & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Critical Stock & Expiry Watchlist */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <h3 className="text-sm font-bold text-slate-900">Critical Stock & Expiry Watchlist</h3>
                        </div>
                        <Link
                            href="/pharma/inventory"
                            className="text-xs font-semibold text-[#044d73] hover:underline flex items-center gap-1"
                        >
                            View All Items
                            <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {CRITICAL_ITEMS.map((item) => (
                            <div key={item.name} className="py-3 flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-xs font-bold text-slate-800 truncate">{item.name}</h4>
                                        <span className="text-[10px] font-semibold text-[#044d73] bg-[#044d73]/10 px-1.5 rounded">
                                            {item.brand}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                        Batch: {item.batch} · Exp: {item.exp}
                                    </p>
                                </div>

                                <div className="flex items-center gap-3 shrink-0 text-right">
                                    <div>
                                        <span className="text-xs font-bold text-slate-800 block">
                                            {item.stock} / {item.min} {item.unit}
                                        </span>
                                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.statusCls}`}>
                                            {item.status}
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
                    </div>
                </div>

                {/* Recent Activities */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-[#044d73]" />
                            <h3 className="text-sm font-bold text-slate-900">Recent Transactions</h3>
                        </div>
                        <Link
                            href="/pharma/analytics"
                            className="text-xs font-semibold text-[#044d73] hover:underline flex items-center gap-1"
                        >
                            Full Report
                            <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {RECENT_ACTIVITIES.map((act) => (
                            <div key={act.id} className="py-3 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div
                                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${act.type === "Sale"
                                            ? "bg-emerald-50 text-emerald-600"
                                            : act.type === "Purchase"
                                                ? "bg-[#044d73]/10 text-[#044d73]"
                                                : "bg-rose-50 text-rose-600"
                                            }`}
                                    >
                                        {act.type === "Sale" ? (
                                            <ShoppingCart className="h-4 w-4" />
                                        ) : act.type === "Purchase" ? (
                                            <Receipt className="h-4 w-4" />
                                        ) : (
                                            <Wallet className="h-4 w-4" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-800 truncate">{act.vch}</span>
                                            <span className="text-[10px] text-slate-400">({act.type})</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{act.party}</p>
                                    </div>
                                </div>

                                <div className="text-right shrink-0">
                                    <span className="text-xs font-bold text-slate-800 block">
                                        {formatMoney(act.amount)}
                                    </span>
                                    <div className="flex items-center justify-end gap-1.5 text-[10px] text-slate-400 mt-0.5">
                                        <span>{act.payment}</span>
                                        <span>•</span>
                                        <span>{act.time}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}