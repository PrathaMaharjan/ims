"use client";

import { useState, useMemo, useRef, useEffect, Fragment } from "react";
import {
  Plus,
  X,
  Pencil,
  Trash2,
  Search,
  Package,
  PackageCheck,
  PackageX,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Check,
  Boxes,
  ListFilter,
  FileText,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { AnimatedStatValue } from "../_components/ui/animated-stat-value";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type StockLevel = "in_stock" | "low_stock" | "out_of_stock";
type Num = number | "";

// Matches GET /products/:id/batches response shape
export interface ApiBatch {
  id: string;
  batchNumber: string;
  manufacturingDate: string | null;
  expiryDate: string;
  purchasePrice: string;
  mrp: string;
  salePrice: string | null;
  quantityReceived: number;
  quantityAvailable: number;
  status:
    | "ACTIVE"
    | "NEAR_EXPIRY"
    | "EXPIRED"
    | "RECALLED"
    | "QUARANTINED"
    | "DEPLETED";
  supplier?: { id: string; name: string } | null;
  note?: string | null;
  notes?: string | null;
  remarks?: string | null;
}

interface ItemForm {
  name: string;
  brand: string;
  category: string;
  alias: string;
  hsnCode: string;
  description: string;
  unit: string;
  altUnit: string;
  minStockLevel: Num;
}

// Matches GET /products (list) — includes the real stockQuantity/totalBatches
// summary computed server-side; the raw batches array is NOT part of the list
// response, only fetched on demand when viewing one item.
export interface Item {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  alias: string;
  hsnCode: string;
  description: string;
  unit: string;
  altUnit: string;
  minStockLevel: number;
  stockQuantity: number;
  totalBatches: number;
  totalStock: number;
}

interface Category {
  id: string;
  name: string;
}

interface ApiProduct {
  id: string;
  name: string;
  aliasName: string | null;
  manufacturer: string | null;
  categoryId: string | null;
  hsnCode: string | null;
  unit: string;
  alternativeUnit: string | null;
  lowStockThreshold: number | null;
  stockQuantity: number;
  isActive: boolean;
  description: string | null;
  totalBatches: number;
  totalStock: number;
}

/* ------------------------------------------------------------------ */
/* Defaults                                                            */
/* ------------------------------------------------------------------ */

const DEFAULT_UNITS = [
  "Pcs",
  "Tab",
  "Strip",
  "Box",
  "Bottle",
  "Vial",
  "Kg",
  "L",
  "ml",
];

const DEFAULT_BRANDS = [
  "Cipla",
  "Sun Pharma",
  "Torrent Pharma",
  "Alkem",
  "Abbott",
  "Deurali-Janta",
  "Nepal Pharmaceuticals",
  "Apex Healthcare",
  "Generic",
];

const EMPTY_FORM: ItemForm = {
  name: "",
  brand: "",
  category: "",
  alias: "",
  hsnCode: "",
  description: "",
  unit: "Pcs",
  altUnit: "",
  minStockLevel: "",
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const n = (v: Num) => (v === "" ? 0 : v);
const rs = (v: number) => `Rs. ${v.toFixed(2)}`;

function toItem(p: ApiProduct, categoryNameById: Map<string, string>): Item {
  return {
    id: p.id,
    name: p.name,
    brand: p.manufacturer ?? "",
    category: p.categoryId ? (categoryNameById.get(p.categoryId) ?? "") : "",
    alias: p.aliasName ?? "",
    hsnCode: p.hsnCode ?? "",
    description: p.description ?? "",
    unit: p.unit,
    altUnit: p.alternativeUnit ?? "",
    minStockLevel: p.lowStockThreshold ?? 0,
    stockQuantity: p.stockQuantity,
    totalBatches: p.totalBatches,
    totalStock: p.totalStock,
  };
}

// Real, cached-column stock — the same number the backend uses for purchase/sale math.
function getStockLevel(item: Item): StockLevel {
  if (item.stockQuantity <= 0) return "out_of_stock";
  if (item.stockQuantity <= item.minStockLevel) return "low_stock";
  return "in_stock";
}

const STOCK_STYLE: Record<
  StockLevel,
  { bg: string; text: string; dot: string; label: string }
> = {
  in_stock: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    label: "In Stock",
  },
  low_stock: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
    label: "Low Stock",
  },
  out_of_stock: {
    bg: "bg-red-50",
    text: "text-red-600",
    dot: "bg-red-500",
    label: "Out of Stock",
  },
};

