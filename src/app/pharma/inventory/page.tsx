"use client";

import { useState, useMemo, Fragment } from "react";
import {
  Plus, X, Pencil, Trash2, Search,
  Package, PackageCheck, PackageX, AlertTriangle,
  ChevronDown, Boxes, Check,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type StockLevel = "in_stock" | "low_stock" | "out_of_stock";
type StockStatus = StockLevel | "not_tracked";
type Num = number | ""; // number inputs can be empty while typing
type ExpMfg = "None" | "Expiry" | "Mfg" | "Both";
type UnitRef = "Main" | "Alternate" | "Packaging";

interface Batch {
  id: string;
  batchNo: string;
  qty: number;
  mfgDate: string;
  expDate: string;
  mrp: number;
  salePrice: number;
}

/** Everything the user can edit in the Add / Edit Item form (mirrors Busy's Item Master). */
interface ItemDetails {
  // Basic
  name: string;
  alias: string;
  printName: string;
  group: string;
  hsnCode: string;
  description: string;

  // Units
  unit: string; // main unit
  altUnit: string; // "" = none
  conFactor: Num; // 1 alternate unit = conFactor main units
  conType: "Fixed" | "Variable";
  packagingUnit: string; // "" = none
  packagingConFactor: Num; // 1 packaging unit = packagingConFactor main units
  defaultUnitForSales: UnitRef;
  defaultUnitForPurchase: UnitRef;

  // Opening stock
  opStockQty: Num;
  opStockValue: Num;
  altOpStockQty: Num;

  // Tax
  taxRate: number;
  taxInclusiveSale: boolean;
  taxInclusivePurchase: boolean;

  // Pricing
  salesPriceOn: "Main" | "Alternate";
  salesPrice: Num;
  purcPrice: Num;
  mrp: Num;
  minSalesPrice: Num; // exclusive of taxes
  selfValPrice: Num;
  packagingSalesPrice: Num;
  packagingPurcPrice: Num;

  // Discount & markup
  saleDiscount: Num;
  saleCompoundDisc: Num;
  specifySalesDiscStructure: boolean;
  purcDiscount: Num;
  purcCompoundDisc: Num;
  specifyPurcDiscStructure: boolean;
  saleMarkup: Num;
  saleCompMarkup: Num;
  purcMarkup: Num;
  purcCompMarkup: Num;

  // Accounts & vendor
  salesAcc: string;
  purcAcc: string;
  defaultVendor: string;

  // Stock control & tracking
  setCriticalLevel: boolean;
  minStockLevel: Num;
  batchTracking: boolean;
  expMfgRequired: ExpMfg;
  expiryMonths: Num; // shelf life; auto-fills batch expiry from mfg date
  serialNoWise: boolean;
  dontMaintainStock: boolean;
}

interface Item extends ItemDetails {
  id: string;
  currentStock: number; // used only when batchTracking is false
  batches: Batch[];
}

/* ------------------------------------------------------------------ */
/* Defaults & seed data                                                */
/* ------------------------------------------------------------------ */

const DEFAULT_UNITS = ["Pcs", "Tab", "Strip", "Box", "Bottle", "Vial", "Kg", "L", "ml"];
const DEFAULT_GROUPS = ["General"];
const TAX_RATES = [0, 5, 13];

const EMPTY_DETAILS: ItemDetails = {
  name: "", alias: "", printName: "", group: "General", hsnCode: "", description: "",

  unit: "Pcs", altUnit: "", conFactor: "", conType: "Fixed",
  packagingUnit: "", packagingConFactor: "",
  defaultUnitForSales: "Main", defaultUnitForPurchase: "Main",

  opStockQty: "", opStockValue: "", altOpStockQty: "",

  taxRate: 13, taxInclusiveSale: false, taxInclusivePurchase: false,

  salesPriceOn: "Main",
  salesPrice: "", purcPrice: "", mrp: "", minSalesPrice: "", selfValPrice: "",
  packagingSalesPrice: "", packagingPurcPrice: "",

  saleDiscount: "", saleCompoundDisc: "", specifySalesDiscStructure: false,
  purcDiscount: "", purcCompoundDisc: "", specifyPurcDiscStructure: false,
  saleMarkup: "", saleCompMarkup: "", purcMarkup: "", purcCompMarkup: "",

  salesAcc: "", purcAcc: "", defaultVendor: "",

  setCriticalLevel: true, minStockLevel: "",
  batchTracking: true, expMfgRequired: "Both", expiryMonths: "",
  serialNoWise: false, dontMaintainStock: false,
};

const EMPTY_BATCH_FORM = {
  batchNo: "",
  qty: "" as Num,
  mfgDate: "",
  expDate: "",
  mrp: "" as Num,
  salePrice: "" as Num,
};

function seed(o: Partial<Item>): Item {
  return { ...EMPTY_DETAILS, id: "", currentStock: 0, batches: [], ...o };
}

const SEED_ITEMS: Item[] = [
  seed({
    id: "1",
    name: "Cefixime 200 MG",
    printName: "Cefixime 200 MG",
    unit: "Tab",
    taxRate: 13,
    minStockLevel: 100,
    batches: [
      { id: "b1", batchNo: "AB2511015", qty: 500, mfgDate: "2026-07", expDate: "2027-10", mrp: 12, salePrice: 10 },
    ],
  }),
  seed({
    id: "2",
    name: "Absorbant Cotton Wool",
    printName: "Absorbant Cotton Wool",
    unit: "Pcs",
    batchTracking: false,
    taxRate: 0,
    minStockLevel: 20,
    opStockQty: 45,
    currentStock: 45,
  }),
  seed({
    id: "3",
    name: "Pregabalin 75 MG",
    printName: "Pregabalin 75 MG",
    unit: "Tab",
    taxRate: 13,
    minStockLevel: 500,
    batches: [
      { id: "b2", batchNo: "BK2605024", qty: 400, mfgDate: "2026-05", expDate: "2028-05", mrp: 2.5, salePrice: 2 },
      { id: "b3", batchNo: "BK2606026", qty: 2800, mfgDate: "2026-06", expDate: "2028-06", mrp: 2.5, salePrice: 2 },
    ],
  }),
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const n = (v: Num) => (v === "" ? 0 : v);
const rs = (v: Num) => (n(v) ? `Rs. ${n(v).toFixed(2)}` : "");
const pct = (v: Num) => (n(v) ? `${n(v)}%` : "");

const usesMfg = (e: ExpMfg) => e === "Mfg" || e === "Both";
const usesExp = (e: ExpMfg) => e === "Expiry" || e === "Both";

function addMonths(ym: string, months: number): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return "";
  const d = new Date(y, m - 1 + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function itemStock(item: Item): number {
  return item.batchTracking ? item.batches.reduce((sum, b) => sum + b.qty, 0) : item.currentStock;
}

function getStockLevel(item: Item): StockStatus {
  if (item.dontMaintainStock) return "not_tracked";
  const stock = itemStock(item);
  if (stock <= 0) return "out_of_stock";
  if (item.setCriticalLevel && stock <= n(item.minStockLevel)) return "low_stock";
  return "in_stock";
}

const STOCK_STYLE: Record<StockStatus, { bg: string; text: string; dot: string; label: string }> = {
  in_stock: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "In Stock" },
  low_stock: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Low Stock" },
  out_of_stock: { bg: "bg-red-50", text: "text-red-600", dot: "bg-red-500", label: "Out of Stock" },
  not_tracked: { bg: "bg-slate-100", text: "text-slate-500", dot: "bg-slate-400", label: "Not Tracked" },
};

/** Label/value pairs shown in the expanded row. Empty values are skipped. */
function detailRows(item: Item): [string, string][] {
  const rows: [string, string][] = [];
  const add = (label: string, value: string) => { if (value) rows.push([label, value]); };

  add("Print Name", item.printName);
  add("Alias", item.alias);
  add("Group", item.group);
  add("HSN Code", item.hsnCode);
  if (item.altUnit) {
    add("Alternate Unit", `${item.altUnit} (1 = ${n(item.conFactor) || "?"} ${item.unit}, ${item.conType})`);
    if (n(item.altOpStockQty)) add("Alt. Op. Stock", `${item.altOpStockQty} ${item.altUnit}`);
  }
  if (item.packagingUnit) add("Packaging Unit", `${item.packagingUnit} (1 = ${n(item.packagingConFactor) || "?"} ${item.unit})`);
  if (item.altUnit || item.packagingUnit) {
    add("Default Unit (Sales)", item.defaultUnitForSales);
    add("Default Unit (Purchase)", item.defaultUnitForPurchase);
  }
  if (!item.batchTracking && !item.dontMaintainStock) add("Op. Stock", n(item.opStockQty) ? `${item.opStockQty} ${item.unit}` : "");
  add("Op. Stock Value", rs(item.opStockValue));
  add("Sales Price", rs(item.salesPrice) + (item.altUnit && rs(item.salesPrice) ? ` / ${item.salesPriceOn === "Main" ? item.unit : item.altUnit}` : ""));
  add("Purc. Price", rs(item.purcPrice));
  add("M.R.P.", rs(item.mrp));
  add("Min. Sales Price", rs(item.minSalesPrice));
  add("Self-Val. Price", rs(item.selfValPrice));
  add("Pkg. Sales Price", rs(item.packagingSalesPrice));
  add("Pkg. Purc. Price", rs(item.packagingPurcPrice));
  add("Sale Discount", pct(item.saleDiscount));
  add("Sale Compound Disc.", pct(item.saleCompoundDisc));
  add("Purc. Discount", pct(item.purcDiscount));
  add("Purc. Compound Disc.", pct(item.purcCompoundDisc));
  add("Sale Markup", pct(item.saleMarkup));
  add("Sale Comp. Markup", pct(item.saleCompMarkup));
  add("Purc. Markup", pct(item.purcMarkup));
  add("Purc. Comp. Markup", pct(item.purcCompMarkup));
  if (item.taxInclusiveSale) add("Tax Inclusive Sale", "Yes");
  if (item.taxInclusivePurchase) add("Tax Inclusive Purchase", "Yes");
  if (item.specifySalesDiscStructure) add("Sales Disc. Structure", "Yes");
  if (item.specifyPurcDiscStructure) add("Purc. Disc. Structure", "Yes");
  add("Sales Account", item.salesAcc);
  add("Purchase Account", item.purcAcc);
  add("Default Vendor", item.defaultVendor);
  if (item.batchTracking) {
    add("Exp./Mfg. Date", item.expMfgRequired);
    add("Expiry Months", n(item.expiryMonths) ? String(item.expiryMonths) : "");
  }
  if (item.serialNoWise) add("Serial No-wise", "Yes");
  return rows;
}

/* ------------------------------------------------------------------ */
/* Small form building blocks                                          */
/* ------------------------------------------------------------------ */

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]";
const labelCls = "mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-3 border-b border-slate-100 pb-1.5 text-xs font-bold uppercase tracking-wider text-[#044d73]">
        {title}
      </h4>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
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
    <input type="text" required={required} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)} className={inputCls} />
  );
}

