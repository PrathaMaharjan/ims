"use client";

import { useState, useMemo } from "react";
import {
    Plus,
    Search,
    Wallet,
    Calendar,
    Tag,
    Tags,
    FileText,
    X,
    Pencil,
    Trash2,
    Receipt,
    TrendingDown,
    Package,
    ChevronLeft,
    ChevronRight,
    AlertTriangle,
    Check,
} from "lucide-react";

interface ExpenseCategory {
    id: string;
    name: string;
}

interface ExpenseItem {
    expenseId: string;
    description: string;
    category: string;
    categoryId: string | null;
    amount: number;
    date: string;
    notes: string | null;
    source: "manual" | "inventory";
    editable: boolean;
}

const ADD_NEW_VALUE = "__add_new__";
const ITEMS_PER_PAGE = 8;

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-NP", {
        style: "currency",
        currency: "NPR",
        maximumFractionDigits: 2,
    }).format(amount);
}

function formatDate(iso: string) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ------------------------------------------------------------------ */
/* Seed data — swap for a fetch once this page has a backend           */
/* ------------------------------------------------------------------ */

const SEED_CATEGORIES: ExpenseCategory[] = [
    { id: "c1", name: "Utilities" },
    { id: "c2", name: "Rent" },
    { id: "c3", name: "Maintenance" },
    { id: "c4", name: "Salaries" },
    { id: "c5", name: "Miscellaneous" },
];