function getBatchExpiryStatus(expDate: string): { label: string; cls: string } {
  if (!expDate)
    return {
      label: "No Date",
      cls: "text-slate-500 bg-slate-100 border-slate-200",
    };
  const today = new Date();
  const exp = new Date(expDate);
  const diffMonths =
    (exp.getFullYear() - today.getFullYear()) * 12 +
    (exp.getMonth() - today.getMonth());
  if (diffMonths < 0)
    return { label: "Expired", cls: "text-red-700 bg-red-50 border-red-200" };
  if (diffMonths <= 3)
    return {
      label: "Expiring Soon",
      cls: "text-amber-700 bg-amber-50 border-amber-200",
    };
  return {
    label: "Active",
    cls: "text-emerald-700 bg-emerald-50 border-emerald-200",
  };
}

/* ------------------------------------------------------------------ */
/* Small form building blocks (unchanged from before)                  */
/* ------------------------------------------------------------------ */

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 placeholder:text-slate-300 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]";
const labelCls =
  "mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide";

function Field({
  label,
  hint,
  span,
  children,
}: {
  label: string;
  hint?: string;
  span?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={span ? "sm:col-span-2" : ""}>
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <input
      type="text"
      required={required}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
    />
  );
}

function NumInput({
  value,
  onChange,
  step = "1",
  placeholder,
}: {
  value: Num;
  onChange: (v: Num) => void;
  step?: string;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      step={step}
      min={0}
      value={value}
      placeholder={placeholder}
      onChange={(e) =>
        onChange(e.target.value === "" ? "" : Number(e.target.value))
      }
      className={inputCls}
    />
  );
}