function NumInput({ value, onChange, step = "0.01", placeholder }: {
  value: Num; onChange: (v: Num) => void; step?: string; placeholder?: string;
}) {
  return (
    <input type="number" step={step} min={0} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value === "" ? "" : Number(e.target.value))} className={inputCls} />
  );
}

function SelectInput({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={inputCls}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Toggle({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 hover:bg-slate-50/60">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-[#044d73] focus:ring-[#044d73]" />
      <div>
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
    </label>
  );
}

/**
 * A select with an inline "+" button to add a new option on the spot.
 * `onCreate` should register the option and return its final name (or null if invalid).
 */
function CreatableSelect({ value, options, onChange, onCreate, noun, noneLabel }: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  onCreate: (raw: string) => string | null;
  noun: string;
  noneLabel?: string; // when set, an empty option is offered
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  function cancel() { setDraft(""); setAdding(false); }
  function commit() {
    const created = onCreate(draft);
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
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === "Escape") { e.preventDefault(); cancel(); }
          }}
          className={inputCls}
        />
        <button type="button" onClick={commit} title={`Add ${noun}`}
          className="shrink-0 rounded-lg bg-[#044d73] px-3 text-white hover:bg-[#033f60]">
          <Check className="h-4 w-4" />
        </button>
        <button type="button" onClick={cancel} title="Cancel"
          className="shrink-0 rounded-lg border border-slate-200 px-3 text-slate-500 hover:bg-slate-50">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <select value={value} onChange={e => onChange(e.target.value)} className={inputCls}>
        {noneLabel !== undefined && <option value="">{noneLabel}</option>}
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <button type="button" onClick={() => setAdding(true)} title={`Add new ${noun}`}
        className="shrink-0 rounded-lg border border-slate-200 px-3 text-[#044d73] hover:bg-[#044d73]/10">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>(SEED_ITEMS);
  const [units, setUnits] = useState<string[]>(DEFAULT_UNITS);
  const [groups, setGroups] = useState<string[]>(DEFAULT_GROUPS);

  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<"ALL" | StockLevel>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [form, setForm] = useState<ItemDetails>(EMPTY_DETAILS);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchItemId, setBatchItemId] = useState<string | null>(null);
  const [batchForm, setBatchForm] = useState(EMPTY_BATCH_FORM);

  const batchItem = items.find(i => i.id === batchItemId) ?? null;

  const stats = useMemo(() => ({
    total: items.length,
    inStock: items.filter(i => getStockLevel(i) === "in_stock").length,
    lowStock: items.filter(i => getStockLevel(i) === "low_stock").length,
    outOfStock: items.filter(i => getStockLevel(i) === "out_of_stock").length,
  }), [items]);

  const filtered = useMemo(() => items.filter(i => {
    const q = search.toLowerCase();
    const matchSearch =
      i.name.toLowerCase().includes(q) ||
      i.alias.toLowerCase().includes(q) ||
      i.hsnCode.toLowerCase().includes(q);
    const matchStock = stockFilter === "ALL" || getStockLevel(i) === stockFilter;
    return matchSearch && matchStock;
  }), [items, search, stockFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  /* ---- dynamic option lists (units, groups) ---- */

  function addOption(
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    raw: string,
  ): string | null {
    const name = raw.trim();
    if (!name) return null;
    const existing = list.find(o => o.toLowerCase() === name.toLowerCase());
    if (existing) return existing; // don't create duplicates, just select the existing one
    setList(prev => [...prev, name]);
    return name;
  }
  const addUnit = (raw: string) => addOption(units, setUnits, raw);
  const addGroup = (raw: string) => addOption(groups, setGroups, raw);

  /* ---- item modal ---- */

  function setField<K extends keyof ItemDetails>(key: K, value: ItemDetails[K]) {
    setForm(p => ({ ...p, [key]: value }));
  }

  function openAdd() {
    setEditingItem(null);
    setForm(EMPTY_DETAILS);
    setIsModalOpen(true);
  }

  function openEdit(item: Item) {
    const { id: _id, currentStock: _cs, batches: _b, ...details } = item;
    setEditingItem(item);
    setForm(details);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingItem(null);
    setForm(EMPTY_DETAILS);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    const name = form.name.trim();
    const altUnit = form.altUnit === form.unit ? "" : form.altUnit;
    const packagingUnit = form.packagingUnit === form.unit ? "" : form.packagingUnit;

    const clean: ItemDetails = {
      ...form,
      name,
      alias: form.alias.trim(),
      printName: form.printName.trim() || name,
      hsnCode: form.hsnCode.trim(),
      description: form.description.trim(),
      altUnit,
      packagingUnit,
      // fall back to Main if the referenced unit no longer exists
      defaultUnitForSales:
        (form.defaultUnitForSales === "Alternate" && !altUnit) || (form.defaultUnitForSales === "Packaging" && !packagingUnit)
          ? "Main" : form.defaultUnitForSales,
      defaultUnitForPurchase:
        (form.defaultUnitForPurchase === "Alternate" && !altUnit) || (form.defaultUnitForPurchase === "Packaging" && !packagingUnit)
          ? "Main" : form.defaultUnitForPurchase,
      salesPriceOn: form.salesPriceOn === "Alternate" && !altUnit ? "Main" : form.salesPriceOn,
    };

    const tracksQty = !clean.batchTracking && !clean.dontMaintainStock;

    if (editingItem) {
      setItems(prev => prev.map(i => {
        if (i.id !== editingItem.id) return i;
        // keep current stock in sync if the opening stock was corrected
        const delta = tracksQty ? n(clean.opStockQty) - n(i.opStockQty) : 0;
        return { ...i, ...clean, currentStock: i.currentStock + delta };
      }));
    } else {
      setItems(prev => [...prev, {
        ...clean,
        id: crypto.randomUUID(),
        currentStock: tracksQty ? n(clean.opStockQty) : 0,
        batches: [],
      }]);
    }
    closeModal();
  }

  function handleDelete(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
    setDeleteConfirmId(null);
    if (expandedItemId === id) setExpandedItemId(null);
  }

  function toggleExpandRow(id: string) {
    setExpandedItemId(prev => prev === id ? null : id);
  }

  /* ---- batch modal ---- */

  function openAddBatch(item: Item) {
    setBatchItemId(item.id);
    setBatchForm({
      ...EMPTY_BATCH_FORM,
      mrp: n(item.mrp) || "",
      salePrice: n(item.salesPrice) || "",
    });
    setIsBatchModalOpen(true);
  }

  function closeBatchModal() {
    setIsBatchModalOpen(false);
    setBatchItemId(null);
    setBatchForm(EMPTY_BATCH_FORM);
  }

  function handleSaveBatch(e: React.FormEvent) {
    e.preventDefault();
    if (!batchItemId || !batchForm.batchNo.trim() || batchForm.qty === "") return;

    setItems(prev => prev.map(i => i.id === batchItemId ? {
      ...i,
      batches: [...i.batches, {
        id: crypto.randomUUID(),
        batchNo: batchForm.batchNo.trim(),
        qty: Number(batchForm.qty),
        mfgDate: batchForm.mfgDate,
        expDate: batchForm.expDate,
        mrp: n(batchForm.mrp),
        salePrice: n(batchForm.salePrice),
      }],
    } : i));
    closeBatchModal();
  }

  function handleMfgChange(value: string) {
    setBatchForm(p => {
      const months = batchItem ? n(batchItem.expiryMonths) : 0;
      const autoExp = value && months > 0 ? addMonths(value, months) : p.expDate;
      return { ...p, mfgDate: value, expDate: autoExp };
    });
  }

  /* ---- render ---- */

  const unitRefOptions = [
    { value: "Main", label: `Main (${form.unit})` },
    ...(form.altUnit && form.altUnit !== form.unit ? [{ value: "Alternate", label: `Alternate (${form.altUnit})` }] : []),
    ...(form.packagingUnit && form.packagingUnit !== form.unit ? [{ value: "Packaging", label: `Packaging (${form.packagingUnit})` }] : []),
  ];
  const hasAlt = !!form.altUnit && form.altUnit !== form.unit;
  const hasPackaging = !!form.packagingUnit && form.packagingUnit !== form.unit;
  const tracksQty = !form.batchTracking && !form.dontMaintainStock;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="rounded-xl bg-[#044d73] px-6 py-5 text-white shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-white text-[#044d73] hover:bg-slate-50 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Add Item
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Items", value: stats.total, border: "border-l-slate-400", iconBg: "bg-slate-50 text-slate-600", icon: <Package className="h-5 w-5 sm:h-6 sm:w-6" /> },
          { label: "In Stock", value: stats.inStock, border: "border-l-emerald-500", iconBg: "bg-emerald-50 text-emerald-600", icon: <PackageCheck className="h-5 w-5 sm:h-6 sm:w-6" /> },
          { label: "Low Stock", value: stats.lowStock, border: "border-l-amber-500", iconBg: "bg-amber-50 text-amber-600", icon: <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" /> },
          { label: "Out of Stock", value: stats.outOfStock, border: "border-l-red-500", iconBg: "bg-red-50 text-red-500", icon: <PackageX className="h-5 w-5 sm:h-6 sm:w-6" /> },
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
            placeholder="Search by name, alias or HSN"
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
          />
        </div>
        <select
          value={stockFilter}
          onChange={e => { setStockFilter(e.target.value as typeof stockFilter); setCurrentPage(1); }}
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
                <th className="py-3 px-4">Item</th>
                <th className="py-3 px-4">Unit</th>
                <th className="py-3 px-4">Batch Tracking</th>
                <th className="py-3 px-4">Tax</th>
                <th className="py-3 px-4">Stock</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-sm text-slate-400">
                    No items match criteria.
                  </td>
                </tr>
              ) : paginated.map(item => {
                const stockLevel = getStockLevel(item);
                const stockStyle = STOCK_STYLE[stockLevel];
                const stock = itemStock(item);
                const rows = detailRows(item);
                const showMfg = usesMfg(item.expMfgRequired);
                const showExp = usesExp(item.expMfgRequired);
                return (
                  <Fragment key={item.id}>
                    <tr
                      onClick={() => toggleExpandRow(item.id)}
                      className={`hover:bg-slate-50/50 transition-colors text-slate-700 cursor-pointer ${expandedItemId === item.id ? "bg-slate-50/50 border-l-2 border-[#044d73]" : ""}`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${expandedItemId === item.id ? "rotate-180 text-[#044d73]" : ""}`} />
                          <div>
                            <span className="font-semibold text-slate-800">{item.name}</span>
                            {(item.alias || item.hsnCode) && (
                              <p className="text-[11px] text-slate-400">
                                {[item.alias, item.hsnCode && `HSN ${item.hsnCode}`].filter(Boolean).join(" • ")}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {item.unit}
                        {item.altUnit && <span className="text-xs text-slate-400"> / {item.altUnit}</span>}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold border ${item.batchTracking
                          ? "bg-[#044d73]/10 border-[#044d73]/20 text-[#044d73]"
                          : "bg-slate-50 border-slate-200 text-slate-400"
                          }`}>
                          {item.batchTracking && <Check className="w-2.5 h-2.5" />}
                          {item.batchTracking ? "Enabled" : "Off"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-500">{item.taxRate}%</td>
                      <td className="py-3 px-4">
                        {stockLevel === "not_tracked" ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span className="font-bold text-slate-800">
                            {stock} <span className="text-xs font-normal text-slate-400">{item.unit}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${stockStyle.bg} ${stockStyle.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${stockStyle.dot}`} />
                          {stockStyle.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                            title="Edit Item"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#044d73] hover:bg-[#044d73]/10 transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(item.id); }}
                            title="Delete"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedItemId === item.id && (
                      <tr className="bg-slate-50/30">
                        <td colSpan={7} className="px-4 py-4 border-b border-slate-100">
                          <div className="flex flex-col gap-4">
                            {/* Item details */}
                            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm w-full">
                              <h4 className="mb-4 pb-3 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5" /> Item Details
                              </h4>
                              {rows.length === 0 && !item.description ? (
                                <p className="text-xs text-slate-400 py-2">No additional details. Use Edit to add pricing, HSN code and more.</p>
                              ) : (
                                <>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
                                    {rows.map(([label, value]) => (
                                      <div key={label}>
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                                        <p className="text-xs font-medium text-slate-700 mt-0.5 break-words">{value}</p>
                                      </div>
                                    ))}
                                  </div>
                                  {item.description && (
                                    <p className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 whitespace-pre-wrap">{item.description}</p>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Batches */}
                            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm w-full">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                  <Boxes className="w-3.5 h-3.5" /> Batches
                                </h4>
                                {item.batchTracking && (
                                  <button
                                    onClick={() => openAddBatch(item)}
                                    className="flex items-center gap-1.5 text-xs font-semibold text-[#044d73] hover:underline"
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Add Batch
                                  </button>
                                )}
                              </div>

                              {!item.batchTracking ? (
                                <p className="text-xs text-slate-400 py-2">Batch tracking is off for this item — stock is tracked as a single quantity.</p>
                              ) : item.batches.length === 0 ? (
                                <p className="text-xs text-slate-400 py-2">No batches recorded yet.</p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                                        <th className="py-2 pr-4">Batch No.</th>
                                        <th className="py-2 pr-4">Qty</th>
                                        {showMfg && <th className="py-2 pr-4">Mfg. Date</th>}
                                        {showExp && <th className="py-2 pr-4">Exp. Date</th>}
                                        <th className="py-2 pr-4">MRP</th>
                                        <th className="py-2 pr-4">Sale Price</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                      {item.batches.map(b => (
                                        <tr key={b.id}>
                                          <td className="py-2 pr-4 font-semibold text-slate-700">{b.batchNo}</td>
                                          <td className="py-2 pr-4 text-slate-600">{b.qty} {item.unit}</td>
                                          {showMfg && <td className="py-2 pr-4 text-slate-500">{b.mfgDate || "—"}</td>}
                                          {showExp && <td className="py-2 pr-4 text-slate-500">{b.expDate || "—"}</td>}
                                          <td className="py-2 pr-4 text-slate-500">Rs. {b.mrp.toFixed(2)}</td>
                                          <td className="py-2 pr-4 text-slate-500">Rs. {b.salePrice.toFixed(2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
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

        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
            <span className="text-xs text-slate-400">
              Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filtered.length)}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} item{filtered.length !== 1 ? "s" : ""}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30">
                  <ChevronDown className="w-4 h-4 rotate-90" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setCurrentPage(p)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold ${currentPage === p ? "bg-[#044d73] text-white" : "border border-slate-200 text-slate-500"}`}>
                    {p}
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
                <h3 className="text-base font-semibold text-slate-900">Delete Item?</h3>
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

      {/* Add / Edit Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col rounded-xl shadow-xl overflow-hidden">
            <div className="relative flex shrink-0 flex-col items-center p-5 bg-[#044d73] text-white">
              <Package className="h-7 w-7 mb-1" />
              <h3 className="text-xl font-semibold">
                {editingItem ? "Edit Item" : "Add Item"}
              </h3>
              <button type="button" onClick={closeModal} className="absolute right-6 top-5 rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-7 overflow-y-auto p-6">
                {/* Basic */}
                <Section title="Basic Details">
                  <Field label="Item Name" span>
                    <TextInput required value={form.name} onChange={v => setField("name", v)} />
                  </Field>
                  <Field label="Alias">
                    <TextInput value={form.alias} onChange={v => setField("alias", v)} />
                  </Field>
                  <Field label="Print Name">
                    <TextInput value={form.printName} placeholder={form.name || "Same as item name"} onChange={v => setField("printName", v)} />
                  </Field>
                  <Field label="Group">
                    <CreatableSelect
                      value={form.group} options={groups} noun="group"
                      onChange={v => setField("group", v)} onCreate={addGroup}
                    />
                  </Field>
                  <Field label="HSN Code">
                    <TextInput value={form.hsnCode} onChange={v => setField("hsnCode", v)} />
                  </Field>
                  <Field label="Tax Rate">
                    <SelectInput
                      value={String(form.taxRate)}
                      onChange={v => setField("taxRate", Number(v))}
                      options={TAX_RATES.map(t => ({ value: String(t), label: `${t}%` }))}
                    />
                  </Field>
                  <Field label="Item Description" span>
                    <textarea
                      rows={2}
                      value={form.description}
                      onChange={e => setField("description", e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                </Section>

                {/* Units */}
                <Section title="Units">
                  <Field label="Main Unit">
                    <CreatableSelect
                      value={form.unit} options={units} noun="unit"
                      onChange={v => setField("unit", v)} onCreate={addUnit}
                    />
                  </Field>
                  <Field label="Alternate Unit">
                    <CreatableSelect
                      value={form.altUnit} options={units.filter(u => u !== form.unit)} noun="unit"
                      noneLabel="None"
                      onChange={v => setField("altUnit", v)} onCreate={addUnit}
                    />
                  </Field>
                  {hasAlt && (
                    <>
                      <Field label="Con. Factor" hint={`1 ${form.altUnit} = ? ${form.unit}`}>
                        <NumInput value={form.conFactor} step="any" onChange={v => setField("conFactor", v)} />
                      </Field>
                      <Field label="Con. Type">
                        <SelectInput
                          value={form.conType}
                          onChange={v => setField("conType", v as ItemDetails["conType"])}
                          options={[{ value: "Fixed", label: "Fixed" }, { value: "Variable", label: "Variable" }]}
                        />
                      </Field>
                    </>
                  )}
                  <Field label="Packaging Unit">
                    <CreatableSelect
                      value={form.packagingUnit} options={units.filter(u => u !== form.unit)} noun="unit"
                      noneLabel="None"
                      onChange={v => setField("packagingUnit", v)} onCreate={addUnit}
                    />
                  </Field>
                  {hasPackaging && (
                    <Field label="Packaging Con. Factor" hint={`1 ${form.packagingUnit} = ? ${form.unit}`}>
                      <NumInput value={form.packagingConFactor} step="any" onChange={v => setField("packagingConFactor", v)} />
                    </Field>
                  )}
                  {(hasAlt || hasPackaging) && (
                    <>
                      <Field label="Default Unit for Sales">
                        <SelectInput value={form.defaultUnitForSales} options={unitRefOptions}
                          onChange={v => setField("defaultUnitForSales", v as UnitRef)} />
                      </Field>
                      <Field label="Default Unit for Purchase">
                        <SelectInput value={form.defaultUnitForPurchase} options={unitRefOptions}
                          onChange={v => setField("defaultUnitForPurchase", v as UnitRef)} />
                      </Field>
                    </>
                  )}
                </Section>

                {/* Opening stock */}
                <Section title="Opening Stock">
                  {tracksQty && (
                    <Field label={`Op. Stock Qty (${form.unit})`}>
                      <NumInput value={form.opStockQty} step="any" onChange={v => setField("opStockQty", v)} />
                    </Field>
                  )}
                  {tracksQty && hasAlt && (
                    <Field label={`Alt. Op. Stock Qty (${form.altUnit})`}>
                      <NumInput value={form.altOpStockQty} step="any" onChange={v => setField("altOpStockQty", v)} />
                    </Field>
                  )}
                  <Field label="Op. Stock Value">
                    <NumInput value={form.opStockValue} onChange={v => setField("opStockValue", v)} />
                  </Field>
                  {form.batchTracking && (
                    <p className="sm:col-span-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                      Batch tracking is on, so quantity is recorded per batch. Save the item, then open its row and use “Add Batch”.
                    </p>
                  )}
                  {form.dontMaintainStock && (
                    <p className="sm:col-span-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                      Stock balance is not maintained for this item, so there is no opening quantity.
                    </p>
                  )}
                </Section>

                {/* Pricing */}
                <Section title="Pricing & Tax">
                  {hasAlt && (
                    <Field label="Sales Price Applied On" span>
                      <SelectInput value={form.salesPriceOn}
                        onChange={v => setField("salesPriceOn", v as ItemDetails["salesPriceOn"])}
                        options={[
                          { value: "Main", label: `Main Unit (${form.unit})` },
                          { value: "Alternate", label: `Alternate Unit (${form.altUnit})` },
                        ]} />
                    </Field>
                  )}
                  <Field label={`Sales Price (${form.salesPriceOn === "Alternate" && hasAlt ? form.altUnit : form.unit})`}>
                    <NumInput value={form.salesPrice} onChange={v => setField("salesPrice", v)} />
                  </Field>
                  <Field label={`Purc. Price (${form.unit})`}>
                    <NumInput value={form.purcPrice} onChange={v => setField("purcPrice", v)} />
                  </Field>
                  <Field label={`M.R.P. (${form.unit})`}>
                    <NumInput value={form.mrp} onChange={v => setField("mrp", v)} />
                  </Field>
                  <Field label={`Min. Sales Price (${form.unit})`} hint="Exclusive of taxes">
                    <NumInput value={form.minSalesPrice} onChange={v => setField("minSalesPrice", v)} />
                  </Field>
                  <Field label="Self-Val. Price">
                    <NumInput value={form.selfValPrice} onChange={v => setField("selfValPrice", v)} />
                  </Field>
                  {hasPackaging && (
                    <>
                      <Field label={`Packaging Sales Price (${form.packagingUnit})`}>
                        <NumInput value={form.packagingSalesPrice} onChange={v => setField("packagingSalesPrice", v)} />
                      </Field>
                      <Field label={`Packaging Purc. Price (${form.packagingUnit})`}>
                        <NumInput value={form.packagingPurcPrice} onChange={v => setField("packagingPurcPrice", v)} />
                      </Field>
                    </>
                  )}
                  <Toggle label="Tax Inclusive Sale Price" checked={form.taxInclusiveSale}
                    onChange={v => setField("taxInclusiveSale", v)} />
                  <Toggle label="Tax Inclusive Purchase" checked={form.taxInclusivePurchase}
                    onChange={v => setField("taxInclusivePurchase", v)} />
                </Section>

                {/* Discount & markup */}
                <Section title="Discount & Markup">
                  <Field label="Sale Discount (%)">
                    <NumInput value={form.saleDiscount} onChange={v => setField("saleDiscount", v)} />
                  </Field>
                  <Field label="Purc. Discount (%)">
                    <NumInput value={form.purcDiscount} onChange={v => setField("purcDiscount", v)} />
                  </Field>
                  <Field label="Sale Compound Disc. (%)">
                    <NumInput value={form.saleCompoundDisc} onChange={v => setField("saleCompoundDisc", v)} />
                  </Field>
                  <Field label="Purc. Compound Disc. (%)">
                    <NumInput value={form.purcCompoundDisc} onChange={v => setField("purcCompoundDisc", v)} />
                  </Field>
                  <Field label="Sale Markup (%)">
                    <NumInput value={form.saleMarkup} onChange={v => setField("saleMarkup", v)} />
                  </Field>
                  <Field label="Purc. Markup (%)">
                    <NumInput value={form.purcMarkup} onChange={v => setField("purcMarkup", v)} />
                  </Field>
                  <Field label="Sale Comp. Markup (%)">
                    <NumInput value={form.saleCompMarkup} onChange={v => setField("saleCompMarkup", v)} />
                  </Field>
                  <Field label="Purc. Comp. Markup (%)">
                    <NumInput value={form.purcCompMarkup} onChange={v => setField("purcCompMarkup", v)} />
                  </Field>
                  <Toggle label="Specify Sales Disc. Structure" checked={form.specifySalesDiscStructure}
                    onChange={v => setField("specifySalesDiscStructure", v)} />
                  <Toggle label="Specify Purc. Disc. Structure" checked={form.specifyPurcDiscStructure}
                    onChange={v => setField("specifyPurcDiscStructure", v)} />
                </Section>

                {/* Stock control */}
                <Section title="Stock Control & Tracking">
                  <Toggle label="Batch Tracking" hint="Track stock by batch no., mfg/exp date, and MRP"
                    checked={form.batchTracking} onChange={v => setField("batchTracking", v)} />
                  <Toggle label="Serial No-wise Details" checked={form.serialNoWise}
                    onChange={v => setField("serialNoWise", v)} />
                  <Toggle label="Don't Maintain Stock Balance" hint="Item won't show stock or low-stock alerts"
                    checked={form.dontMaintainStock} onChange={v => setField("dontMaintainStock", v)} />
                  <Toggle label="Set Critical Level" hint="Show “Low Stock” at or below the threshold"
                    checked={form.setCriticalLevel} onChange={v => setField("setCriticalLevel", v)} />
                  {form.setCriticalLevel && (
                    <Field label="Low Stock Threshold">
                      <NumInput value={form.minStockLevel} step="1" onChange={v => setField("minStockLevel", v)} />
                    </Field>
                  )}
                  {form.batchTracking && (
                    <>
                      <Field label="Exp./Mfg. Date Required">
                        <SelectInput value={form.expMfgRequired}
                          onChange={v => setField("expMfgRequired", v as ExpMfg)}
                          options={[
                            { value: "Both", label: "Both" },
                            { value: "Expiry", label: "Expiry only" },
                            { value: "Mfg", label: "Mfg. only" },
                            { value: "None", label: "None" },
                          ]} />
                      </Field>
                      {usesExp(form.expMfgRequired) && usesMfg(form.expMfgRequired) && (
                        <Field label="Expiry Months" hint="Auto-fills batch expiry from the mfg. date (0 = off)">
                          <NumInput value={form.expiryMonths} step="1" onChange={v => setField("expiryMonths", v)} />
                        </Field>
                      )}
                    </>
                  )}
                </Section>

                {/* Accounts */}
                <Section title="Accounts & Vendor">
                  <Field label="Sales Account">
                    <TextInput value={form.salesAcc} placeholder="Not required" onChange={v => setField("salesAcc", v)} />
                  </Field>
                  <Field label="Purchase Account">
                    <TextInput value={form.purcAcc} placeholder="Not required" onChange={v => setField("purcAcc", v)} />
                  </Field>
                  <Field label="Default Vendor" span>
                    <TextInput value={form.defaultVendor} onChange={v => setField("defaultVendor", v)} />
                  </Field>
                </Section>
              </div>

              <div className="flex shrink-0 gap-3 border-t border-slate-100 bg-white p-4 px-6">
                <button type="button" onClick={closeModal}
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-sm font-medium text-slate-600">Cancel</button>
                <button type="submit"
                  className="flex-1 rounded-lg bg-[#044d73] hover:bg-[#033f60] py-2.5 text-sm font-medium text-white shadow-sm transition-colors">
                  {editingItem ? "Save Changes" : "Add Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Batch Modal */}
      {isBatchModalOpen && batchItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeBatchModal}>
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="relative flex flex-col items-center p-6 bg-[#044d73] text-white">
              <Boxes className="h-7 w-7 mb-1" />
              <h3 className="text-xl font-semibold">Add Batch</h3>
              <p className="text-xs text-white/70 mt-0.5">{batchItem.name}</p>
              <button onClick={closeBatchModal} className="absolute right-6 top-6 rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={handleSaveBatch} className="space-y-4">
                <div>
                  <label className={labelCls}>Batch No.</label>
                  <input
                    type="text" required
                    value={batchForm.batchNo}
                    onChange={e => setBatchForm(p => ({ ...p, batchNo: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Quantity ({batchItem.unit})</label>
                    <input
                      type="number" step="1" min={1} required
                      value={batchForm.qty}
                      onChange={e => setBatchForm(p => ({ ...p, qty: e.target.value === "" ? "" : Number(e.target.value) }))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>MRP</label>
                    <input
                      type="number" step="0.01" min={0}
                      value={batchForm.mrp}
                      onChange={e => setBatchForm(p => ({ ...p, mrp: e.target.value === "" ? "" : Number(e.target.value) }))}
                      className={inputCls}
                    />
                  </div>
                </div>
                {(usesMfg(batchItem.expMfgRequired) || usesExp(batchItem.expMfgRequired)) && (
                  <div className="grid grid-cols-2 gap-4">
                    {usesMfg(batchItem.expMfgRequired) && (
                      <div>
                        <label className={labelCls}>Mfg. Date</label>
                        <input
                          type="month"
                          value={batchForm.mfgDate}
                          onChange={e => handleMfgChange(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    )}
                    {usesExp(batchItem.expMfgRequired) && (
                      <div>
                        <label className={labelCls}>Exp. Date</label>
                        <input
                          type="month"
                          value={batchForm.expDate}
                          onChange={e => setBatchForm(p => ({ ...p, expDate: e.target.value }))}
                          className={inputCls}
                        />
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className={labelCls}>Sale Price</label>
                  <input
                    type="number" step="0.01" min={0}
                    value={batchForm.salePrice}
                    onChange={e => setBatchForm(p => ({ ...p, salePrice: e.target.value === "" ? "" : Number(e.target.value) }))}
                    className={inputCls}
                  />
                </div>
                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button type="button" onClick={closeBatchModal}
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-sm font-medium text-slate-600">Cancel</button>
                  <button type="submit"
                    className="flex-1 rounded-lg bg-[#044d73] hover:bg-[#033f60] py-2.5 text-sm font-medium text-white shadow-sm transition-colors">
                    Add Batch
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}