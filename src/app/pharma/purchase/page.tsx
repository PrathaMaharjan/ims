"use client";

import { useState, useMemo, useRef, useEffect, Fragment } from "react";
import {
  Plus, X, Pencil, Trash2, Search, ChevronDown,
  Receipt, Wallet, CreditCard, Banknote, PackagePlus, Percent, Boxes, Check,
  AlertCircle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Num = number | "";
type PaymentType = "Cash" | "Credit";
type PurcType = "VAT/Exempt" | "VAT/Item-wise" | "VAT/TaxIncl.";
type DiscountType = "Percentage" | "Flat";

interface CatalogItem {
  id: string;
  name: string;
  unit: string;
  altUnit: string;
  batchTracking: boolean;
  lastPurchasePrice: number;
  stock: number;
}

interface BatchDetails {
  batchNo: string;
  qty: Num;
  mfgDate: string;
  expDate: string;
  mrp: Num;
  salePrice: Num;
}

interface LineItemForm {
  id: string;
  itemId: string;
  itemName: string;
  unit: string;
  altUnit: string;
  batchTracking: boolean;
  qty: Num;
  price: Num;
  batch: BatchDetails | null;
}

interface DiscountRowForm {
  id: string;
  amount: Num;
  type: DiscountType;
}

interface PurchaseForm {
  date: string;
  vchNo: string;
  paymentType: PaymentType;
  purcType: PurcType;
  vendor: string;
  items: LineItemForm[];
  discounts: DiscountRowForm[];
}

interface Purchase {
  id: string;
  date: string;
  vchNo: string;
  paymentType: PaymentType;
  purcType: PurcType;
  vendor: string;
  items: LineItemForm[];
  discounts: DiscountRowForm[];
}

/* ------------------------------------------------------------------ */
/* Catalog — mirrors inventory products                                */
/* ------------------------------------------------------------------ */

const CATALOG: CatalogItem[] = [
  { id: "1", name: "Cefixime 200 MG", unit: "Tab", altUnit: "Strip", batchTracking: true, lastPurchasePrice: 8, stock: 500 },
  { id: "2", name: "Absorbant Cotton Wool", unit: "Pcs", altUnit: "", batchTracking: false, lastPurchasePrice: 5, stock: 45 },
  { id: "3", name: "Pregabalin 75 MG", unit: "Tab", altUnit: "Strip", batchTracking: true, lastPurchasePrice: 1.5, stock: 3200 },
];

function emptyBatch(qty: Num = ""): BatchDetails {
  return { batchNo: "", qty, mfgDate: "", expDate: "", mrp: "", salePrice: "" };
}

function emptyLine(): LineItemForm {
  return {
    id: crypto.randomUUID(),
    itemId: "",
    itemName: "",
    unit: "",
    altUnit: "",
    batchTracking: false,
    qty: "",
    price: "",
    batch: null,
  };
}

function emptyDiscount(): DiscountRowForm {
  return { id: crypto.randomUUID(), amount: "", type: "Percentage" };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(nextVchNo: string): PurchaseForm {
  return {
    date: todayISO(),
    vchNo: nextVchNo,
    paymentType: "Cash",
    purcType: "VAT/Exempt",
    vendor: "",
    items: [emptyLine()],
    discounts: [],
  };
}

/* ------------------------------------------------------------------ */
/* Seed data                                                           */
/* ------------------------------------------------------------------ */

const SEED_PURCHASES: Purchase[] = [
  {
    id: "p1",
    date: "2026-09-12",
    vchNo: "PUR-0001",
    paymentType: "Credit",
    purcType: "VAT/Item-wise",
    vendor: "MedSupply Pvt. Ltd.",
    items: [
      {
        id: "l1",
        itemId: "1",
        itemName: "Cefixime 200 MG",
        unit: "Tab",
        altUnit: "Strip",
        batchTracking: true,
        qty: 500,
        price: 8,
        batch: { batchNo: "AB2511015", qty: 500, mfgDate: "2026-07", expDate: "2027-10", mrp: 12, salePrice: 10 },
      },
    ],
    discounts: [{ id: "d1", amount: 5, type: "Percentage" }],
  },
  {
    id: "p2",
    date: "2026-09-18",
    vchNo: "PUR-0002",
    paymentType: "Cash",
    purcType: "VAT/Exempt",
    vendor: "City Pharma Distributors",
    items: [
      {
        id: "l2",
        itemId: "2",
        itemName: "Absorbant Cotton Wool",
        unit: "Pcs",
        altUnit: "",
        batchTracking: false,
        qty: 100,
        price: 5,
        batch: null,
      },
    ],
    discounts: [],
  },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const n = (v: Num) => (v === "" ? 0 : v);
const rs = (v: number) => `Rs. ${v.toFixed(2)}`;

function lineAmount(li: LineItemForm) {
  return n(li.qty) * n(li.price);
}
function subtotalOf(items: LineItemForm[]) {
  return items.reduce((s, li) => s + lineAmount(li), 0);
}
function discountValue(d: DiscountRowForm, subtotal: number) {
  return d.type === "Percentage" ? (subtotal * n(d.amount)) / 100 : n(d.amount);
}
function totalDiscountOf(discounts: DiscountRowForm[], subtotal: number) {
  return discounts.reduce((s, d) => s + discountValue(d, subtotal), 0);
}
function grandTotalOf(p: { items: LineItemForm[]; discounts: DiscountRowForm[] }) {
  const sub = subtotalOf(p.items);
  return sub - totalDiscountOf(p.discounts, sub);
}
function nextVchNo(purchases: Purchase[]) {
  const nums = purchases.map(p => Number(p.vchNo.replace(/\D/g, "")) || 0);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `PUR-${String(next).padStart(4, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Form UI Components                                                  */
/* ------------------------------------------------------------------ */

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-300 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]";
const labelCls = "mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide";

function Section({ title, icon, children, action }: { title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-1.5">
        <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#044d73]">
          {icon} {title}
        </h4>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, span, children }: { label: string; hint?: string; span?: boolean; children: React.ReactNode }) {
  return (
    <div className={span ? "sm:col-span-2" : ""}>
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, required }: {
  value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean;
}) {
  return (
    <input
      type="text"
      required={required}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className={inputCls}
    />
  );
}

/**
 * Expandable item selector:
 * Computes viewport coordinates so it floats above the table without clipping!
 */
function ItemPicker({ value, onSelect }: { value: string; onSelect: (item: CatalogItem) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selected = CATALOG.find(c => c.id === value) ?? null;
  const filtered = CATALOG.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));

  function toggleOpen() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 320),
      });
      setOpen(true);
    } else {
      setOpen(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const handleReposition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
          setOpen(false);
        } else {
          setCoords({
            top: rect.bottom + 4,
            left: rect.left,
            width: Math.max(rect.width, 320),
          });
        }
      }
    };
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        className={`flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-xs sm:text-sm transition-all ${
          open
            ? "border-[#044d73] ring-2 ring-[#044d73]/20 bg-white"
            : "border-slate-200 bg-white hover:border-slate-300"
        }`}
      >
        <span className={`truncate ${selected ? "font-semibold text-slate-800" : "text-slate-400"}`}>
          {selected ? selected.name : "Select item..."}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && coords && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => { setOpen(false); setQuery(""); }} />
          <div
            style={{ top: `${coords.top}px`, left: `${coords.left}px`, width: `${coords.width}px` }}
            className="fixed z-[101] max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl animate-in fade-in-50 zoom-in-95 duration-100"
          >
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-100 bg-white p-2.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search item…"
                className="w-full text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
            {filtered.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-400">No matching items found.</p>
            ) : (
              <div className="py-1">
                {filtered.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onSelect(c);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={`flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors ${
                      selected?.id === c.id ? "bg-[#044d73]/5 font-semibold text-[#044d73]" : "text-slate-700"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{c.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Stock: {c.stock} {c.unit}
                        {c.altUnit && ` / ${c.altUnit}`}
                        {c.batchTracking && " · Batch tracked"}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {rs(c.lastPurchasePrice)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function PurchasePage() {
  const [purchases, setPurchases] = useState<Purchase[]>(SEED_PURCHASES);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | PaymentType>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);
  const [form, setForm] = useState<PurchaseForm>(() => emptyForm(nextVchNo(SEED_PURCHASES)));

  /* Expanded batch panel line IDs (opens inline on same page) */
  const [expandedLineIds, setExpandedLineIds] = useState<string[]>([]);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  /* ---- stats ---- */

  const stats = useMemo(() => ({
    total: purchases.length,
    amount: purchases.reduce((s, p) => s + grandTotalOf(p), 0),
    cash: purchases.filter(p => p.paymentType === "Cash").length,
    credit: purchases.filter(p => p.paymentType === "Credit").length,
  }), [purchases]);

  /* ---- filter / paginate ---- */

  const filtered = useMemo(() => purchases.filter(p => {
    const q = search.toLowerCase();
    const matchSearch =
      p.vchNo.toLowerCase().includes(q) ||
      p.vendor.toLowerCase().includes(q) ||
      p.items.some(li =>
        li.itemName.toLowerCase().includes(q) ||
        (li.batch?.batchNo && li.batch.batchNo.toLowerCase().includes(q))
      );
    const matchType = typeFilter === "ALL" || p.paymentType === typeFilter;
    return matchSearch && matchType;
  }).sort((a, b) => b.date.localeCompare(a.date)), [purchases, search, typeFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  /* ---- purchase modal ---- */

  function openAdd() {
    setEditingPurchase(null);
    setForm(emptyForm(nextVchNo(purchases)));
    setExpandedLineIds([]);
    setIsModalOpen(true);
  }

  function openEdit(p: Purchase) {
    setEditingPurchase(p);
    setForm({
      date: p.date,
      vchNo: p.vchNo,
      paymentType: p.paymentType,
      purcType: p.purcType,
      vendor: p.vendor,
      items: p.items.map(li => ({
        ...li,
        batch: li.batch ? { ...li.batch } : null,
      })),
      discounts: p.discounts.map(d => ({ ...d })),
    });
    setExpandedLineIds([]);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingPurchase(null);
    setExpandedLineIds([]);
  }

  function toggleBatchExpand(id: string) {
    setExpandedLineIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function updateLine(id: string, patch: Partial<LineItemForm>) {
    setForm(p => ({
      ...p,
      items: p.items.map(li => {
        if (li.id !== id) return li;
        const updated = { ...li, ...patch };
        // Exactly one batch per purchase item: keep batch.qty in sync with line.qty
        if (patch.qty !== undefined && updated.batch) {
          updated.batch = { ...updated.batch, qty: patch.qty };
        }
        return updated;
      }),
    }));
  }

  function updateLineBatch(lineId: string, patch: Partial<BatchDetails>) {
    setForm(p => ({
      ...p,
      items: p.items.map(li => {
        if (li.id !== lineId) return li;
        const currentBatch = li.batch || emptyBatch(li.qty);
        const updatedBatch = { ...currentBatch, ...patch };
        // Sync qty if batch qty changed
        const newQty = patch.qty !== undefined && patch.qty !== "" ? patch.qty : li.qty;
        return {
          ...li,
          qty: newQty,
          batch: updatedBatch,
        };
      }),
    }));
  }

  function addLine() {
    setForm(p => ({ ...p, items: [...p.items, emptyLine()] }));
  }

  function removeLine(id: string) {
    setForm(p => ({ ...p, items: p.items.length > 1 ? p.items.filter(li => li.id !== id) : p.items }));
    setExpandedLineIds(prev => prev.filter(x => x !== id));
  }

  function addDiscount() {
    setForm(p => ({ ...p, discounts: [...p.discounts, emptyDiscount()] }));
  }

  function removeDiscount(id: string) {
    setForm(p => ({ ...p, discounts: p.discounts.filter(d => d.id !== id) }));
  }

  function updateDiscount(id: string, patch: Partial<DiscountRowForm>) {
    setForm(p => ({ ...p, discounts: p.discounts.map(d => d.id === id ? { ...d, ...patch } : d) }));
  }

  const validItems = form.items.filter(li => li.itemId && n(li.qty) > 0);
  const missingBatch = form.items.some(
    li => li.itemId && n(li.qty) > 0 && li.batchTracking && (!li.batch?.batchNo || !li.batch.batchNo.trim())
  );
  const subtotal = subtotalOf(form.items);
  const discountTotal = totalDiscountOf(form.discounts, subtotal);
  const grandTotal = subtotal - discountTotal;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vchNo.trim() || validItems.length === 0 || missingBatch) return;

    // Each purchase item has exactly one batch
    const clean: Purchase = {
      id: editingPurchase ? editingPurchase.id : crypto.randomUUID(),
      date: form.date,
      vchNo: form.vchNo.trim(),
      paymentType: form.paymentType,
      purcType: form.purcType,
      vendor: form.vendor.trim(),
      items: validItems.map(li => ({
        ...li,
        batch: li.batchTracking && li.batch ? {
          ...li.batch,
          batchNo: li.batch.batchNo.trim(),
          qty: li.qty,
        } : null,
      })),
      discounts: form.discounts.filter(d => n(d.amount) > 0),
    };

    if (editingPurchase) {
      setPurchases(prev => prev.map(p => (p.id === editingPurchase.id ? clean : p)));
    } else {
      setPurchases(prev => [...prev, clean]);
    }
    closeModal();
  }

  function handleDelete(id: string) {
    setPurchases(prev => prev.filter(p => p.id !== id));
    setDeleteConfirmId(null);
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="rounded-xl bg-[#044d73] px-6 py-5 text-white shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Purchase</h1>
          <p className="text-xs text-white/70 mt-0.5">Manage purchase vouchers, item batches, and suppliers</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-white text-[#044d73] hover:bg-slate-50 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          New Purchase
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Purchases", value: stats.total, border: "border-l-slate-400", iconBg: "bg-slate-50 text-slate-600", icon: <Receipt className="h-5 w-5 sm:h-6 sm:w-6" /> },
          { label: "Total Amount", value: rs(stats.amount), border: "border-l-[#044d73]", iconBg: "bg-[#044d73]/10 text-[#044d73]", icon: <Wallet className="h-5 w-5 sm:h-6 sm:w-6" /> },
          { label: "Cash Purchases", value: stats.cash, border: "border-l-emerald-500", iconBg: "bg-emerald-50 text-emerald-600", icon: <Banknote className="h-5 w-5 sm:h-6 sm:w-6" /> },
          { label: "Credit Purchases", value: stats.credit, border: "border-l-amber-500", iconBg: "bg-amber-50 text-amber-600", icon: <CreditCard className="h-5 w-5 sm:h-6 sm:w-6" /> },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border-l-4 ${s.border} border border-slate-200 bg-white p-4 sm:p-5 shadow-sm flex items-center justify-between`}>
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">{s.label}</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1 break-all">{s.value}</p>
            </div>
            <div className={`flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl ${s.iconBg}`}>
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
            placeholder="Search by vch no., vendor, item or batch"
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value as typeof typeFilter); setCurrentPage(1); }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 focus:border-[#044d73] focus:outline-none"
        >
          <option value="ALL">All Payment Types</option>
          <option value="Cash">Cash</option>
          <option value="Credit">Credit</option>
        </select>
      </div>

      {/* Table — Clicking anywhere on a purchase row opens all its details */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Vch No.</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Purc Type</th>
                <th className="py-3 px-4">Vendor</th>
                <th className="py-3 px-4">Items & Batches</th>
                <th className="py-3 px-4">Qty</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-sm text-slate-400">
                    No purchases match criteria.
                  </td>
                </tr>
              ) : paginated.map(p => {
                const totalQty = p.items.reduce((s, li) => s + n(li.qty), 0);
                return (
                  <tr
                    key={p.id}
                    onClick={() => setViewingPurchase(p)}
                    className="hover:bg-slate-50/80 transition-colors text-slate-700 cursor-pointer group"
                  >
                    <td className="py-3 px-4 text-slate-500">{p.date}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800 group-hover:text-[#044d73] transition-colors">
                      {p.vchNo}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold border ${p.paymentType === "Cash"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-amber-50 border-amber-200 text-amber-700"
                        }`}>
                        {p.paymentType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">{p.purcType}</td>
                    <td className="py-3 px-4 text-slate-500">{p.vendor || "—"}</td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="flex flex-col gap-1">
                        {p.items.slice(0, 2).map((li, i) => (
                          <div key={i} className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="font-medium text-slate-800">{li.itemName || "Item"}</span>
                            {li.batch?.batchNo ? (
                              <span className="inline-flex items-center gap-1 rounded bg-[#044d73]/10 px-1.5 py-0.2 text-[10px] font-semibold text-[#044d73] border border-[#044d73]/20">
                                <Boxes className="w-2.5 h-2.5" /> B: {li.batch.batchNo}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">(no batch)</span>
                            )}
                          </div>
                        ))}
                        {p.items.length > 2 && (
                          <span className="text-[11px] text-slate-400 font-medium">+{p.items.length - 2} more item{p.items.length - 2 > 1 ? "s" : ""}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500">{totalQty}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{rs(grandTotalOf(p))}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(p);
                          }}
                          title="Edit Purchase"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#044d73] hover:bg-[#044d73]/10 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(p.id);
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
              })}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
            <span className="text-xs text-slate-400">
              Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filtered.length)}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} purchase{filtered.length !== 1 ? "s" : ""}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30">
                  <ChevronDown className="w-4 h-4 rotate-90" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
                  <button key={pg} onClick={() => setCurrentPage(pg)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold ${currentPage === pg ? "bg-[#044d73] text-white" : "border border-slate-200 text-slate-500"}`}>
                    {pg}
                  </button>
                ))}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30">
                  <ChevronDown className="w-4 h-4 -rotate-90" />
                </button>
              </div>
            )}
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
                <h3 className="text-base font-semibold text-slate-900">Delete Purchase?</h3>
                <p className="text-sm text-slate-500 mt-1">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3 p-6">
              <button onClick={() => setDeleteConfirmId(null)}
                className="flex-1 bg-slate-50 border border-slate-200 text-slate-600 font-medium text-sm py-2.5 rounded-lg">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 bg-red-500 text-white font-semibold text-sm py-2.5 rounded-lg">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Purchase Modal */}
      {viewingPurchase && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewingPurchase(null)}>
          <div className="bg-white border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="relative flex shrink-0 items-center justify-between p-6 bg-[#044d73] text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{viewingPurchase.vchNo}</h3>
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold border ${viewingPurchase.paymentType === "Cash"
                      ? "bg-emerald-400/20 border-emerald-300 text-emerald-100"
                      : "bg-amber-400/20 border-amber-300 text-amber-100"
                      }`}>
                      {viewingPurchase.paymentType}
                    </span>
                  </div>
                  <p className="text-xs text-white/70 mt-0.5">Voucher Date: {viewingPurchase.date} · Supplier: {viewingPurchase.vendor || "No vendor specified"}</p>
                </div>
              </div>
              <button type="button" onClick={() => setViewingPurchase(null)} className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Vch Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium uppercase text-[10px]">Voucher No</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{viewingPurchase.vchNo}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium uppercase text-[10px]">Date</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{viewingPurchase.date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium uppercase text-[10px]">Vendor</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{viewingPurchase.vendor || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium uppercase text-[10px]">Purchase Type</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{viewingPurchase.purcType}</span>
                </div>
              </div>

              {/* Items & Batches Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#044d73] mb-2.5 flex items-center gap-1.5">
                  <PackagePlus className="w-4 h-4" /> Purchased Items & Batches
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Item Name</th>
                        <th className="py-2.5 px-3">Batch No</th>
                        <th className="py-2.5 px-3">Expiry</th>
                        <th className="py-2.5 px-3">Mfg Date</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3">Unit</th>
                        <th className="py-2.5 px-3">Rate</th>
                        <th className="py-2.5 px-3">MRP</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewingPurchase.items.map((li, idx) => (
                        <tr key={li.id || idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">{li.itemName}</td>
                          <td className="py-2.5 px-3">
                            {li.batch?.batchNo ? (
                              <span className="inline-flex items-center gap-1 rounded bg-[#044d73]/10 px-2 py-0.5 text-[11px] font-semibold text-[#044d73] border border-[#044d73]/20">
                                <Boxes className="w-3 h-3" /> {li.batch.batchNo}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{li.batch?.expDate || "—"}</td>
                          <td className="py-2.5 px-3 text-slate-500">{li.batch?.mfgDate || "—"}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800 text-center">{li.qty}</td>
                          <td className="py-2.5 px-3 text-slate-500">{li.unit || "—"}</td>
                          <td className="py-2.5 px-3 text-slate-600">{rs(n(li.price))}</td>
                          <td className="py-2.5 px-3 text-slate-600">{li.batch?.mrp ? rs(n(li.batch.mrp)) : "—"}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-800 text-right">{rs(lineAmount(li))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="ml-auto w-full max-w-xs space-y-1.5 rounded-xl bg-slate-50 p-4 border border-slate-200">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Subtotal</span><span>{rs(subtotalOf(viewingPurchase.items))}</span>
                </div>
                {viewingPurchase.discounts.length > 0 && (
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Discount</span><span>- {rs(totalDiscountOf(viewingPurchase.discounts, subtotalOf(viewingPurchase.items)))}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-800">
                  <span>Grand Total</span><span>{rs(grandTotalOf(viewingPurchase))}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 bg-white p-4 px-6">
              <button
                type="button"
                onClick={() => {
                  const p = viewingPurchase;
                  setViewingPurchase(null);
                  openEdit(p);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-[#044d73]/30 bg-[#044d73]/5 hover:bg-[#044d73]/10 px-4 py-2 text-xs font-semibold text-[#044d73] transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit Purchase
              </button>
              <button
                type="button"
                onClick={() => setViewingPurchase(null)}
                className="rounded-lg bg-slate-100 hover:bg-slate-200 px-5 py-2 text-xs font-semibold text-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New / Edit Purchase Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-5xl max-h-[94vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="relative flex shrink-0 items-center justify-between px-7 py-5 bg-[#044d73] text-white">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                  <Receipt className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">
                    {editingPurchase ? "Edit Purchase" : "New Purchase"}
                  </h3>
                  <p className="text-xs text-white/70">Enter items on the line and set batch details directly on the same page</p>
                </div>
              </div>
              <button type="button" onClick={closeModal} className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-6 overflow-y-auto p-7">

                {/* Purchase Details */}
                <Section title="Purchase Voucher Details" icon={<Receipt className="w-3.5 h-3.5" />}>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                    <Field label="Date">
                      <input
                        type="date"
                        value={form.date}
                        onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Vch No.">
                      <TextInput required value={form.vchNo} onChange={v => setForm(p => ({ ...p, vchNo: v }))} />
                    </Field>
                    <Field label="Vendor">
                      <TextInput value={form.vendor} onChange={v => setForm(p => ({ ...p, vendor: v }))} placeholder="Vendor name" />
                    </Field>
                    <Field label="Payment Type">
                      <select
                        value={form.paymentType}
                        onChange={e => setForm(p => ({ ...p, paymentType: e.target.value as PaymentType }))}
                        className={inputCls}
                      >
                        <option value="Cash">Cash</option>
                        <option value="Credit">Credit</option>
                      </select>
                    </Field>
                    <Field label="Purc Type" span hint="VAT treatment for this purchase">
                      <select
                        value={form.purcType}
                        onChange={e => setForm(p => ({ ...p, purcType: e.target.value as PurcType }))}
                        className={inputCls}
                      >
                        <option value="VAT/Exempt">VAT/Exempt</option>
                        <option value="VAT/Item-wise">VAT/Item-wise</option>
                        <option value="VAT/TaxIncl.">VAT/TaxIncl.</option>
                      </select>
                    </Field>
                  </div>
                </Section>

                {/* Items & Batches (Same line entry, batch opens directly on same page) */}
                <Section
                  title="Items & Batch Details"
                  icon={<PackagePlus className="w-3.5 h-3.5" />}
                >
                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50/90 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                            <th className="py-3 px-3 w-10 text-center">#</th>
                            <th className="py-3 px-3 min-w-[260px]">Item Name</th>
                            <th className="py-3 px-2.5 w-[90px]">Qty</th>
                            <th className="py-3 px-2 w-[70px] text-center">Unit</th>
                            <th className="py-3 px-2.5 w-[110px]">Pur. Rate</th>
                            <th className="py-3 px-3 w-[110px] text-right">Amount</th>
                            <th className="py-3 px-3 min-w-[220px]">Batch Details</th>
                            <th className="py-3 px-2 w-[50px] text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {form.items.map((line, idx) => {
                            const isExpanded = expandedLineIds.includes(line.id);
                            const hasValidBatch = line.batchTracking && line.batch && line.batch.batchNo.trim() !== "";
                            const isMissingBatch = line.itemId && n(line.qty) > 0 && line.batchTracking && !hasValidBatch;

                            return (
                              <Fragment key={line.id}>
                                {/* Same-Line Item Row */}
                                <tr
                                  className={`transition-colors ${isMissingBatch ? "bg-amber-50/30" : "hover:bg-slate-50/50"} ${isExpanded ? "bg-slate-50/70" : ""}`}
                                >
                                  {/* S.N. */}
                                  <td className="py-3 px-3 text-center font-medium text-slate-400">
                                    {idx + 1}
                                  </td>

                                  {/* Item Selector */}
                                  <td className="py-3 px-3">
                                    <ItemPicker
                                      value={line.itemId}
                                      onSelect={c => {
                                        const initialBatch = c.batchTracking ? emptyBatch(line.qty || 1) : null;
                                        updateLine(line.id, {
                                          itemId: c.id,
                                          itemName: c.name,
                                          unit: c.unit,
                                          altUnit: c.altUnit,
                                          batchTracking: c.batchTracking,
                                          price: c.lastPurchasePrice,
                                          qty: line.qty || 1,
                                          batch: initialBatch,
                                        });
                                        // Auto-expand batch panel on same page if batch-tracked
                                        if (c.batchTracking && !expandedLineIds.includes(line.id)) {
                                          setExpandedLineIds(prev => [...prev, line.id]);
                                        }
                                      }}
                                    />
                                  </td>

                                  {/* Qty */}
                                  <td className="py-3 px-2.5">
                                    <input
                                      type="number"
                                      min={0}
                                      step="1"
                                      placeholder="0"
                                      value={line.qty}
                                      onChange={e => updateLine(line.id, { qty: e.target.value === "" ? "" : Number(e.target.value) })}
                                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                                    />
                                  </td>

                                  {/* Unit */}
                                  <td className="py-3 px-2 text-center">
                                    <span className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-600">
                                      {line.unit || "—"}
                                    </span>
                                  </td>

                                  {/* Pur. Rate */}
                                  <td className="py-3 px-2.5">
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      placeholder="0.00"
                                      value={line.price}
                                      onChange={e => updateLine(line.id, { price: e.target.value === "" ? "" : Number(e.target.value) })}
                                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                                    />
                                  </td>

                                  {/* Amount */}
                                  <td className="py-3 px-3 text-right font-bold text-slate-800">
                                    <div className="flex h-9 items-center justify-end">
                                      {rs(lineAmount(line))}
                                    </div>
                                  </td>

                                  {/* Batch Details Button — Opens directly on the same page */}
                                  <td className="py-3 px-3">
                                    {line.batchTracking ? (
                                      hasValidBatch ? (
                                        <button
                                          type="button"
                                          onClick={() => toggleBatchExpand(line.id)}
                                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all ${
                                            isExpanded
                                              ? "border-[#044d73] bg-[#044d73]/10 text-[#044d73]"
                                              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                          }`}
                                        >
                                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                                          <span className="truncate max-w-[130px]">
                                            B: {line.batch?.batchNo}
                                          </span>
                                          <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => toggleBatchExpand(line.id)}
                                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all ${
                                            isExpanded
                                              ? "border-[#044d73] bg-[#044d73]/10 text-[#044d73]"
                                              : isMissingBatch
                                              ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                              : "border-slate-200 bg-white text-slate-600 hover:border-[#044d73] hover:text-[#044d73]"
                                          }`}
                                        >
                                          <Boxes className="w-3.5 h-3.5" />
                                          <span>Enter Batch</span>
                                          <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                        </button>
                                      )
                                    ) : (
                                      <span className="text-[11px] text-slate-400 italic">Not tracked</span>
                                    )}
                                  </td>

                                  {/* Remove Action */}
                                  <td className="py-3 px-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => removeLine(line.id)}
                                      disabled={form.items.length <= 1}
                                      title="Remove item"
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>

                                {/* Inline Batch Expansion Row — Exactly ONE batch per purchase item */}
                                {isExpanded && line.batchTracking && (
                                  <tr className="bg-slate-50/80 border-b border-slate-200 animate-in fade-in duration-150">
                                    <td colSpan={8} className="p-3.5 pl-10 pr-6">
                                      <div className="rounded-xl border border-[#044d73]/25 bg-white p-4 shadow-sm space-y-3.5">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                          <div className="flex items-center gap-2">
                                            <Boxes className="w-4 h-4 text-[#044d73]" />
                                            <span className="text-xs font-bold text-[#044d73] uppercase tracking-wider">
                                              Batch Details for {line.itemName || "Item"}
                                            </span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => toggleBatchExpand(line.id)}
                                            className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                                          >
                                            Collapse <ChevronDown className="w-3.5 h-3.5 rotate-180" />
                                          </button>
                                        </div>

                                        {/* Single batch input grid */}
                                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 items-end p-3 rounded-lg bg-slate-50/80 border border-slate-200/80">
                                          <div>
                                            <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                              Batch No. *
                                            </label>
                                            <input
                                              type="text"
                                              required
                                              placeholder="e.g. AB2501"
                                              value={line.batch?.batchNo || ""}
                                              onChange={e => updateLineBatch(line.id, { batchNo: e.target.value })}
                                              className="h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 placeholder:text-slate-300 focus:border-[#044d73] focus:outline-none"
                                            />
                                          </div>

                                          <div>
                                            <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                              Quantity ({line.unit || "unit"}) *
                                            </label>
                                            <input
                                              type="number"
                                              min={1}
                                              step="1"
                                              placeholder="0"
                                              value={line.batch?.qty !== undefined ? line.batch.qty : line.qty}
                                              onChange={e => updateLineBatch(line.id, { qty: e.target.value === "" ? "" : Number(e.target.value) })}
                                              className="h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 placeholder:text-slate-300 focus:border-[#044d73] focus:outline-none"
                                            />
                                          </div>

                                          <div>
                                            <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                              Exp. Date *
                                            </label>
                                            <input
                                              type="month"
                                              required
                                              value={line.batch?.expDate || ""}
                                              onChange={e => updateLineBatch(line.id, { expDate: e.target.value })}
                                              className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-[#044d73] focus:outline-none"
                                            />
                                          </div>

                                          <div>
                                            <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                              Mfg. Date
                                            </label>
                                            <input
                                              type="month"
                                              value={line.batch?.mfgDate || ""}
                                              onChange={e => updateLineBatch(line.id, { mfgDate: e.target.value })}
                                              className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-[#044d73] focus:outline-none"
                                            />
                                          </div>

                                          <div>
                                            <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                              M.R.P. (Rs.)
                                            </label>
                                            <input
                                              type="number"
                                              min={0}
                                              step="0.01"
                                              placeholder="0.00"
                                              value={line.batch?.mrp || ""}
                                              onChange={e => updateLineBatch(line.id, { mrp: e.target.value === "" ? "" : Number(e.target.value) })}
                                              className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 placeholder:text-slate-300 focus:border-[#044d73] focus:outline-none"
                                            />
                                          </div>

                                          <div>
                                            <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                              Sale Price
                                            </label>
                                            <input
                                              type="number"
                                              min={0}
                                              step="0.01"
                                              placeholder="0.00"
                                              value={line.batch?.salePrice || ""}
                                              onChange={e => updateLineBatch(line.id, { salePrice: e.target.value === "" ? "" : Number(e.target.value) })}
                                              className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 placeholder:text-slate-300 focus:border-[#044d73] focus:outline-none"
                                            />
                                          </div>
                                        </div>

                                        {/* Actions in batch panel */}
                                        <div className="flex items-center justify-end pt-1 border-t border-slate-100">
                                          <button
                                            type="button"
                                            onClick={() => toggleBatchExpand(line.id)}
                                            className="rounded-lg bg-[#044d73] hover:bg-[#033f60] px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors"
                                          >
                                            Done
                                          </button>
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

                    {/* Single Clean Add Item Button */}
                    <div className="border-t border-slate-100 bg-slate-50/50 p-3 px-4 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={addLine}
                        className="flex items-center gap-2 rounded-lg bg-[#044d73]/10 hover:bg-[#044d73]/20 px-3.5 py-2 text-xs font-semibold text-[#044d73] transition-colors"
                      >
                        <Plus className="w-4 h-4" /> Add Item
                      </button>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {form.items.length} item row{form.items.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  {missingBatch && (
                    <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5 px-3 text-xs text-amber-700">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>Batch details required: Click <strong>"Enter Batch"</strong> on the item row to fill in the Batch No. and Expiry.</span>
                    </div>
                  )}
                </Section>

                {/* Discounts */}
                <Section
                  title="Discounts"
                  icon={<Percent className="w-3.5 h-3.5" />}
                  action={
                    <button
                      type="button"
                      onClick={addDiscount}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#044d73] hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Discount
                    </button>
                  }
                >
                  {form.discounts.length === 0 ? (
                    <p className="rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs text-slate-400">No discount applied to this purchase.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50/70 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            <th className="py-2.5 px-3 w-10">S.N</th>
                            <th className="py-2.5 px-3">Amount</th>
                            <th className="py-2.5 px-3">Discount Type</th>
                            <th className="py-2.5 px-3 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {form.discounts.map((d, idx) => (
                            <tr key={d.id}>
                              <td className="py-2 px-3 text-slate-500">{idx + 1}</td>
                              <td className="py-2 px-3">
                                <input
                                  type="number" min={0} step="0.01"
                                  value={d.amount}
                                  placeholder={d.type === "Percentage" ? "%" : "Rs."}
                                  onChange={e => updateDiscount(d.id, { amount: e.target.value === "" ? "" : Number(e.target.value) })}
                                  className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <select
                                  value={d.type}
                                  onChange={e => updateDiscount(d.id, { type: e.target.value as DiscountType })}
                                  className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                                >
                                  <option value="Percentage">Percentage</option>
                                  <option value="Flat">Flat</option>
                                </select>
                              </td>
                              <td className="py-2 px-3">
                                <button
                                  type="button"
                                  onClick={() => removeDiscount(d.id)}
                                  className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Section>

                {/* Totals */}
                <div className="ml-auto w-full max-w-xs space-y-1.5 rounded-xl bg-slate-50 p-4 border border-slate-200">
                  <div className="flex justify-between text-xs sm:text-sm text-slate-500">
                    <span>Subtotal</span><span>{rs(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm text-slate-500">
                    <span>Discount</span><span>- {rs(discountTotal)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 text-sm sm:text-base font-bold text-slate-800">
                    <span>Grand Total</span><span>{rs(grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex shrink-0 gap-3 border-t border-slate-100 bg-white p-5 px-7">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={validItems.length === 0 || missingBatch || !form.vchNo.trim()}
                  className="flex-1 rounded-lg bg-[#044d73] hover:bg-[#033f60] py-2.5 text-sm font-medium text-white shadow-sm transition-colors disabled:opacity-40"
                >
                  {editingPurchase ? "Save Changes" : "Save Purchase"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}