const SEED_EXPENSES: ExpenseItem[] = [
    {
        expenseId: "e1", description: "Electricity Bill - September", category: "Utilities", categoryId: "c1",
        amount: 4500, date: "2026-09-05", notes: "NEA bill, includes late fee", source: "manual", editable: true,
    },
    {
        expenseId: "e2", description: "Shop Rent - September", category: "Rent", categoryId: "c2",
        amount: 25000, date: "2026-09-01", notes: null, source: "manual", editable: true,
    },
    {
        expenseId: "e3", description: "AC Servicing", category: "Maintenance", categoryId: "c3",
        amount: 1800, date: "2026-08-22", notes: "Annual maintenance contract", source: "manual", editable: true,
    },
    {
        expenseId: "e4", description: "Staff Salary - Ramesh", category: "Salaries", categoryId: "c4",
        amount: 18000, date: "2026-08-30", notes: null, source: "manual", editable: true,
    },
    {
        expenseId: "e5", description: "Purchase: Cefixime 200 MG (500 Tab)", category: "Inventory Restock", categoryId: null,
        amount: 4000, date: "2026-09-12", notes: "Auto-logged from Purchase Vch PUR-0001", source: "inventory", editable: false,
    },
];

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState<ExpenseItem[]>(SEED_EXPENSES);
    const [categories, setCategories] = useState<ExpenseCategory[]>(SEED_CATEGORIES);

    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
    const [search, setSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [categoryFilter, setCategoryFilter] = useState<string>("All");

    // Date range filter
    const [dateFrom, setDateFrom] = useState<string>("");
    const [dateTo, setDateTo] = useState<string>("");
    const hasDateFilter = Boolean(dateFrom || dateTo);

    const [deleteTarget, setDeleteTarget] = useState<ExpenseItem | null>(null);

    // Category creation state (inline, inside the Add/Edit Expense form)
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryInput, setNewCategoryInput] = useState("");

    // Manage Categories modal state
    const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
    const [manageNewCategoryInput, setManageNewCategoryInput] = useState("");
    const [manageError, setManageError] = useState<string | null>(null);
    const [confirmDeleteCategoryId, setConfirmDeleteCategoryId] = useState<string | null>(null);

    const [form, setForm] = useState({
        description: "",
        categoryId: "",
        amount: "",
        date: new Date().toISOString().slice(0, 10),
        notes: "",
    });

    /* ---- filter / stats / paginate — all client-side ---- */

    const filtered = useMemo(() => expenses.filter((e) => {
        const matchCategory =
            categoryFilter === "All" ||
            (categoryFilter === "inventory" ? e.source === "inventory" : e.categoryId === categoryFilter);
        const matchDate = (!dateFrom || e.date >= dateFrom) && (!dateTo || e.date <= dateTo);
        const q = search.toLowerCase();
        const matchSearch =
            !q ||
            e.description.toLowerCase().includes(q) ||
            e.category.toLowerCase().includes(q) ||
            (e.notes ?? "").toLowerCase().includes(q);
        return matchCategory && matchDate && matchSearch;
    }).sort((a, b) => b.date.localeCompare(a.date)), [expenses, categoryFilter, dateFrom, dateTo, search]);

    const stats = useMemo(() => ({
        totalExpenses: filtered.length,
        totalSpend: filtered.reduce((s, e) => s + e.amount, 0),
        fromInventory: filtered.filter((e) => e.source === "inventory").length,
        manualCount: filtered.filter((e) => e.source === "manual").length,
    }), [filtered]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    /* ---- categories ---- */

    function createCategory(name: string): ExpenseCategory | null {
        const trimmed = name.trim();
        if (!trimmed) return null;
        const existing = categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
        if (existing) return existing;
        const created: ExpenseCategory = { id: crypto.randomUUID(), name: trimmed };
        setCategories((prev) => [...prev, created]);
        return created;
    }

    function addNewCategory() {
        const created = createCategory(newCategoryInput);
        if (created) setForm((p) => ({ ...p, categoryId: created.id }));
        setNewCategoryInput("");
        setIsAddingCategory(false);
    }

    function handleAddCategoryFromManage() {
        const trimmed = manageNewCategoryInput.trim();
        if (!trimmed) return;
        setManageError(null);
        createCategory(trimmed);
        setManageNewCategoryInput("");
    }

    function handleDeleteCategory(id: string) {
        setManageError(null);
        const inUse = expenses.some((e) => e.categoryId === id);
        if (inUse) {
            setManageError("Can't delete — this category is used by existing expenses.");
            setConfirmDeleteCategoryId(null);
            return;
        }
        setCategories((prev) => prev.filter((c) => c.id !== id));
        if (form.categoryId === id) setForm((p) => ({ ...p, categoryId: "" }));
        if (categoryFilter === id) {
            setCategoryFilter("All");
            setCurrentPage(1);
        }
        setConfirmDeleteCategoryId(null);
    }

    function openManageCategories() {
        setManageError(null);
        setManageNewCategoryInput("");
        setConfirmDeleteCategoryId(null);
        setIsManageCategoriesOpen(true);
    }

    function clearDateFilter() {
        setDateFrom("");
        setDateTo("");
        setCurrentPage(1);
    }

    /* ---- expense form ---- */

    function resetForm() {
        setForm({
            description: "",
            categoryId: categories.length > 0 ? categories[0].id : "",
            amount: "",
            date: new Date().toISOString().slice(0, 10),
            notes: "",
        });
        setEditingExpense(null);
        setErrorMsg(null);
        setIsAddingCategory(false);
        setNewCategoryInput("");
    }

    function handleOpenEdit(expense: ExpenseItem) {
        if (!expense.editable || expense.source === "inventory") return;
        setEditingExpense(expense);
        setForm({
            description: expense.description,
            categoryId: expense.categoryId ?? "",
            amount: String(expense.amount),
            date: expense.date,
            notes: expense.notes ?? "",
        });
        setIsAddingCategory(false);
        setNewCategoryInput("");
        setIsModalOpen(true);
    }

    function handleSaveExpense() {
        setErrorMsg(null);

        if (!form.description.trim() || !form.amount || !form.date) {
            setErrorMsg("Please fill in description, amount, and date.");
            return;
        }
        if (!form.categoryId) {
            setErrorMsg("Please select an expense category.");
            return;
        }
        const amountNum = Number(form.amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            setErrorMsg("Enter a valid amount greater than 0.");
            return;
        }

        const categoryName = categories.find((c) => c.id === form.categoryId)?.name ?? "Uncategorized";

        if (editingExpense) {
            setExpenses((prev) => prev.map((e) => e.expenseId === editingExpense.expenseId ? {
                ...e,
                description: form.description.trim(),
                categoryId: form.categoryId,
                category: categoryName,
                amount: amountNum,
                date: form.date,
                notes: form.notes.trim() || null,
            } : e));
        } else {
            setExpenses((prev) => [...prev, {
                expenseId: crypto.randomUUID(),
                description: form.description.trim(),
                categoryId: form.categoryId,
                category: categoryName,
                amount: amountNum,
                date: form.date,
                notes: form.notes.trim() || null,
                source: "manual",
                editable: true,
            }]);
        }

        resetForm();
        setIsModalOpen(false);
    }

    function confirmDeleteExpense() {
        if (!deleteTarget) return;
        setExpenses((prev) => prev.filter((e) => e.expenseId !== deleteTarget.expenseId));
        setDeleteTarget(null);
    }

    return (
        <div className="flex flex-col gap-8">
            {/* Header */}
            <div className="rounded-xl bg-[#044d73] px-6 py-5 text-white shadow-sm flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
                </div>
                <button
                    onClick={() => {
                        resetForm();
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-white text-[#044d73] hover:bg-slate-50 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors"
                >
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                    Add Expense
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 border-l-4 border-l-slate-400 bg-white p-4 shadow-sm flex items-center justify-between sm:p-5">
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Expenses</p>
                        <p className="text-2xl font-bold text-slate-800 mt-1 sm:text-3xl">{stats.totalExpenses}</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-600 sm:h-12 sm:w-12">
                        <Receipt className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 border-l-4 border-l-red-500 bg-white p-4 shadow-sm flex items-center justify-between sm:p-5">
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Spend</p>
                        <p className="text-2xl font-bold text-slate-800 mt-1 sm:text-3xl">{formatCurrency(stats.totalSpend)}</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600 sm:h-12 sm:w-12">
                        <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 border-l-4 border-l-amber-500 bg-white p-4 shadow-sm flex items-center justify-between sm:p-5">
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">From Inventory</p>
                        <p className="text-2xl font-bold text-slate-800 mt-1 sm:text-3xl">{stats.fromInventory}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{stats.manualCount} manual</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 sm:h-12 sm:w-12">
                        <Package className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                </div>
            </div>

            {/* Control Actions Panel */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center w-full md:w-auto">
                    {/* Search */}
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                            placeholder="Search expenses..."
                            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                        />
                    </div>

                    {/* Category Filter + Manage */}
                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                        <select
                            value={categoryFilter}
                            onChange={(e) => {
                                setCategoryFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full sm:w-auto rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm text-slate-700 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                        >
                            <option value="All">All Categories</option>
                            <option value="inventory">Inventory (Restocks)</option>
                            {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={openManageCategories}
                            title="Manage Categories"
                            className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-500 hover:border-[#044d73] hover:text-[#044d73] hover:bg-[#044d73]/5 transition-colors"
                        >
                            <Tags className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Date Range Filter */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:flex-none sm:w-36">
                            <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                            <input
                                type="date"
                                value={dateFrom}
                                max={dateTo || undefined}
                                onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-2 text-sm text-slate-700 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                                aria-label="From date"
                            />
                        </div>
                        <span className="text-xs text-slate-400 shrink-0">to</span>
                        <div className="relative flex-1 sm:flex-none sm:w-36">
                            <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                            <input
                                type="date"
                                value={dateTo}
                                min={dateFrom || undefined}
                                onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-2 text-sm text-slate-700 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                                aria-label="To date"
                            />
                        </div>
                        {hasDateFilter && (
                            <button
                                onClick={clearDateFilter}
                                title="Clear date filter"
                                className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {errorMsg && !isModalOpen && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMsg}
                </div>
            )}

            {/* Data Section Container */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/50 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                                <th className="py-3 px-4">Description</th>
                                <th className="py-3 px-4">Category</th>
                                <th className="py-3 px-4">Date</th>
                                <th className="py-3 px-4">Notes</th>
                                <th className="py-3 px-4 text-right">Amount</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {paginated.map((expense) => (
                                <tr key={expense.expenseId} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="py-4 px-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#044d73]/10 text-[#044d73] border border-[#044d73]/15">
                                                {expense.source === "inventory" ? (
                                                    <Package className="h-4 w-4" />
                                                ) : (
                                                    <Wallet className="h-4 w-4" />
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-900">{expense.description}</span>
                                                {expense.source === "inventory" && (
                                                    <span className="text-xs text-amber-600 font-medium mt-0.5">Auto-logged from inventory</span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                                            <Tag className="h-3 w-3" />
                                            {expense.category}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4 text-slate-500">{formatDate(expense.date)}</td>
                                    <td className="py-4 px-4 text-slate-500 max-w-[220px]">
                                        <span className="line-clamp-2">{expense.notes || "—"}</span>
                                    </td>
                                    <td className="py-4 px-4 text-right font-semibold text-slate-800">
                                        {formatCurrency(expense.amount)}
                                    </td>
                                    <td className="py-4 px-4 text-right">
                                        {!expense.editable || expense.source === "inventory" ? (
                                            <span className="text-xs text-slate-300 italic pr-1">Locked</span>
                                        ) : (
                                            <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleOpenEdit(expense)}
                                                    className="rounded-md p-1.5 text-slate-400 hover:bg-[#044d73]/10 hover:text-[#044d73] transition-colors"
                                                    title="Edit Expense"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteTarget(expense)}
                                                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                    title="Remove Expense"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View */}
                <div className="block md:hidden divide-y divide-slate-100">
                    {paginated.map((expense) => (
                        <div key={expense.expenseId} className="p-4 flex flex-col gap-4 bg-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#044d73]/10 text-[#044d73] border border-[#044d73]/15">
                                        {expense.source === "inventory" ? (
                                            <Package className="h-4 w-4" />
                                        ) : (
                                            <Wallet className="h-4 w-4" />
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-slate-900 text-sm">{expense.description}</h4>
                                        <span className="inline-block text-xs text-slate-500 font-medium mt-0.5">{expense.category}</span>
                                    </div>
                                </div>
                                <span className="font-semibold text-slate-800 text-sm">
                                    {formatCurrency(expense.amount)}
                                </span>
                            </div>

                            <div className="text-xs text-slate-500 bg-slate-50/50 rounded-lg p-3 space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <span className="text-slate-700 font-medium">{formatDate(expense.date)}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                                    <span className="text-slate-600">{expense.notes || "No notes added"}</span>
                                </div>
                                {expense.source === "inventory" && (
                                    <div className="flex items-center gap-2 pt-1">
                                        <span className="text-xs text-amber-600 font-medium">Auto-logged from inventory</span>
                                    </div>
                                )}
                            </div>

                            {expense.editable && expense.source !== "inventory" && (
                                <div className="flex items-center justify-end gap-2 border-t border-slate-100/80 pt-3">
                                    <button
                                        onClick={() => handleOpenEdit(expense)}
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-200 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => setDeleteTarget(expense)}
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-red-100 py-2 text-xs font-medium text-red-600 bg-red-50/30 hover:bg-red-50 transition-colors"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Delete
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {filtered.length === 0 && (
                    <div className="py-12 text-center text-sm text-slate-400 px-4">
                        No expenses recorded.
                    </div>
                )}

                {/* Footer Pagination Controls */}
                {filtered.length > 0 && (
                    <div className="flex flex-col gap-4 items-center justify-between border-t border-slate-100 bg-white px-6 py-4 sm:flex-row">
                        <span className="text-xs text-slate-400">
                            Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filtered.length)}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} expense{filtered.length !== 1 ? "s" : ""}
                        </span>

                        <div className="flex items-center justify-between w-full sm:w-auto gap-6">
                            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                                Page {currentPage} of {totalPages}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-20 disabled:pointer-events-none transition-colors touch-manipulation"
                                    title="Previous Page"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-20 disabled:pointer-events-none transition-colors touch-manipulation"
                                    title="Next Page"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Editor Modal Overlay */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm overflow-y-auto" onClick={() => setIsModalOpen(false)}>
                    <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-xl bg-white shadow-xl border border-slate-100 overflow-hidden my-auto">
                        <div className="relative flex items-center justify-center bg-[#044d73] p-5 text-white sm:p-6">
                            <div className="hidden h-10 w-10 items-center justify-center text-white sm:flex">
                                <Wallet className="h-6 w-6" />
                            </div>
                            <h2 className="text-lg font-semibold text-white text-center sm:text-2xl">
                                {editingExpense ? "Edit Expense" : "Add New Expense"}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white transition-colors sm:right-6"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {errorMsg && (
                            <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-6 sm:mt-6">
                                {errorMsg}
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:gap-5 sm:p-6">
                            <div className="sm:col-span-2">
                                <label className="mb-1.5 block text-xs font-semibold text-slate-500 sm:text-sm sm:mb-2">Description</label>
                                <input
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="e.g. Electricity bill, equipment repair..."
                                    className="w-full rounded-lg border border-slate-200/80 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400/80 bg-slate-50/30 focus:bg-white focus:border-[#044d73] focus:outline-none focus:ring-4 focus:ring-[#044d73]/10 transition-all"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-slate-500 sm:text-sm sm:mb-2">Category</label>
                                {!isAddingCategory ? (
                                    <div className="relative">
                                        <select
                                            value={form.categoryId}
                                            onChange={(e) => {
                                                if (e.target.value === ADD_NEW_VALUE) {
                                                    setIsAddingCategory(true);
                                                } else {
                                                    setForm({ ...form, categoryId: e.target.value });
                                                }
                                            }}
                                            className="w-full appearance-none rounded-lg border border-slate-200/80 bg-slate-50/30 px-3 py-2.5 pr-9 text-sm text-slate-800 focus:bg-white focus:border-[#044d73] focus:outline-none focus:ring-4 focus:ring-[#044d73]/10 transition-all"
                                        >
                                            <option value="">Select Category</option>
                                            {categories.map((cat) => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                            <option value={ADD_NEW_VALUE}>+ Add New Category</option>
                                        </select>
                                        <Tag className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            autoFocus
                                            placeholder="New category name"
                                            value={newCategoryInput}
                                            onChange={(e) => setNewCategoryInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") { e.preventDefault(); addNewCategory(); }
                                                if (e.key === "Escape") { setIsAddingCategory(false); setNewCategoryInput(""); }
                                            }}
                                            className="flex-1 rounded-lg border border-slate-200/80 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400/80 bg-slate-50/30 focus:bg-white focus:border-[#044d73] focus:outline-none focus:ring-4 focus:ring-[#044d73]/10 transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={addNewCategory}
                                            title="Add category"
                                            className="p-2.5 rounded-lg bg-[#044d73] hover:bg-[#033f60] text-white transition-colors"
                                        >
                                            <Check className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setIsAddingCategory(false); setNewCategoryInput(""); }}
                                            title="Cancel"
                                            className="p-2.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-slate-500 sm:text-sm sm:mb-2">Amount (NPR)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.amount}
                                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                    placeholder="0.00"
                                    className="w-full rounded-lg border border-slate-200/80 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400/80 bg-slate-50/30 focus:bg-white focus:border-[#044d73] focus:outline-none focus:ring-4 focus:ring-[#044d73]/10 transition-all"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="mb-1.5 block text-xs font-semibold text-slate-500 sm:text-sm sm:mb-2">Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="date"
                                        value={form.date}
                                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                                        className="w-full rounded-lg border border-slate-200/80 py-2.5 pl-9 pr-3 text-sm text-slate-800 bg-slate-50/30 focus:bg-white focus:border-[#044d73] focus:outline-none focus:ring-4 focus:ring-[#044d73]/10 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="sm:col-span-2">
                                <label className="mb-1.5 block text-xs font-semibold text-slate-500 sm:text-sm sm:mb-2">Notes</label>
                                <div className="relative">
                                    <FileText className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <textarea
                                        value={form.notes}
                                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                        placeholder="Optional details — vendor, invoice number, reason, etc."
                                        rows={3}
                                        className="w-full resize-none rounded-lg border border-slate-200/80 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400/80 bg-slate-50/30 focus:bg-white focus:border-[#044d73] focus:outline-none focus:ring-4 focus:ring-[#044d73]/10 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 p-4 bg-slate-50/50 rounded-b-xl sm:flex-row sm:justify-end sm:gap-3 sm:p-6">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors w-full sm:w-auto"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveExpense}
                                className="flex items-center justify-center gap-2 rounded-lg bg-[#044d73] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#033f60] w-full sm:w-auto"
                            >
                                {editingExpense ? "Save Changes" : "Add Expense"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Manage Categories Modal — add and delete expense categories */}
            {isManageCategoriesOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
                    onClick={() => setIsManageCategoriesOpen(false)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-100 overflow-hidden"
                    >
                        <div className="relative flex flex-col items-center gap-1 bg-[#044d73] p-6 text-white">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 mb-1">
                                <Tags className="h-6 w-6" />
                            </div>
                            <h2 className="text-xl font-semibold">Manage Categories</h2>
                            <p className="text-xs text-white/70">Add new categories or remove ones you no longer use.</p>
                            <button
                                onClick={() => setIsManageCategoriesOpen(false)}
                                className="absolute right-5 top-5 rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {manageError && (
                                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                                    {manageError}
                                </div>
                            )}

                            {/* Add category */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={manageNewCategoryInput}
                                    onChange={(e) => setManageNewCategoryInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCategoryFromManage(); } }}
                                    placeholder="New category name"
                                    className="flex-1 rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddCategoryFromManage}
                                    disabled={!manageNewCategoryInput.trim()}
                                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#044d73] px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-[#033f60] disabled:opacity-40 transition-colors"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add
                                </button>
                            </div>

                            {/* Category list */}
                            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                                {categories.length === 0 ? (
                                    <p className="p-4 text-center text-xs text-slate-400">No categories yet — add one above.</p>
                                ) : categories.map((cat) => (
                                    <div key={cat.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                                        <span className="flex items-center gap-2 text-sm font-medium text-slate-700 min-w-0">
                                            <Tag className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                            <span className="truncate">{cat.name}</span>
                                        </span>
                                        {confirmDeleteCategoryId === cat.id ? (
                                            <div className="flex shrink-0 items-center gap-1.5">
                                                <span className="text-[11px] text-slate-400 mr-0.5">Delete?</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteCategory(cat.id)}
                                                    className="rounded-md bg-red-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-600"
                                                >
                                                    Yes
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmDeleteCategoryId(null)}
                                                    className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
                                                >
                                                    No
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setConfirmDeleteCategoryId(cat.id)}
                                                title="Delete category"
                                                className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end border-t border-slate-100 bg-slate-50/50 p-4">
                            <button
                                type="button"
                                onClick={() => setIsManageCategoriesOpen(false)}
                                className="rounded-lg bg-white border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal Overlay */}
            {deleteTarget && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
                    onClick={() => setDeleteTarget(null)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-100 overflow-hidden mx-auto"
                    >
                        <div className="flex flex-col items-center gap-3 p-6 text-center sm:gap-4 sm:p-8">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 sm:h-14 sm:w-14">
                                <AlertTriangle className="h-6 w-6 sm:h-7 sm:w-7" />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Remove Expense</h2>
                                <p className="mt-2 text-sm text-slate-500 px-2">
                                    Are you sure you want to remove{" "}
                                    <span className="font-semibold text-slate-700">{deleteTarget.description}</span>?
                                    This can&apos;t be undone.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-3 border-t border-slate-100 p-4 bg-slate-50/50 sm:p-6">
                            <button
                                type="button"
                                onClick={() => setDeleteTarget(null)}
                                className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteExpense}
                                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}