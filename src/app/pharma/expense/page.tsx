"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Check,
  Boxes,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { AnimatedStatValue } from "../_components/ui/animated-stat-value";

interface ExpenseCategory {
  id: string;
  name: string;
}

// Matches GET /expenses response shape
interface ApiExpense {
  id: string;
  categoryId: string | null;
  description: string | null;
  note: string | null;
  amount: string;
  expenseDate: string;
  category?: { id: string; name: string } | null;
}

// Extends ApiExpense with a source discriminator. Every row that actually
// comes from GET /expenses is "manual" — there is no inventory-sourced row
// yet. This field exists so a later integration (surfacing purchases here)
// can add "inventory" as a second source without restructuring this page.
type ExpenseSource = "manual" | "inventory";

interface DisplayExpense extends ApiExpense {
  source: ExpenseSource;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const ADD_NEW_VALUE = "__add_new__";
const PAGE_LIMIT = 8;
const SEARCH_DEBOUNCE_MS = 400;

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
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function emptyForm() {
  return {
    description: "",
    categoryId: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    note: "",
  };
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<DisplayExpense[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    totalPages: 1,
  });
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);

  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<DisplayExpense | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  // Client-side text search — applied to the current page only, since the
  // backend doesn't support free-text search on description/notes. This
  // stays purely manual for now; the inventory/purchase merge will come later.
  const [search, setSearch] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState<string>("All"); // server-side filter

  // Date range — server-side filter, debounced before hitting the network.
  const [dateFromInput, setDateFromInput] = useState("");
  const [dateToInput, setDateToInput] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const hasDateFilter = Boolean(dateFromInput || dateToInput);

  const [deleteTarget, setDeleteTarget] = useState<DisplayExpense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");

  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [manageNewCategoryInput, setManageNewCategoryInput] = useState("");
  const [manageError, setManageError] = useState<string | null>(null);
  const [confirmDeleteCategoryId, setConfirmDeleteCategoryId] = useState<
    string | null
  >(null);

  const [form, setForm] = useState(emptyForm());

  /* ---- debounce date range inputs before they hit the network ---- */

  useEffect(() => {
    const t = setTimeout(() => {
      setDateFrom(dateFromInput);
      setDateTo(dateToInput);
      setCurrentPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [dateFromInput, dateToInput]);

  /* ---- categories: fetched once, independent of expenses/pagination ---- */

  const loadCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const res = await api.get("/api/expenses/category");
      setCategories(res.data.expenseCategories);
    } catch {
      setLoadError("Failed to load expense categories.");
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  /* ---- expenses: server-driven pagination + category/date filters ---- */

  const loadExpenses = useCallback(async () => {
    setLoadingExpenses(true);
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        limit: PAGE_LIMIT,
      };
      if (categoryFilter !== "All") params.categoryId = categoryFilter;
      if (dateFrom && dateTo) {
        params.startDate = dateFrom;
        params.endDate = dateTo;
      }

      const res = await api.get("/api/expenses", { params });
      const tagged: DisplayExpense[] = res.data.expenses.map(
        (e: ApiExpense) => ({
          ...e,
          source: "manual" as const,
        }),
      );
      setExpenses(tagged);
      setPagination(res.data.pagination);
    } catch {
      setLoadError("Failed to load expenses.");
    } finally {
      setLoadingExpenses(false);
    }
  }, [currentPage, categoryFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  /* ---- client-side text filter, applied only to the already-loaded page ---- */

  const visibleExpenses = useMemo(() => {
    if (!search) return expenses;
    const q = search.toLowerCase();
    return expenses.filter(
      (e) =>
        (e.description ?? "").toLowerCase().includes(q) ||
        (e.category?.name ?? "").toLowerCase().includes(q) ||
        (e.note ?? "").toLowerCase().includes(q),
    );
  }, [expenses, search]);

  // Total spend for the current page only — a true global sum would need a
  // separate backend aggregate query across all pages/filters.
  const stats = useMemo(() => {
    const isInventory = (e: DisplayExpense) => e.category?.name === "Inventory";

    const manual = visibleExpenses.filter((e) => !isInventory(e));
    const inventory = visibleExpenses.filter((e) => isInventory(e));

    return {
      totalExpenses: pagination.total,
      pageSpend: visibleExpenses.reduce((s, e) => s + Number(e.amount), 0),
      manualCount: manual.length,
      manualSpend: manual.reduce((s, e) => s + Number(e.amount), 0),
      inventoryCount: inventory.length,
      inventorySpend: inventory.reduce((s, e) => s + Number(e.amount), 0),
    };
  }, [pagination.total, visibleExpenses]);

  /* ---- categories: create/delete ---- */

  async function createCategory(name: string): Promise<ExpenseCategory | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = categories.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return existing;
    try {
      const res = await api.post("/api/expenses/category", { name: trimmed });
      const created: ExpenseCategory = res.data.expenseCategory;
      setCategories((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      return created;
    } catch {
      return null;
    }
  }

  async function addNewCategory() {
    const created = await createCategory(newCategoryInput);
    if (created) setForm((p) => ({ ...p, categoryId: created.id }));
    setNewCategoryInput("");
    setIsAddingCategory(false);
  }

  async function handleAddCategoryFromManage() {
    const trimmed = manageNewCategoryInput.trim();
    if (!trimmed) return;
    setManageError(null);
    const created = await createCategory(trimmed);
    if (!created) {
      setManageError("Failed to add category.");
      return;
    }
    setManageNewCategoryInput("");
  }

  async function handleDeleteCategory(id: string) {
    setManageError(null);
    try {
      await api.delete(`/api/expenses/category/${id}`);
    } catch {
      setManageError(
        "Can't delete — this category may be in use, or something went wrong.",
      );
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
    setDateFromInput("");
    setDateToInput("");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  }

  /* ---- expense form ---- */

  function resetForm() {
    setForm(emptyForm());
    setEditingExpense(null);
    setErrorMsg(null);
    setIsAddingCategory(false);
    setNewCategoryInput("");
  }

  function handleOpenEdit(expense: DisplayExpense) {
    setEditingExpense(expense);
    setForm({
      description: expense.description ?? "",
      categoryId: expense.categoryId ?? "",
      amount: expense.amount,
      date: expense.expenseDate,
      note: expense.note ?? "",
    });
    setIsAddingCategory(false);
    setNewCategoryInput("");
    setIsModalOpen(true);
  }

  async function handleSaveExpense() {
    setErrorMsg(null);

    if (!form.description.trim() || !form.amount || !form.date) {
      setErrorMsg("Please fill in description, amount, and date.");
      return;
    }
    const amountNum = Number(form.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMsg("Enter a valid amount greater than 0.");
      return;
    }

    const payload = {
      categoryId: form.categoryId || undefined,
      description: form.description.trim(),
      note: form.note.trim() || undefined,
      amount: amountNum,
      expenseDate: form.date,
    };

    setSaving(true);
    try {
      if (editingExpense) {
        await api.patch(`/api/expenses/${editingExpense.id}`, payload);
      } else {
        await api.post("/api/expenses", payload);
        setCurrentPage(1);
      }
      resetForm();
      setIsModalOpen(false);
      await loadExpenses();
    } catch {
      setErrorMsg("Failed to save expense. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteExpense() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/expenses/${deleteTarget.id}`);
      setDeleteTarget(null);
      await loadExpenses();
    } catch {
      setLoadError("Failed to delete expense.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = pagination.totalPages;

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
          disabled={loadingCategories}
          className="flex items-center gap-2 bg-white text-[#044d73] hover:bg-slate-50 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Add Expense
        </button>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 border-l-4 border-l-slate-400 bg-white p-4 shadow-sm flex items-center justify-between sm:p-5">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Total Expenses
            </p>
            <p className="text-2xl font-bold text-slate-800 mt-1 sm:text-3xl">
              <AnimatedStatValue value={stats.totalExpenses} />
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-600 sm:h-12 sm:w-12">
            <Receipt className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 border-l-4 border-l-red-500 bg-white p-4 shadow-sm flex items-center justify-between sm:p-5">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Total Spend
            </p>
            <p className="text-2xl font-bold text-slate-800 mt-1 sm:text-3xl">
              <AnimatedStatValue
                value={stats.pageSpend}
                format={formatCurrency}
              />
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600 sm:h-12 sm:w-12">
            <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 border-l-4 border-l-[#044d73] bg-white p-4 shadow-sm flex items-center justify-between sm:p-5">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Manual send
            </p>
            <p className="text-2xl font-bold text-slate-800 mt-1 sm:text-3xl">
              <AnimatedStatValue
                value={stats.manualSpend}
                format={formatCurrency}
              />
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {stats.manualCount} entr{stats.manualCount !== 1 ? "ies" : "y"}
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#044d73]/10 text-[#044d73] sm:h-12 sm:w-12">
            <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 border-l-4 border-l-amber-500 bg-white p-4 shadow-sm flex items-center justify-between sm:p-5">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Inventory Spend
            </p>
            <p className="text-2xl font-bold text-slate-800 mt-1 sm:text-3xl">
              <AnimatedStatValue
                value={stats.inventorySpend}
                format={formatCurrency}
              />
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {stats.inventoryCount} entr
              {stats.inventoryCount !== 1 ? "ies" : "y"}
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 sm:h-12 sm:w-12">
            <Boxes className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>
      </div>

      {/* Control Actions Panel */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center w-full md:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search this page..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
            />
          </div>

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

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none sm:w-36">
              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={dateFromInput}
                max={dateToInput || undefined}
                onChange={(e) => setDateFromInput(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-2 text-sm text-slate-700 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                aria-label="From date"
              />
            </div>
            <span className="text-xs text-slate-400 shrink-0">to</span>
            <div className="relative flex-1 sm:flex-none sm:w-36">
              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={dateToInput}
                min={dateFromInput || undefined}
                onChange={(e) => setDateToInput(e.target.value)}
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
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Note</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingExpenses ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-sm text-slate-400"
                  >
                    Loading expenses...
                  </td>
                </tr>
              ) : visibleExpenses.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-sm text-slate-400"
                  >
                    No expenses recorded.
                  </td>
                </tr>
              ) : (
                visibleExpenses.map((expense) => (
                  <tr
                    key={expense.id}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#044d73]/10 text-[#044d73] border border-[#044d73]/15">
                          <Wallet className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-slate-900">
                          {expense.description || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        <Tag className="h-3 w-3" />
                        {expense.category?.name ?? "Uncategorized"}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-slate-500">
                      {formatDate(expense.expenseDate)}
                    </td>
                    <td className="py-4 px-4 text-slate-500 max-w-[220px]">
                      <span className="line-clamp-2">
                        {expense.note || "—"}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right font-semibold text-slate-800">
                      {formatCurrency(Number(expense.amount))}
                    </td>
                    <td className="py-4 px-4 text-right">
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="block md:hidden divide-y divide-slate-100">
          {loadingExpenses ? (
            <div className="py-12 text-center text-sm text-slate-400 px-4">
              Loading expenses...
            </div>
          ) : visibleExpenses.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400 px-4">
              No expenses recorded.
            </div>
          ) : (
            visibleExpenses.map((expense) => (
              <div
                key={expense.id}
                className="p-4 flex flex-col gap-4 bg-white"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#044d73]/10 text-[#044d73] border border-[#044d73]/15">
                      <Wallet className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900 text-sm">
                        {expense.description || "—"}
                      </h4>
                      <span className="inline-block text-xs text-slate-500 font-medium mt-0.5">
                        {expense.category?.name ?? "Uncategorized"}
                      </span>
                    </div>
                  </div>
                  <span className="font-semibold text-slate-800 text-sm">
                    {formatCurrency(Number(expense.amount))}
                  </span>
                </div>

                <div className="text-xs text-slate-500 bg-slate-50/50 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="text-slate-700 font-medium">
                      {formatDate(expense.expenseDate)}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="text-slate-600">
                      {expense.note || "No notes added"}
                    </span>
                  </div>
                </div>

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
              </div>
            ))
          )}
        </div>

        {/* Footer Pagination Controls */}
        {pagination.total > 0 && (
          <div className="flex flex-col gap-4 items-center justify-between border-t border-slate-100 bg-white px-6 py-4 sm:flex-row">
            <span className="text-xs text-slate-400">
              Page {currentPage} of {totalPages} · {pagination.total} total
              expense{pagination.total !== 1 ? "s" : ""}
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
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-20 disabled:pointer-events-none transition-colors touch-manipulation"
                title="Next Page"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Editor Modal Overlay */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm overflow-y-auto"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-xl bg-white shadow-xl border border-slate-100 overflow-hidden my-auto"
          >
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
                <label className="mb-1.5 block text-xs font-semibold text-slate-500 sm:text-sm sm:mb-2">
                  Description
                </label>
                <input
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="e.g. Electricity bill, equipment repair..."
                  className="w-full rounded-lg border border-slate-200/80 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400/80 bg-slate-50/30 focus:bg-white focus:border-[#044d73] focus:outline-none focus:ring-4 focus:ring-[#044d73]/10 transition-all"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500 sm:text-sm sm:mb-2">
                  Category
                </label>
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
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
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
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addNewCategory();
                        }
                        if (e.key === "Escape") {
                          setIsAddingCategory(false);
                          setNewCategoryInput("");
                        }
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
                      onClick={() => {
                        setIsAddingCategory(false);
                        setNewCategoryInput("");
                      }}
                      title="Cancel"
                      className="p-2.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500 sm:text-sm sm:mb-2">
                  Amount (NPR)
                </label>
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
                <label className="mb-1.5 block text-xs font-semibold text-slate-500 sm:text-sm sm:mb-2">
                  Date
                </label>
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
                <label className="mb-1.5 block text-xs font-semibold text-slate-500 sm:text-sm sm:mb-2">
                  Note
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <textarea
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
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
                disabled={saving}
                className="flex items-center justify-center gap-2 rounded-lg bg-[#044d73] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#033f60] disabled:opacity-50 w-full sm:w-auto"
              >
                {saving
                  ? "Saving..."
                  : editingExpense
                    ? "Save Changes"
                    : "Add Expense"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Categories Modal */}
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
              <p className="text-xs text-white/70">
                Add new categories or remove ones you no longer use.
              </p>
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

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={manageNewCategoryInput}
                  onChange={(e) => setManageNewCategoryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCategoryFromManage();
                    }
                  }}
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

              <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {loadingCategories ? (
                  <p className="p-4 text-center text-xs text-slate-400">
                    Loading categories...
                  </p>
                ) : categories.length === 0 ? (
                  <p className="p-4 text-center text-xs text-slate-400">
                    No categories yet — add one above.
                  </p>
                ) : (
                  categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-slate-700 min-w-0">
                        <Tag className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">{cat.name}</span>
                      </span>
                      {confirmDeleteCategoryId === cat.id ? (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="text-[11px] text-slate-400 mr-0.5">
                            Delete?
                          </span>
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
                  ))
                )}
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

      {/* Delete Confirmation Modal */}
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
                <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
                  Remove Expense
                </h2>
                <p className="mt-2 text-sm text-slate-500 px-2">
                  Are you sure you want to remove{" "}
                  <span className="font-semibold text-slate-700">
                    {deleteTarget.description}
                  </span>
                  ? This can&apos;t be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 border-t border-slate-100 p-4 bg-slate-50/50 sm:p-6">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteExpense}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