function CreatableSelect({
  value,
  options,
  onChange,
  onCreate,
  onDelete,
  noun,
  noneLabel,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  onCreate: (raw: string) => string | null | Promise<string | null>;
  onDelete?: (option: string) => void | Promise<void>;
  noun: string;
  noneLabel?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState(false);
  const [draft, setDraft] = useState("");
  const [manageSearch, setManageSearch] = useState("");
  const manageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        manageRef.current &&
        !manageRef.current.contains(event.target as Node)
      ) {
        setManaging(false);
      }
    }
    if (managing) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [managing]);

  function cancel() {
    setDraft("");
    setAdding(false);
  }
  async function commit() {
    const created = await onCreate(draft);
    if (created) onChange(created);
    cancel();
  }

  if (adding) {
    return (
      <div className="flex gap-2">
        <input
          autoFocus
          value={draft}
          placeholder={`New ${noun}`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          className={inputCls}
        />
        <button
          type="button"
          onClick={commit}
          title={`Add ${noun}`}
          className="shrink-0 rounded-lg bg-[#044d73] px-3.5 text-white hover:bg-[#033f60] transition-colors"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={cancel}
          title="Cancel"
          className="shrink-0 rounded-lg border border-slate-200 px-3.5 text-slate-500 hover:bg-slate-50 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const filteredManageOptions = options.filter((o) =>
    o.toLowerCase().includes(manageSearch.toLowerCase()),
  );

  return (
    <div className="relative flex gap-2">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      >
        {noneLabel !== undefined && <option value="">{noneLabel}</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => {
          setAdding(true);
          setManaging(false);
        }}
        title={`Add new ${noun}`}
        className="shrink-0 rounded-lg border border-slate-200 px-3 text-[#044d73] hover:bg-[#044d73]/10 transition-colors"
      >
        <Plus className="h-4 w-4" />
      </button>

      {onDelete && options.length > 0 && (
        <button
          type="button"
          onClick={() => setManaging((p) => !p)}
          title={`Manage / Delete ${noun}s`}
          className={`shrink-0 rounded-lg border px-2.5 transition-colors ${
            managing
              ? "border-[#044d73] bg-[#044d73] text-white"
              : "border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 hover:bg-slate-50"
          }`}
        >
          <ListFilter className="h-4 w-4" />
        </button>
      )}

      {managing && onDelete && (
        <div
          ref={manageRef}
          className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#044d73]">
              Manage {noun}s ({options.length})
            </span>
            <button
              type="button"
              onClick={() => setManaging(false)}
              className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {options.length > 5 && (
            <div className="mb-2">
              <input
                type="text"
                value={manageSearch}
                onChange={(e) => setManageSearch(e.target.value)}
                placeholder={`Filter ${noun}s...`}
                className="h-7 w-full rounded border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#044d73]"
              />
            </div>
          )}

          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredManageOptions.length === 0 ? (
              <p className="p-2 text-center text-xs text-slate-400">
                No {noun}s found
              </p>
            ) : (
              filteredManageOptions.map((opt) => (
                <div
                  key={opt}
                  className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs hover:bg-slate-50 transition-colors"
                >
                  <span
                    className={`truncate font-medium ${value === opt ? "text-[#044d73] font-semibold" : "text-slate-700"}`}
                  >
                    {opt}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDelete(opt)}
                    title={`Delete "${opt}"`}
                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<string[]>(DEFAULT_UNITS);
  const [brands, setBrands] = useState<string[]>(DEFAULT_BRANDS);
  const [categories, setCategories] = useState<Category[]>([]);

  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCatalog() {
      setLoadingCatalog(true);
      setCatalogError(null);
      try {
        // Products and categories are independent — fetch in parallel.
        const [productsRes, categoriesRes] = await Promise.all([
          api.get("/api/product"),
          api.get("/api/product/categories"),
        ]);
        const cats: Category[] = categoriesRes.data.categories;
        const categoryNameById = new Map(cats.map((c) => [c.id, c.name]));
        const apiProducts: ApiProduct[] = productsRes.data.products;
        setCategories(cats);
        setItems(apiProducts.map((p) => toItem(p, categoryNameById)));
      } catch {
        setCatalogError("Failed to load products/categories.");
      } finally {
        setLoadingCatalog(false);
      }
    }

    loadCatalog();
  }, []);

  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<"ALL" | StockLevel>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [viewingItem, setViewingItem] = useState<Item | null>(null);
  const [form, setForm] = useState<ItemForm>(EMPTY_FORM);

  // Batches for the item currently being viewed — fetched on demand,
  // not eagerly for every item in the list (would be N+1 otherwise).
  const [viewingBatches, setViewingBatches] = useState<ApiBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [batchesError, setBatchesError] = useState<string | null>(null);
  const [expandedBatchIds, setExpandedBatchIds] = useState<string[]>([]);

  function toggleBatchExpand(id: string) {
    setExpandedBatchIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const stats = useMemo(
    () => ({
      total: items.length,
      inStock: items.filter((i) => getStockLevel(i) === "in_stock").length,
      lowStock: items.filter((i) => getStockLevel(i) === "low_stock").length,
      outOfStock: items.filter((i) => getStockLevel(i) === "out_of_stock")
        .length,
    }),
    [items],
  );

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        const q = search.toLowerCase();
        const matchSearch =
          i.name.toLowerCase().includes(q) ||
          (i.brand && i.brand.toLowerCase().includes(q)) ||
          (i.category && i.category.toLowerCase().includes(q)) ||
          i.alias.toLowerCase().includes(q) ||
          i.hsnCode.toLowerCase().includes(q);
        const matchStock =
          stockFilter === "ALL" || getStockLevel(i) === stockFilter;
        const matchCategory =
          categoryFilter === "ALL" || i.category === categoryFilter;
        return matchSearch && matchStock && matchCategory;
      }),
    [items, search, stockFilter, categoryFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  /* ---- creatable list helpers ---- */

  function addUnit(raw: string): string | null {
    const name = raw.trim();
    if (!name) return null;
    const existing = units.find((o) => o.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    setUnits((prev) => [...prev, name]);
    return name;
  }

  function deleteUnit(unitToDelete: string) {
    setUnits((prev) => prev.filter((u) => u !== unitToDelete));
    if (form.unit === unitToDelete) setForm((p) => ({ ...p, unit: "" }));
    if (form.altUnit === unitToDelete) setForm((p) => ({ ...p, altUnit: "" }));
  }

  function addBrand(raw: string): string | null {
    const name = raw.trim();
    if (!name) return null;
    const existing = brands.find((o) => o.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    setBrands((prev) => [...prev, name]);
    return name;
  }

  function deleteBrand(brandToDelete: string) {
    setBrands((prev) => prev.filter((b) => b !== brandToDelete));
    if (form.brand === brandToDelete) setForm((p) => ({ ...p, brand: "" }));
  }

  async function addCategory(raw: string): Promise<string | null> {
    const name = raw.trim();
    if (!name) return null;
    const existing = categories.find(
      (c) => c.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) return existing.name;
    try {
      const res = await api.post("/api/product/categories", { name });
      const created: Category = res.data.category;
      setCategories((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      return created.name;
    } catch {
      return null;
    }
  }

  async function deleteCategory(categoryToDelete: string) {
    const category = categories.find((c) => c.name === categoryToDelete);
    if (!category) return;
    try {
      await api.delete(`/api/product/categories/${category.id}`);
    } catch {
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== category.id));
    if (form.category === categoryToDelete)
      setForm((p) => ({ ...p, category: "" }));
    if (categoryFilter === categoryToDelete) setCategoryFilter("ALL");
  }

  /* ---- item modal ---- */

  function setField<K extends keyof ItemForm>(key: K, value: ItemForm[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function openAdd() {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setSaveError(null);
    setIsModalOpen(true);
  }

  function openEdit(item: Item) {
    setEditingItem(item);
    setForm({
      name: item.name,
      brand: item.brand || "",
      category: item.category || "",
      alias: item.alias,
      hsnCode: item.hsnCode,
      description: item.description,
      unit: item.unit,
      altUnit: item.altUnit,
      minStockLevel: item.minStockLevel,
    });
    setSaveError(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingItem(null);
    setForm(EMPTY_FORM);
  }

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    const altUnit = form.altUnit === form.unit ? "" : form.altUnit;
    const matchedCategory = categories.find(
      (c) => c.name.toLowerCase() === form.category.trim().toLowerCase(),
    );
    const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

    const payload = {
      name: form.name.trim(),
      aliasName: form.alias.trim() || undefined,
      manufacturer: form.brand.trim() || undefined,
      categoryId: matchedCategory?.id,
      hsnCode: form.hsnCode.trim() || undefined,
      unit: form.unit || undefined,
      alternativeUnit: altUnit || undefined,
      lowStockThreshold: n(form.minStockLevel),
      description: form.description.trim() || undefined,
    };

    setSaving(true);
    setSaveError(null);
    try {
      if (editingItem) {
        const res = await api.patch(`/api/product/${editingItem.id}`, payload);
        const updated: ApiProduct = res.data.product;
        setItems((prev) =>
          prev.map((i) =>
            i.id === editingItem.id ? toItem(updated, categoryNameById) : i,
          ),
        );
      } else {
        const res = await api.post("/api/product", payload);
        const created: ApiProduct = res.data.product;
        setItems((prev) => [...prev, toItem(created, categoryNameById)]);
      }
      closeModal();
    } catch {
      setSaveError("Failed to save item. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/api/product/${id}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      setCatalogError("Failed to delete item. Please try again.");
    } finally {
      setDeleteConfirmId(null);
    }
  }

  // Opens the view modal and fetches this product's real batches on demand.
  async function openView(item: Item) {
    setViewingItem(item);
    setViewingBatches([]);
    setExpandedBatchIds([]);
    setBatchesError(null);
    setLoadingBatches(true);
    try {
      const res = await api.get(`/api/batches/${item.id}`);
      setViewingBatches(res.data.batches);
    } catch {
      setBatchesError("Failed to load batches for this item.");
    } finally {
      setLoadingBatches(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="rounded-xl bg-[#044d73] px-6 py-5 text-white shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        </div>
        <button
          onClick={openAdd}
          disabled={loadingCatalog}
          className="flex items-center gap-2 bg-white text-[#044d73] hover:bg-slate-50 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Add Item
        </button>
      </div>

      {catalogError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-600 font-medium">
          {catalogError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Items",
            value: stats.total,
            border: "border-l-slate-400",
            iconBg: "bg-slate-50 text-slate-600",
            icon: <Package className="h-5 w-5 sm:h-6 sm:w-6" />,
          },
          {
            label: "In Stock",
            value: stats.inStock,
            border: "border-l-emerald-500",
            iconBg: "bg-emerald-50 text-emerald-600",
            icon: <PackageCheck className="h-5 w-5 sm:h-6 sm:w-6" />,
          },
          {
            label: "Low Stock",
            value: stats.lowStock,
            border: "border-l-amber-500",
            iconBg: "bg-amber-50 text-amber-600",
            icon: <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />,
          },
          {
            label: "Out of Stock",
            value: stats.outOfStock,
            border: "border-l-red-500",
            iconBg: "bg-red-50 text-red-500",
            icon: <PackageX className="h-5 w-5 sm:h-6 sm:w-6" />,
          },
        ].map((s) => (
          <div
            key={s.label}
            className={`rounded-xl border-l-4 ${s.border} border border-slate-200 bg-white p-4 sm:p-5 shadow-sm flex items-center justify-between`}
          >
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">
                {s.label}
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1 break-all">
                <AnimatedStatValue value={s.value} />
              </p>
            </div>
            <div
              className={`flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl ${s.iconBg}`}
            >
              {s.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, brand, category, HSN"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 focus:border-[#044d73] focus:outline-none"
        >
          <option value="ALL">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={stockFilter}
          onChange={(e) => {
            setStockFilter(e.target.value as typeof stockFilter);
            setCurrentPage(1);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 focus:border-[#044d73] focus:outline-none"
        >
          <option value="ALL">All Stock</option>
          <option value="in_stock">In Stock</option>
          <option value="low_stock">Low Stock</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">Item & Brand</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">HSN Code</th>
                <th className="py-3 px-4">Unit</th>
                <th className="py-3 px-4">Total Stock</th>
                <th className="py-3 px-4">Batches</th>
                <th className="py-3 px-4">Threshold</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingCatalog ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-16 text-center text-sm text-slate-400"
                  >
                    Loading inventory...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-16 text-center text-sm text-slate-400"
                  >
                    No items match criteria.
                  </td>
                </tr>
              ) : (
                paginated.map((item) => {
                  const stockLevel = getStockLevel(item);
                  const stockStyle = STOCK_STYLE[stockLevel];
                  return (
                    <tr
                      key={item.id}
                      onClick={() => openView(item)}
                      className="hover:bg-slate-50/80 transition-colors text-slate-700 cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 group-hover:text-[#044d73] transition-colors">
                            {item.name}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {item.brand && (
                              <span className="inline-flex items-center text-[10px] font-bold text-[#044d73] bg-[#044d73]/10 px-1.5 py-0.2 rounded border border-[#044d73]/20">
                                {item.brand}
                              </span>
                            )}
                            {item.alias && (
                              <span className="text-[11px] text-slate-400">
                                {item.alias}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {item.category ? (
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {item.category}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {item.hsnCode || "—"}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {item.unit}
                        {item.altUnit && (
                          <span className="text-xs text-slate-400">
                            {" "}
                            / {item.altUnit}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800">
                          {item.stockQuantity}{" "}
                          <span className="text-xs font-normal text-slate-400">
                            {item.unit}
                          </span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {item.totalBatches > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#044d73]/10 px-2 py-0.5 text-xs font-medium text-[#044d73]">
                            <Boxes className="w-3 h-3" /> {item.totalBatches}{" "}
                            batch{item.totalBatches !== 1 ? "es" : ""}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">
                            0 batches
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {item.minStockLevel} {item.unit}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${stockStyle.bg} ${stockStyle.text}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${stockStyle.dot}`}
                          />
                          {stockStyle.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(item);
                            }}
                            title="Edit Item"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#044d73] hover:bg-[#044d73]/10 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(item.id);
                            }}
                            title="Delete"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="flex flex-col gap-4 items-center justify-between border-t border-slate-100 bg-white px-6 py-4 sm:flex-row">
            <span className="text-xs text-slate-400">
              Showing{" "}
              {Math.min(
                (currentPage - 1) * ITEMS_PER_PAGE + 1,
                filtered.length,
              )}
              –{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of{" "}
              {filtered.length} item{filtered.length !== 1 ? "s" : ""}
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
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-xl shadow-xl overflow-hidden">
            <div className="flex flex-col items-center text-center gap-3 p-6 border-b border-slate-100">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <Trash2 className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Delete Item?
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3 p-6">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 bg-slate-50 border border-slate-200 text-slate-600 font-medium text-sm py-2.5 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 bg-red-500 text-white font-semibold text-sm py-2.5 rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Item Details Modal (Complete Info & Batches) */}
      {viewingItem &&
        (() => {
          const stockLevel = getStockLevel(viewingItem);
          const stockStyle = STOCK_STYLE[stockLevel];

          return (
            <div
              className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setViewingItem(null)}
            >
              <div
                className="bg-white border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative flex shrink-0 items-center justify-between p-6 bg-[#044d73] text-white">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                      <Package className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-semibold">
                          {viewingItem.name}
                        </h3>
                        {viewingItem.brand && (
                          <span className="rounded-md bg-white/20 px-2 py-0.5 text-xs font-bold text-white border border-white/25">
                            {viewingItem.brand}
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${stockStyle.bg} ${stockStyle.text}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${stockStyle.dot}`}
                          />
                          {stockStyle.label}
                        </span>
                      </div>
                      <p className="text-xs text-white/70 mt-0.5">
                        {viewingItem.category
                          ? `Category: ${viewingItem.category} · `
                          : ""}
                        {viewingItem.alias
                          ? `Alias: ${viewingItem.alias} · `
                          : ""}
                        HSN: {viewingItem.hsnCode || "—"} · Unit:{" "}
                        {viewingItem.unit}
                        {viewingItem.altUnit ? ` / ${viewingItem.altUnit}` : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewingItem(null)}
                    className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Total Available Stock
                      </span>
                      <span className="text-xl font-bold text-slate-800 mt-1 block">
                        {viewingItem.stockQuantity}{" "}
                        <span className="text-xs font-normal text-slate-500">
                          {viewingItem.unit}
                        </span>
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Batches Recorded
                      </span>
                      <span className="text-xl font-bold text-slate-800 mt-1 block">
                        {viewingItem.totalBatches}{" "}
                        <span className="text-xs font-normal text-slate-500">
                          batch{viewingItem.totalBatches !== 1 ? "es" : ""}
                        </span>
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Low Stock Threshold
                      </span>
                      <span className="text-xl font-bold text-slate-800 mt-1 block">
                        {viewingItem.minStockLevel}{" "}
                        <span className="text-xs font-normal text-slate-500">
                          {viewingItem.unit}
                        </span>
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Category & Brand
                      </span>
                      <span className="text-xs font-semibold text-slate-800 mt-2 block truncate">
                        {viewingItem.category || "Uncategorized"}{" "}
                        {viewingItem.brand ? `(${viewingItem.brand})` : ""}
                      </span>
                    </div>
                  </div>

                  {viewingItem.description && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Description
                      </h4>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {viewingItem.description}
                      </p>
                    </div>
                  )}

                  {/* Batches — fetched on demand for this specific product */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#044d73] flex items-center gap-1.5">
                        <Boxes className="w-4 h-4" /> Added Batches & Stock per
                        Batch
                      </h4>
                      <span className="text-xs text-slate-400">
                        Click on a batch to view notes & remarks
                      </span>
                    </div>

                    {loadingBatches ? (
                      <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/50">
                        <p className="text-sm text-slate-400">
                          Loading batches...
                        </p>
                      </div>
                    ) : batchesError ? (
                      <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-600">
                        {batchesError}
                      </div>
                    ) : viewingBatches.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/50">
                        <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-slate-600">
                          No batches added yet
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Batches and stock are automatically created when
                          recording purchase deliveries in the Purchase page.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                              <th className="py-2.5 px-3">Batch No</th>
                              <th className="py-2.5 px-3">Current Stock</th>
                              <th className="py-2.5 px-3">Expiry Date</th>
                              <th className="py-2.5 px-3">Mfg Date</th>
                              <th className="py-2.5 px-3">Purchase Rate</th>
                              <th className="py-2.5 px-3">M.R.P.</th>
                              <th className="py-2.5 px-3">Sale Price</th>
                              <th className="py-2.5 px-3">Supplier</th>
                              <th className="py-2.5 px-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {viewingBatches.map((b) => {
                              const expStatus = getBatchExpiryStatus(
                                b.expiryDate,
                              );
                              const isExpanded = expandedBatchIds.includes(
                                b.id,
                              );
                              return (
                                <Fragment key={b.id}>
                                  <tr
                                    onClick={() => toggleBatchExpand(b.id)}
                                    title="Click to view batch notes"
                                    className="group cursor-pointer hover:bg-slate-50/80 transition-colors"
                                  >
                                    <td className="py-3 px-3">
                                      <span className="inline-flex items-center gap-1 font-bold text-slate-800 bg-[#044d73]/10 text-[#044d73] px-2 py-0.5 rounded border border-[#044d73]/20 group-hover:bg-[#044d73]/20 transition-colors">
                                        <Boxes className="w-3 h-3" />{" "}
                                        {b.batchNumber}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3 font-bold text-slate-900 text-sm">
                                      {b.quantityAvailable}{" "}
                                      <span className="text-xs font-normal text-slate-500">
                                        {viewingItem.unit}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3 font-medium text-slate-700">
                                      {b.expiryDate}
                                    </td>
                                    <td className="py-3 px-3 text-slate-500">
                                      {b.manufacturingDate || "—"}
                                    </td>
                                    <td className="py-3 px-3 text-slate-600">
                                      {rs(Number(b.purchasePrice))}
                                    </td>
                                    <td className="py-3 px-3 text-slate-600">
                                      {rs(Number(b.mrp))}
                                    </td>
                                    <td className="py-3 px-3 font-semibold text-slate-700">
                                      {b.salePrice
                                        ? rs(Number(b.salePrice))
                                        : "—"}
                                    </td>
                                    <td className="py-3 px-3 text-slate-500">
                                      {b.supplier?.name || "—"}
                                    </td>
                                    <td className="py-3 px-3">
                                      <span
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border ${expStatus.cls}`}
                                      >
                                        {expStatus.label}
                                      </span>
                                    </td>
                                  </tr>

                                  {isExpanded && (
                                    <tr className="bg-slate-50/60 border-b border-slate-100 animate-in fade-in duration-150">
                                      <td
                                        colSpan={9}
                                        className="py-3 px-6 pl-10"
                                      >
                                        <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
                                          <FileText className="h-4 w-4 text-[#044d73] shrink-0 mt-0.5" />
                                          <div className="space-y-1 min-w-0">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                              Batch Note & Remarks
                                            </span>
                                            <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                                              {b.note || (
                                                <span className="italic text-slate-400">
                                                  No notes recorded for this
                                                  batch.
                                                </span>
                                              )}
                                            </p>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 bg-white p-4 px-6">
                  <button
                    type="button"
                    onClick={() => {
                      const itm = viewingItem;
                      setViewingItem(null);
                      openEdit(itm);
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-[#044d73]/30 bg-[#044d73]/5 hover:bg-[#044d73]/10 px-4 py-2 text-xs font-semibold text-[#044d73] transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit Item Information
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingItem(null)}
                    className="rounded-lg bg-slate-100 hover:bg-slate-200 px-5 py-2 text-xs font-semibold text-slate-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Add / Edit Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden">
            <div className="relative flex shrink-0 flex-col items-center gap-1 p-8 bg-[#044d73] text-white">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 mb-2">
                <Package className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-semibold">
                {editingItem ? "Edit Item" : "Add New Item"}
              </h3>
              <p className="text-sm text-white/70">
                {editingItem
                  ? "Update the item's details below."
                  : "Fill in the details to add an item to inventory."}
              </p>
              <button
                type="button"
                onClick={closeModal}
                className="absolute right-6 top-6 rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSave}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="flex-1 space-y-6 overflow-y-auto p-8">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field label="Item Name" span>
                    <TextInput
                      required
                      value={form.name}
                      onChange={(v) => setField("name", v)}
                      placeholder="e.g. Cefixime 200 MG"
                    />
                  </Field>
                  <Field
                    label="Brand / Manufacturer"
                    hint="Pick existing, click + to add new, or use list button to manage/delete"
                  >
                    <CreatableSelect
                      value={form.brand}
                      options={brands}
                      noun="brand"
                      noneLabel="Select / None"
                      onChange={(v) => setField("brand", v)}
                      onCreate={addBrand}
                      onDelete={deleteBrand}
                    />
                  </Field>
                  <Field
                    label="Category"
                    hint="Pick existing, click + to add new, or use list button to manage/delete"
                  >
                    <CreatableSelect
                      value={form.category}
                      options={categories.map((c) => c.name)}
                      noun="category"
                      noneLabel="Select / None"
                      onChange={(v) => setField("category", v)}
                      onCreate={addCategory}
                      onDelete={deleteCategory}
                    />
                  </Field>
                  <Field label="Alias Name">
                    <TextInput
                      value={form.alias}
                      onChange={(v) => setField("alias", v)}
                      placeholder="Short name"
                    />
                  </Field>
                  <Field label="HSN Code">
                    <TextInput
                      value={form.hsnCode}
                      onChange={(v) => setField("hsnCode", v)}
                      placeholder="e.g. 3004"
                    />
                  </Field>
                  <Field label="Unit">
                    <CreatableSelect
                      value={form.unit}
                      options={units}
                      noun="unit"
                      onChange={(v) => setField("unit", v)}
                      onCreate={addUnit}
                      onDelete={deleteUnit}
                    />
                  </Field>
                  <Field label="Alternative Unit">
                    <CreatableSelect
                      value={form.altUnit}
                      options={units.filter((u) => u !== form.unit)}
                      noun="unit"
                      noneLabel="None"
                      onChange={(v) => setField("altUnit", v)}
                      onCreate={addUnit}
                      onDelete={deleteUnit}
                    />
                  </Field>
                  <Field
                    label="Low Stock Threshold"
                    hint="Item is flagged “Low Stock” at or below this quantity"
                    span
                  >
                    <NumInput
                      value={form.minStockLevel}
                      onChange={(v) => setField("minStockLevel", v)}
                    />
                  </Field>
                  <Field label="Item Description" span>
                    <textarea
                      rows={3}
                      value={form.description}
                      onChange={(e) => setField("description", e.target.value)}
                      className={inputCls}
                      placeholder="Brief clinical description or dosage information"
                    />
                  </Field>
                </div>
              </div>

              {saveError && (
                <div className="mx-8 mb-4 rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-600 font-medium">
                  {saveError}
                </div>
              )}

              <div className="flex shrink-0 gap-3 border-t border-slate-100 bg-white p-5 px-8">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-[#044d73] hover:bg-[#033f60] py-3 text-sm font-medium text-white shadow-sm transition-colors disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingItem
                      ? "Save Changes"
                      : "Save Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
