"use client";

import { useState, useMemo, useRef, useEffect, Fragment, useCallback } from "react";
import {
  Plus, X, Pencil, Trash2, Search, ChevronDown, ChevronLeft, ChevronRight,
  Receipt, Wallet, CreditCard, Banknote, PackagePlus, Percent, Boxes, Check,
  AlertCircle, Calendar, RotateCcw, Printer, User, UserPlus, Package,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { AnimatedStatValue } from "../_components/ui/animated-stat-value";
import { DotsLoader } from "../_components/ui/dots-loader";
import { TaxInvoiceModal, TaxInvoiceData, InvoiceItem } from "../_components/TaxInvoiceModal";
import { PartialPaymentModal } from "../_components/PartialPaymentModal";
import { AddItemModal, CreatedProductItem } from "../_components/AddItemModal";

/* ------------------------------------------------------------------ */
/* Types — matches the real backend shapes                             */
/* ------------------------------------------------------------------ */

type Num = number | "";
type PaymentType = "CASH" | "CREDIT" | "BANK_TRANSFER" | "CHEQUE" | "MOBILE_PAYMENT";

const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  CASH: "Cash",
  CREDIT: "Credit",
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque",
  MOBILE_PAYMENT: "Mobile Payment",
};

const PAYMENT_TYPE_STYLES: Record<PaymentType, { badge: string; viewBadge: string }> = {
  CASH: {
    badge: "bg-emerald-50 border-emerald-200 text-emerald-700",
    viewBadge: "bg-emerald-400/20 border-emerald-300 text-emerald-100",
  },
  CREDIT: {
    badge: "bg-amber-50 border-amber-200 text-amber-700",
    viewBadge: "bg-amber-400/20 border-amber-300 text-amber-100",
  },
  BANK_TRANSFER: {
    badge: "bg-blue-50 border-blue-200 text-blue-700",
    viewBadge: "bg-blue-400/20 border-blue-300 text-blue-100",
  },
  CHEQUE: {
    badge: "bg-purple-50 border-purple-200 text-purple-700",
    viewBadge: "bg-purple-400/20 border-purple-300 text-purple-100",
  },
  MOBILE_PAYMENT: {
    badge: "bg-indigo-50 border-indigo-200 text-indigo-700",
    viewBadge: "bg-indigo-400/20 border-indigo-300 text-indigo-100",
  },
};
type PaymentStatus = "PAID" | "UNPAID" | "PARTIAL";

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PAID: "Paid",
  PARTIAL: "Partial",
  UNPAID: "Unpaid",
};

const PAYMENT_STATUS_STYLES: Record<PaymentStatus, { badge: string; viewBadge: string }> = {
  PAID: {
    badge: "bg-emerald-50 border-emerald-200 text-emerald-700",
    viewBadge: "bg-emerald-400/20 border-emerald-300 text-emerald-100",
  },
  PARTIAL: {
    badge: "bg-amber-50 border-amber-200 text-amber-700",
    viewBadge: "bg-amber-400/20 border-amber-300 text-amber-100",
  },
  UNPAID: {
    badge: "bg-rose-50 border-rose-200 text-rose-700",
    viewBadge: "bg-rose-400/20 border-rose-300 text-rose-100",
  },
};

type PurcType = "VAT_EXEMPT" | "VAT_ITEM_WISE" | "VAT_TAX_INCL";
type DiscountType = "Percentage" | "Flat";
type RoundingDirection = "UP" | "DOWN";

const PURC_TYPE_LABELS: Record<PurcType, string> = {
  VAT_EXEMPT: "VAT/Exempt",
  VAT_ITEM_WISE: "VAT/Item-wise",
  VAT_TAX_INCL: "VAT/TaxIncl.",
};

interface Product {
  id: string;
  name: string;
  aliasName: string | null;
  manufacturer: string | null;
  hsnCode?: string | null;
  unit: string;
  alternativeUnit: string | null;
  stockQuantity: number;
}

interface Supplier {
  id: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  panVatNumber?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  status?: boolean;
}

interface BatchDetails {
  batchNo: string;
  qty: Num;
  mfgDate: string;
  expDate: string;
  mrp: Num;
  salePrice: Num;
  note?: string;
}

interface LineItemForm {
  id: string;
  purchaseItemId?: string;
  itemId: string;
  itemName: string;
  unit: string;
  altUnit: string;
  qty: Num;
  price: Num;
  vatApplicable: boolean;
  batch: BatchDetails | null;
}

export type AdjustmentCategory =
  | "Discount"
  | "Freight and forwarding charges"
  | "Rounded off (-)"
  | "Rounded off (+)"
  | "VAT refund";

interface DiscountRowForm {
  id: string;
  category: AdjustmentCategory;
  amount: Num;
  type: DiscountType;
}

interface PurchaseForm {
  date: string;
  supplierInvoiceNumber: string;
  paymentType: PaymentType;
  paymentStatus: PaymentStatus;
  purcType: PurcType;
  vatRate: Num;
  partyId: string;
  partyName: string;
  note: string;
  items: LineItemForm[];
  discounts: DiscountRowForm[];
  roundingDirection: RoundingDirection;
}

// Shape returned by GET /purchases (list) and GET /purchases/:id
interface PurchaseRecord {
  id: string;
  purchaseDate: string;
  createdAt?: string;
  supplierInvoiceNumber: string | null;
  paymentType: PaymentType;
  paymentStatus?: PaymentStatus;
  purcType: PurcType;
  roundingDirection: RoundingDirection;
  subtotal: string;
  discount: string;
  freightCharges: string;
  vatAmount: string;
  vatRefund: string;
  roundOff?: string;
  grandTotal: string;
  note?: string | null;
  party?: Supplier;
  items: Array<{
    id: string;
    productId: string;
    batchNumber: string;
    manufacturingDate: string | null;
    expiryDate: string;
    quantity: number;
    purchaseRate: string;
    mrp: string;
    vatApplicable: boolean;
    lineTotal: string;
    batch?: { salePrice: string | null; note: string | null } | null;
  }>;
  payments?: Array<{
    id: string;
    amount: string | number;
    paymentDate: string;
    method?: string | null;
    referenceNumber?: string | null;
    notes?: string | null;
    createdAt?: string;
  }>;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function emptyBatch(qty: Num = ""): BatchDetails {
  return { batchNo: "", qty, mfgDate: "", expDate: "", mrp: "", salePrice: "", note: "" };
}

function emptyLine(): LineItemForm {
  return {
    id: crypto.randomUUID(),
    itemId: "",
    itemName: "",
    unit: "",
    altUnit: "",
    vatApplicable: true,
    qty: "",
    price: "",
    batch: null,
  };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function emptyDiscount(): DiscountRowForm {
  return { id: crypto.randomUUID(), category: "Discount", amount: "", type: "Flat" };
}

function emptyForm(): PurchaseForm {
  return {
    date: todayISO(),
    supplierInvoiceNumber: "",
    paymentType: "CASH",
    paymentStatus: "PAID",
    purcType: "VAT_EXEMPT",
    vatRate: 13,
    partyId: "",
    partyName: "",
    note: "",
    items: [emptyLine()],
    discounts: [],
    roundingDirection: "DOWN",
  };
}

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
function calculateAdjustmentsBreakdown(
  discounts: DiscountRowForm[],
  subtotal: number,
  vatEstimate: number
) {
  let discountTotal = 0;
  let freightTotal = 0;
  let vatRefundTotal = 0;

  for (const d of discounts) {
    const val = discountValue(d, subtotal);
    switch (d.category) {
      case "Freight and forwarding charges":
        freightTotal += val;
        break;
      case "VAT refund":
        vatRefundTotal += val;
        break;
      case "Discount":
        discountTotal += val;
        break;
      default:
        break;
    }
  }

  // Base raw total before rounding adjustments
  const baseBeforeRound = subtotal - discountTotal + freightTotal + vatEstimate - vatRefundTotal;

  const roundPlusRow = discounts.find((d) => d.category === "Rounded off (+)");
  const roundMinusRow = discounts.find((d) => d.category === "Rounded off (-)");

  let roundOffMinusTotal = 0;
  let roundOffPlusTotal = 0;
  let effectiveRoundingDirection: RoundingDirection = "DOWN";

  if (roundPlusRow) {
    effectiveRoundingDirection = "UP";
    if (roundPlusRow.amount !== "" && n(roundPlusRow.amount) > 0) {
      roundOffPlusTotal = discountValue(roundPlusRow, subtotal);
    } else {
      const ceilDiff = Math.ceil(baseBeforeRound) - baseBeforeRound;
      roundOffPlusTotal = Number(ceilDiff.toFixed(2));
    }
  } else if (roundMinusRow) {
    effectiveRoundingDirection = "DOWN";
    if (roundMinusRow.amount !== "" && n(roundMinusRow.amount) > 0) {
      roundOffMinusTotal = discountValue(roundMinusRow, subtotal);
    } else {
      const floorDiff = baseBeforeRound - Math.floor(baseBeforeRound);
      roundOffMinusTotal = Number(floorDiff.toFixed(2));
    }
  }

  return {
    discountTotal,
    freightTotal,
    roundOffMinusTotal,
    roundOffPlusTotal,
    vatRefundTotal,
    effectiveRoundingDirection,
  };
}
function estimateVat(items: LineItemForm[], purcType: PurcType, vatRate: Num) {
  const rate = n(vatRate);
  const subtotal = subtotalOf(items);
  if (purcType === "VAT_EXEMPT") return 0;
  if (purcType === "VAT_ITEM_WISE") {
    const vatableSubtotal = items.reduce(
      (s, li) => (li.vatApplicable ? s + lineAmount(li) : s),
      0
    );
    return (vatableSubtotal * rate) / 100;
  }
  return subtotal - subtotal / (1 + rate / 100);
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

function ItemPicker({
  value,
  selectedName,
  onSelect,
  products,
  onStartNewItem,
}: {
  value: string;
  selectedName?: string;
  onSelect: (item: Product) => void;
  products: Product[];
  onStartNewItem?: (name?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selected = products.find(c => c.id === value) ?? null;
  const displayName = selected?.name || selectedName || "";
  const filtered = products.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    (c.aliasName ?? "").toLowerCase().includes(query.toLowerCase())
  );

  function toggleOpen() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 320) });
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
          setCoords({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 320) });
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
        className={`flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-xs sm:text-sm transition-all ${open ? "border-[#044d73] ring-2 ring-[#044d73]/20 bg-white" : "border-slate-200 bg-white hover:border-slate-300"
          }`}
      >
        <span className={`truncate ${displayName ? "font-semibold text-slate-800" : "text-slate-400"}`}>
          {displayName || "Select item..."}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && coords && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => { setOpen(false); setQuery(""); }} />
          <div
            style={{ top: `${coords.top}px`, left: `${coords.left}px`, width: `${coords.width}px` }}
            className="fixed z-[101] max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl animate-in fade-in-50 zoom-in-95 duration-100 flex flex-col"
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
              <div className="p-4 text-center">
                <p className="text-xs text-slate-400 mb-2">No matching items found.</p>
                {onStartNewItem && (
                  <button
                    type="button"
                    onClick={() => {
                      const q = query.trim();
                      setOpen(false);
                      setQuery("");
                      onStartNewItem(q);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#044d73] text-white text-xs font-semibold hover:bg-[#033f60] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Add &ldquo;{query.trim() || "New Item"}&rdquo;
                  </button>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <div className="py-1">
                  {filtered.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { onSelect(c); setOpen(false); setQuery(""); }}
                      className={`flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors ${selected?.id === c.id ? "bg-[#044d73]/5 font-semibold text-[#044d73]" : "text-slate-700"
                        }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{c.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Stock: {c.stockQuantity} {c.unit}
                          {c.alternativeUnit && ` / ${c.alternativeUnit}`}
                          {c.manufacturer && ` · ${c.manufacturer}`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {onStartNewItem && filtered.length > 0 && (
              <div className="sticky bottom-0 border-t border-slate-100 bg-slate-50 p-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const q = query.trim();
                    setOpen(false);
                    setQuery("");
                    onStartNewItem(q);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#044d73]/40 bg-white hover:bg-[#044d73]/5 py-2 text-xs font-semibold text-[#044d73] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> + Add New Item {query.trim() ? `"${query.trim()}"` : "to Inventory"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SupplierPicker({
  value,
  selectedName,
  onSelect,
  suppliers,
  onStartNewParty,
}: {
  value: string;
  selectedName?: string;
  onSelect: (supplier: Supplier | null) => void;
  suppliers: Supplier[];
  onStartNewParty: (name?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeSuppliers = suppliers.filter((s) => Boolean(s.status));
  const filtered = query.trim()
    ? activeSuppliers.filter(
        (s) =>
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          (s.phone ?? "").includes(query) ||
          (s.panVatNumber ?? "").includes(query)
      )
    : activeSuppliers;

  const exactMatch = activeSuppliers.some((s) => s.name.toLowerCase() === query.trim().toLowerCase());
  const currentDisplay = open ? query : (selectedName || activeSuppliers.find(s => s.id === value)?.name || "");

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={currentDisplay}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setQuery(selectedName || activeSuppliers.find(s => s.id === value)?.name || "");
            setOpen(true);
          }}
          placeholder="Search or select party..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm text-slate-700 transition-all placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
        />
        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        {value ? (
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setQuery("");
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded"
            title="Clear selection"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {/* Add new party button / option */}
          <div
            onClick={() => {
              onStartNewParty(query.trim());
              setOpen(false);
            }}
            className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50/70 px-3.5 py-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100/80 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-emerald-600" />
              <span>
                {query.trim().length > 0 && !exactMatch ? (
                  <>Add <strong>&ldquo;{query.trim()}&rdquo;</strong> with details...</>
                ) : (
                  <>+ Add New Party</>
                )}
              </span>
            </div>
            <span className="text-[10px] text-emerald-700 font-normal">Phone, email, address, PAN</span>
          </div>

          {filtered.length === 0 && !query.trim() ? (
            <p className="p-3 text-center text-xs text-slate-400">No active parties registered yet.</p>
          ) : filtered.length === 0 && query.trim() ? (
            <p className="p-3 text-center text-xs text-slate-400">No matching parties found.</p>
          ) : (
            <div className="py-1">
              {filtered.map((s) => (
                <div
                  key={s.id}
                  onClick={() => {
                    onSelect(s);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`flex items-center justify-between px-3.5 py-2 text-left text-xs hover:bg-slate-50 cursor-pointer transition-colors ${
                    value === s.id ? "bg-[#044d73]/5 font-semibold text-[#044d73]" : "text-slate-700"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{s.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 truncate">
                      {s.phone ? <span>Ph: {s.phone}</span> : <span>No phone</span>}
                      {s.panVatNumber && <span>· PAN: {s.panVatNumber}</span>}
                      {s.paymentTerms && <span>· {s.paymentTerms}</span>}
                    </div>
                  </div>
                  {value === s.id && <Check className="h-3.5 w-3.5 text-[#044d73] shrink-0" />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const ITEMS_PER_PAGE = 8;

export default function PurchasePage() {
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);

  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingPurchases, setLoadingPurchases] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<string>("ALL");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("ALL");
  const [supplierFilter, setSupplierFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [currentPage, setCurrentPage] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [viewingPurchase, setViewingPurchase] = useState<PurchaseRecord | null>(null);
  const [printInvoiceData, setPrintInvoiceData] = useState<TaxInvoiceData | null>(null);
  const [form, setForm] = useState<PurchaseForm>(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [expandedLineIds, setExpandedLineIds] = useState<string[]>([]);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [partialModalTarget, setPartialModalTarget] = useState<{
    id: string;
    invoiceNumber: string;
    partyName?: string;
    totalAmount: number;
    alreadyPaid: number;
    initialAmount?: number;
    existingPayments?: Array<any>;
  } | null>(null);

  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [addItemInitialName, setAddItemInitialName] = useState("");
  const [targetLineIdForNewItem, setTargetLineIdForNewItem] = useState<string | null>(null);

  const existingBrands = useMemo(
    () => Array.from(new Set(products.map(p => p.manufacturer?.trim()).filter((b): b is string => Boolean(b)))),
    [products]
  );

  function handleStartNewItem(lineId?: string, initialName: string = "") {
    setTargetLineIdForNewItem(lineId ?? null);
    setAddItemInitialName(initialName);
    setIsAddItemModalOpen(true);
  }

  function handleItemCreated(newProduct: CreatedProductItem) {
    const formatted: Product = {
      id: newProduct.id,
      name: newProduct.name,
      aliasName: newProduct.aliasName ?? null,
      manufacturer: newProduct.manufacturer ?? null,
      hsnCode: newProduct.hsnCode ?? null,
      unit: newProduct.unit,
      alternativeUnit: newProduct.alternativeUnit ?? null,
      stockQuantity: newProduct.stockQuantity ?? 0,
    };
    setProducts(prev => {
      const exists = prev.some(p => p.id === formatted.id);
      if (exists) return prev;
      return [formatted, ...prev];
    });

    let targetId = targetLineIdForNewItem;
    setForm(p => {
      // If targetId is not specified or doesn't exist, pick the first empty row
      if (!targetId || !p.items.some(li => li.id === targetId)) {
        const emptyLineItem = p.items.find(li => !li.itemId);
        if (emptyLineItem) {
          targetId = emptyLineItem.id;
        }
      }

      // If all rows already have items selected, append a new line with this product
      if (!targetId) {
        const newLine: LineItemForm = {
          ...emptyLine(),
          itemId: formatted.id,
          itemName: formatted.name,
          unit: formatted.unit,
          altUnit: formatted.alternativeUnit ?? "",
          qty: 1,
          batch: emptyBatch(1),
        };
        targetId = newLine.id;
        setExpandedLineIds(prev => prev.includes(newLine.id) ? prev : [...prev, newLine.id]);
        return {
          ...p,
          items: [...p.items, newLine],
        };
      }

      // Auto-select into the target row and expand batch
      setExpandedLineIds(prev => prev.includes(targetId!) ? prev : [...prev, targetId!]);
      return {
        ...p,
        items: p.items.map(li => {
          if (li.id !== targetId) return li;
          return {
            ...li,
            itemId: formatted.id,
            itemName: formatted.name,
            unit: formatted.unit,
            altUnit: formatted.alternativeUnit ?? "",
            qty: li.qty || 1,
            batch: emptyBatch(li.qty || 1),
          };
        }),
      };
    });

    setTargetLineIdForNewItem(null);
  }

  const [showNewPartyInline, setShowNewPartyInline] = useState(false);
  const [inlineParty, setInlineParty] = useState({
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    panVatNumber: "",
    paymentTerms: "",
    address: "",
  });
  const [savingInlineParty, setSavingInlineParty] = useState(false);
  const [inlinePartyError, setInlinePartyError] = useState<string | null>(null);

  async function handleSaveInlineParty() {
    if (!inlineParty.name.trim()) {
      setInlinePartyError("Party name is required.");
      return;
    }
    setSavingInlineParty(true);
    setInlinePartyError(null);

    const payload: {
      name: string;
      partyType: "BOTH";
      contactPerson?: string;
      phone?: string;
      email?: string;
      address?: string;
      panVatNumber?: string;
      paymentTerms?: string;
    } = {
      name: inlineParty.name.trim(),
      partyType: "BOTH",
    };
    if (inlineParty.contactPerson.trim()) payload.contactPerson = inlineParty.contactPerson.trim();
    if (inlineParty.phone.trim()) payload.phone = inlineParty.phone.trim();
    if (inlineParty.email.trim()) payload.email = inlineParty.email.trim();
    if (inlineParty.panVatNumber.trim()) payload.panVatNumber = inlineParty.panVatNumber.trim();
    if (inlineParty.paymentTerms.trim()) payload.paymentTerms = inlineParty.paymentTerms.trim();
    if (inlineParty.address.trim()) payload.address = inlineParty.address.trim();

    try {
      const res = await api.post("/api/parties", payload);
      const created: Supplier = res.data.party;
      setSuppliers((prev) => [created, ...prev]);
      setForm((p) => ({
        ...p,
        partyId: created.id,
        partyName: created.name,
      }));
      setShowNewPartyInline(false);
      setInlineParty({ name: "", contactPerson: "", phone: "", email: "", panVatNumber: "", paymentTerms: "", address: "" });
    } catch (err: any) {
      setInlinePartyError(
        err?.response?.data?.details?.fieldErrors?.email?.[0] ||
        err?.response?.data?.error ||
        "Failed to create party."
      );
    } finally {
      setSavingInlineParty(false);
    }
  }

  function handleStartNewPartyInline(initialName: string = "") {
    setInlineParty({ name: initialName, contactPerson: "", phone: "", email: "", panVatNumber: "", paymentTerms: "", address: "" });
    setInlinePartyError(null);
    setShowNewPartyInline(true);
  }

  function getPurchasePaymentInfo(p: PurchaseRecord) {
    const total = parseFloat(p.grandTotal) || 0;
    const paid = (p.payments ?? []).reduce((sum, pay) => sum + (parseFloat(String(pay.amount)) || 0), 0);
    const effectivePaid = p.paymentStatus === "PAID" && paid === 0 ? total : paid;
    const remaining = p.paymentStatus === "PAID" ? 0 : Math.max(0, total - effectivePaid);
    return { total, paid: effectivePaid, remaining };
  }

  function openPaymentModal(purchase: PurchaseRecord, mode: "PARTIAL" | "REMAINING" = "PARTIAL") {
    const { total, paid, remaining } = getPurchasePaymentInfo(purchase);
    setPartialModalTarget({
      id: purchase.id,
      invoiceNumber: purchase.supplierInvoiceNumber || `PUR-${purchase.id.slice(0, 6)}`,
      partyName: purchase.party?.name,
      totalAmount: total,
      alreadyPaid: paid,
      initialAmount: mode === "REMAINING" ? remaining : (remaining > 0 ? remaining : total),
      existingPayments: purchase.payments,
    });
  }

  /* ---- initial catalog load: products + suppliers, in parallel ---- */

  useEffect(() => {
    async function loadCatalog() {
      setLoadingCatalog(true);
      try {
        const [productsRes, suppliersRes] = await Promise.all([
          api.get("/api/product"),
          api.get("/api/parties", { params: { limit: 100, type: "SUPPLIER" } }),
        ]);
        setProducts(productsRes.data.products);
        setSuppliers(suppliersRes.data.parties);
      } catch {
        setLoadError("Failed to load products/suppliers.");
      } finally {
        setLoadingCatalog(false);
      }
    }
    loadCatalog();
  }, []);

  /* ---- purchases list — loads purchases for client-side search & filtering ---- */

  const loadPurchases = useCallback(async () => {
    setLoadingPurchases(true);
    setLoadError(null);
    try {
      const firstRes = await api.get("/api/purchases", { params: { page: 1, limit: 100 } });
      let all: PurchaseRecord[] = firstRes.data.purchases || [];
      const totalPages = firstRes.data.pagination?.totalPages ?? 1;

      if (totalPages > 1) {
        const remainingRequests = [];
        for (let p = 2; p <= totalPages; p++) {
          remainingRequests.push(api.get("/api/purchases", { params: { page: p, limit: 100 } }));
        }
        const restRes = await Promise.all(remainingRequests);
        for (const r of restRes) {
          if (r.data.purchases) {
            all = all.concat(r.data.purchases);
          }
        }
      }
      setPurchases(all);
    } catch {
      setLoadError("Failed to load purchases.");
    } finally {
      setLoadingPurchases(false);
    }
  }, []);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  /* ---- Filter logic ---- */

  const isFiltered = Boolean(
    search.trim() ||
    paymentFilter !== "ALL" ||
    paymentStatusFilter !== "ALL" ||
    supplierFilter !== "ALL" ||
    dateFrom ||
    dateTo
  );

  const clearAllFilters = () => {
    setSearch("");
    setPaymentFilter("ALL");
    setPaymentStatusFilter("ALL");
    setSupplierFilter("ALL");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      // 1. Payment filter
      if (paymentFilter !== "ALL" && p.paymentType !== paymentFilter) {
        return false;
      }

      // Payment Status filter
      if (paymentStatusFilter !== "ALL") {
        const status = p.paymentStatus ?? (p.paymentType === "CREDIT" ? "UNPAID" : "PAID");
        if (status !== paymentStatusFilter) return false;
      }

      // 3. Supplier filter
      if (supplierFilter !== "ALL" && p.party?.id !== supplierFilter) {
        return false;
      }

      // 4. Date range filter
      const pDate = p.purchaseDate ? p.purchaseDate.slice(0, 10) : "";
      if (dateFrom && pDate < dateFrom) {
        return false;
      }
      if (dateTo && pDate > dateTo) {
        return false;
      }

      // 5. Search query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const invoiceMatch = p.supplierInvoiceNumber?.toLowerCase().includes(q) ?? false;
        const supplierMatch = p.party?.name?.toLowerCase().includes(q) ?? false;
        const dateMatch = p.purchaseDate?.includes(q) ?? false;
        const totalMatch = p.grandTotal?.includes(q) ?? false;
        const itemsMatch = p.items?.some((it) => {
          const prodName = products.find((prod) => prod.id === it.productId)?.name;
          const matchName = prodName?.toLowerCase().includes(q) ?? false;
          const matchBatch = it.batchNumber?.toLowerCase().includes(q) ?? false;
          return matchName || matchBatch;
        }) ?? false;

        if (!invoiceMatch && !supplierMatch && !itemsMatch && !dateMatch && !totalMatch) {
          return false;
        }
      }

      return true;
    });
  }, [purchases, paymentFilter, supplierFilter, dateFrom, dateTo, search, products]);

  const sortedPurchases = useMemo(() => {
    return [...filteredPurchases].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      const dateA = a.purchaseDate || "";
      const dateB = b.purchaseDate || "";
      return dateB.localeCompare(dateA);
    });
  }, [filteredPurchases]);

  const totalItems = sortedPurchases.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

  const paginatedPurchases = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedPurchases.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedPurchases, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  /* ---- stats ---- */

  const stats = useMemo(() => ({
    total: purchases.length,
    amount: purchases.reduce((s, p) => s + Number(p.grandTotal || 0), 0),
    cash: purchases.filter(p => p.paymentType === "CASH").length,
    credit: purchases.filter(p => p.paymentType === "CREDIT").length,
  }), [purchases]);

  /* ---- purchase modal ---- */

  function openAdd() {
    setEditingPurchaseId(null);
    setForm(emptyForm());
    setExpandedLineIds([]);
    setSaveError(null);
    setShowNewPartyInline(false);
    setInlineParty({ name: "", contactPerson: "", phone: "", email: "", panVatNumber: "", paymentTerms: "", address: "" });
    setInlinePartyError(null);
    setIsModalOpen(true);
  }

  function generateRandomInvoiceNo(seed?: string): string {
    if (!seed) return String(Math.floor(100000 + Math.random() * 900000));
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    return String(100000 + (Math.abs(hash) % 900000));
  }

  const handlePrintPurchase = (purchase: PurchaseRecord) => {
    const partyObj = suppliers.find((s) => s.id === purchase.party?.id) || purchase.party;
    let vatableTotal = 0;
    let nonVatableTotal = 0;

    const items: InvoiceItem[] = purchase.items.map((li, index) => {
      const prod = products.find((p) => p.id === li.productId);
      const isVat = li.vatApplicable !== false;
      const amt = Number(li.lineTotal);
      if (isVat) {
        vatableTotal += amt;
      } else {
        nonVatableTotal += amt;
      }

      return {
        sn: index + 1,
        itemCode: prod?.aliasName || `ITM-${String(index + 1).padStart(3, "0")}`,
        hsNo: prod?.hsnCode || "—",
        name: prod?.name || "Product",
        company: prod?.manufacturer || "—",
        quantity: Number(li.quantity),
        unit: prod?.unit || "Pcs",
        rate: Number(li.purchaseRate),
        amount: amt,
        batchNumber: li.batchNumber,
        expiryDate: li.expiryDate,
      };
    });

    const discount = Number(purchase.discount || 0);
    const taxableAmount = Math.max(0, vatableTotal - discount);

    setPrintInvoiceData({
      type: "PURCHASE",
      invoiceNumber: purchase.supplierInvoiceNumber || generateRandomInvoiceNo(purchase.id),
      date: purchase.purchaseDate ? purchase.purchaseDate.split("T")[0] : "",
      partyName: partyObj?.name || (purchase.party?.name ?? "Supplier"),
      partyAddress: (partyObj as any)?.address || undefined,
      partyPan: (partyObj as any)?.panVatNumber || undefined,
      partyPhone: (partyObj as any)?.phone || undefined,
      paymentType: purchase.paymentType,
      items,
      subtotal: Number(purchase.subtotal),
      discount,
      freightCharges: Number(purchase.freightCharges || 0),
      vatRefund: Number(purchase.vatRefund || 0),
      taxableAmount: Number(purchase.vatAmount) > 0 ? taxableAmount : (vatableTotal > 0 ? taxableAmount : 0),
      nonTaxableAmount: nonVatableTotal,
      vatAmount: Number(purchase.vatAmount || 0),
      roundOff: Number(purchase.roundOff || 0),
      grandTotal: Number(purchase.grandTotal),
    });
  };

  async function openEdit(record: PurchaseRecord) {
    setEditingPurchaseId(record.id);
    setSaveError(null);

    setForm({
      date: record.purchaseDate,
      supplierInvoiceNumber: record.supplierInvoiceNumber ?? "",
      paymentType: record.paymentType,
      paymentStatus: record.paymentStatus ?? (record.paymentType === "CREDIT" ? "UNPAID" : "PAID"),
      purcType: record.purcType,
      vatRate: 13,
      partyId: record.party?.id ?? "",
      partyName: record.party?.name ?? "",
      note: record.note ?? "",
      items: record.items.map((it) => {
        const product = products.find((p) => p.id === it.productId);
        return {
          id: crypto.randomUUID(),
          purchaseItemId: it.id,
          itemId: it.productId,
          itemName: product?.name ?? "",
          unit: product?.unit ?? "",
          altUnit: product?.alternativeUnit ?? "",
          vatApplicable: it.vatApplicable,
          qty: it.quantity,
          price: Number(it.purchaseRate),
          batch: {
            batchNo: it.batchNumber,
            qty: it.quantity,
            mfgDate: it.manufacturingDate ?? "",
            expDate: it.expiryDate,
            mrp: Number(it.mrp),
            salePrice: it.batch?.salePrice ? Number(it.batch.salePrice) : "",
            note: it.batch?.note ?? "", // ADDED — restores the saved note when editing
          },
        };
      }),
      discounts: [
        ...(Number(record.discount) > 0
          ? [{ id: crypto.randomUUID(), category: "Discount" as const, amount: Number(record.discount), type: "Flat" as const }]
          : []),
        ...(Number(record.freightCharges) > 0
          ? [{ id: crypto.randomUUID(), category: "Freight and forwarding charges" as const, amount: Number(record.freightCharges), type: "Flat" as const }]
          : []),
        ...(Number(record.vatRefund) > 0
          ? [{ id: crypto.randomUUID(), category: "VAT refund" as const, amount: Number(record.vatRefund), type: "Flat" as const }]
          : []),
        ...(Number(record.roundOff) < 0
          ? [{ id: crypto.randomUUID(), category: "Rounded off (-)" as const, amount: Math.abs(Number(record.roundOff)), type: "Flat" as const }]
          : Number(record.roundOff) > 0
            ? [{ id: crypto.randomUUID(), category: "Rounded off (+)" as const, amount: Number(record.roundOff), type: "Flat" as const }]
            : []),
      ],
      roundingDirection: record.roundingDirection ?? "DOWN",
    });
    setExpandedLineIds([]);
    setShowNewPartyInline(false);
    setInlineParty({ name: "", contactPerson: "", phone: "", email: "", panVatNumber: "", paymentTerms: "", address: "" });
    setInlinePartyError(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingPurchaseId(null);
    setExpandedLineIds([]);
    setSaveError(null);
    setShowNewPartyInline(false);
    setInlineParty({ name: "", contactPerson: "", phone: "", email: "", panVatNumber: "", paymentTerms: "", address: "" });
    setInlinePartyError(null);
  }

  function toggleBatchExpand(id: string) {
    setExpandedLineIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function updateLine(id: string, patch: Partial<LineItemForm>) {
    setForm(p => ({
      ...p,
      items: p.items.map(li => {
        if (li.id !== id) return li;
        const updated = { ...li, ...patch };
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
        const newQty = patch.qty !== undefined && patch.qty !== "" ? patch.qty : li.qty;
        return { ...li, qty: newQty, batch: updatedBatch };
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
    setForm((p) => ({ ...p, discounts: [...p.discounts, emptyDiscount()] }));
  }
  function removeDiscount(id: string) {
    setForm((p) => ({ ...p, discounts: p.discounts.filter((d) => d.id !== id) }));
  }
  function updateDiscount(id: string, patch: Partial<DiscountRowForm>) {
    setForm((p) => {
      let nextRounding = p.roundingDirection;
      if (patch.category === "Rounded off (-)") {
        nextRounding = "DOWN";
      } else if (patch.category === "Rounded off (+)") {
        nextRounding = "UP";
      }
      return {
        ...p,
        roundingDirection: nextRounding,
        discounts: p.discounts.map((d) => {
          if (d.id !== id) return d;
          const updated = { ...d, ...patch };
          if (patch.category === "Rounded off (-)" || patch.category === "Rounded off (+)") {
            updated.type = "Flat";
          }
          return updated;
        }),
      };
    });
  }

  const validItems = form.items.filter(li => li.itemId && n(li.qty) > 0);
  const missingBatch = form.items.some(
    li => li.itemId && n(li.qty) > 0 && (!li.batch?.batchNo || !li.batch.batchNo.trim())
  );
  const missingExpiry = form.items.some(
    li => li.itemId && n(li.qty) > 0 && (!li.batch?.expDate || !li.batch.expDate.trim())
  );

  const subtotal = subtotalOf(form.items);
  const vatEstimate = estimateVat(form.items, form.purcType, form.vatRate);
  const adjustments = calculateAdjustmentsBreakdown(form.discounts, subtotal, vatEstimate);
  const hasRoundingAdjustment = form.discounts.some(
    (d) => d.category === "Rounded off (-)" || d.category === "Rounded off (+)"
  );
  const rawTotalEstimate =
    subtotal -
    adjustments.discountTotal +
    adjustments.freightTotal +
    vatEstimate -
    adjustments.vatRefundTotal -
    adjustments.roundOffMinusTotal +
    adjustments.roundOffPlusTotal;
  const grandTotalEstimate = hasRoundingAdjustment
    ? (adjustments.effectiveRoundingDirection === "UP"
      ? Math.ceil(rawTotalEstimate)
      : Math.floor(rawTotalEstimate))
    : rawTotalEstimate;

  function buildPayload() {
    const roundOffValue =
      adjustments.roundOffPlusTotal > 0
        ? adjustments.roundOffPlusTotal
        : adjustments.roundOffMinusTotal > 0
          ? -adjustments.roundOffMinusTotal
          : 0;

    return {
      partyId: form.partyId,
      supplierInvoiceNumber: form.supplierInvoiceNumber.trim() || undefined,
      purchaseDate: form.date,
      purcType: form.purcType,
      paymentType: form.paymentType,
      roundingDirection: adjustments.effectiveRoundingDirection,
      discount: adjustments.discountTotal,
      freightCharges: adjustments.freightTotal,
      vatRefund: adjustments.vatRefundTotal,
      roundOff: roundOffValue,
      vatRate: n(form.vatRate),
      note: form.note.trim(), // "" clears the note on edit
      items: validItems.map((li) => ({
        ...(li.purchaseItemId ? { purchaseItemId: li.purchaseItemId } : {}),
        productId: li.itemId,
        purchaseRate: n(li.price),
        vatApplicable: li.vatApplicable,
        batch: {
          batchNumber: li.batch!.batchNo.trim(),
          quantity: n(li.qty),
          expiryDate: li.batch!.expDate,
          manufacturingDate: li.batch!.mfgDate || undefined,
          mrp: li.batch!.mrp === "" ? undefined : n(li.batch!.mrp),
          salePrice: li.batch!.salePrice === "" ? undefined : n(li.batch!.salePrice),
          note: li.batch!.note?.trim() || undefined, // ADDED — was being dropped before this
        },
      })),
    };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.partyId || validItems.length === 0 || missingBatch || missingExpiry) return;

    setSaving(true);
    setSaveError(null);

    try {
      const payload = buildPayload();
      if (editingPurchaseId) {
        await api.patch(`/api/purchases/${editingPurchaseId}`, payload);
      } else {
        await api.post("/api/purchases", payload);
        setCurrentPage(1);
      }
      closeModal();
      await Promise.all([loadPurchases(), api.get("/api/product").then(r => setProducts(r.data.products))]);
    } catch (err: any) {
      setSaveError(err?.response?.data?.error ?? "Failed to save purchase.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/api/purchases/${id}`);
      setDeleteConfirmId(null);
      await loadPurchases();
    } catch (err: any) {
      setDeleteError(err?.response?.data?.error ?? "Failed to delete purchase — it may already have stock sold from it.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleStatusChange(purchaseId: string, newStatus: PaymentStatus) {
    const purchase = purchases.find((p) => p.id === purchaseId) ?? (viewingPurchase?.id === purchaseId ? viewingPurchase : null);
    if (!purchase) return;

    const { remaining } = getPurchasePaymentInfo(purchase);

    if (newStatus === "PARTIAL") {
      openPaymentModal(purchase, "PARTIAL");
      return;
    }

    if (newStatus === "PAID" && remaining > 0.01) {
      openPaymentModal(purchase, "REMAINING");
      return;
    }

    const previous = purchase.paymentStatus;

    // update the UI first so the dropdown feels instant
    setPurchases((prev) => prev.map((item) => (item.id === purchaseId ? { ...item, paymentStatus: newStatus } : item)));
    setViewingPurchase((prev) => (prev?.id === purchaseId ? { ...prev, paymentStatus: newStatus } : prev));

    setStatusUpdatingId(purchaseId);
    try {
      const res = await api.patch(`/api/purchases/${purchaseId}/status`, { paymentStatus: newStatus });
      if (res.data?.purchase) {
        setPurchases((prev) => prev.map((item) => (item.id === purchaseId ? { ...item, ...res.data.purchase } : item)));
        setViewingPurchase((prev) => (prev?.id === purchaseId ? { ...prev, ...res.data.purchase } : prev));
      }
    } catch (err: any) {
      // roll back if the server rejected it
      setPurchases((prev) => prev.map((item) => (item.id === purchaseId ? { ...item, paymentStatus: previous } : item)));
      setViewingPurchase((prev) => (prev?.id === purchaseId ? { ...prev, paymentStatus: previous } : prev));
      alert(err?.response?.data?.error ?? "Failed to update payment status.");
    } finally {
      setStatusUpdatingId(null);
    }
  }

  async function handleConfirmPartialPayment(data: {
    amount: number;
    method: string;
    paymentDate: string;
    referenceNumber?: string;
    notes?: string;
  }) {
    if (!partialModalTarget) return;
    const purchaseId = partialModalTarget.id;
    setStatusUpdatingId(purchaseId);
    try {
      const alreadyPaid = partialModalTarget.alreadyPaid || 0;
      const totalPaid = alreadyPaid + data.amount;
      const grandTotal = partialModalTarget.totalAmount;
      const willBePaid = totalPaid >= grandTotal - 0.009;
      const expectedStatus: PaymentStatus = willBePaid ? "PAID" : "PARTIAL";

      const res = await api.patch(`/api/purchases/${purchaseId}/status`, {
        paymentStatus: expectedStatus,
        ...data,
      });

      const updatedPurchase = res.data?.purchase;
      const newStatus = updatedPurchase?.paymentStatus ?? expectedStatus;
      const newPayments = updatedPurchase?.payments;

      setPurchases((prev) =>
        prev.map((item) => {
          if (item.id !== purchaseId) return item;
          return {
            ...item,
            paymentStatus: newStatus,
            payments: newPayments ?? [
              ...(item.payments ?? []),
              {
                id: `pay-${Date.now()}`,
                amount: data.amount.toFixed(2),
                paymentDate: data.paymentDate,
                method: data.method,
                referenceNumber: data.referenceNumber,
                notes: data.notes,
              },
            ],
          };
        }),
      );

      setViewingPurchase((prev) => {
        if (prev?.id !== purchaseId) return prev;
        return {
          ...prev,
          paymentStatus: newStatus,
          payments: newPayments ?? [
            ...(prev.payments ?? []),
            {
              id: `pay-${Date.now()}`,
              amount: data.amount.toFixed(2),
              paymentDate: data.paymentDate,
              method: data.method,
              referenceNumber: data.referenceNumber,
              notes: data.notes,
            },
          ],
        };
      });
    } catch (err: any) {
      alert(err?.response?.data?.error ?? "Failed to record payment.");
    } finally {
      setStatusUpdatingId(null);
      setPartialModalTarget(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="rounded-xl bg-[#044d73] p-4 sm:px-6 sm:py-5 text-white shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Purchase</h1>
        </div>
        <button
          onClick={openAdd}
          disabled={loadingCatalog}
          className="flex items-center justify-center gap-2 bg-white text-[#044d73] hover:bg-slate-50 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          New Purchase
        </button>
      </div>

      {loadError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-600 font-medium">
          {loadError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Purchases", value: stats.total, format: undefined, border: "border-l-slate-400", iconBg: "bg-slate-50 text-slate-600", icon: <Receipt className="h-5 w-5 sm:h-6 sm:w-6" /> },
          { label: "Total Spend", value: stats.amount, format: rs, border: "border-l-[#044d73]", iconBg: "bg-[#044d73]/10 text-[#044d73]", icon: <Wallet className="h-5 w-5 sm:h-6 sm:w-6" /> },
          { label: "Cash Purchases", value: stats.cash, format: undefined, border: "border-l-emerald-500", iconBg: "bg-emerald-50 text-emerald-600", icon: <Banknote className="h-5 w-5 sm:h-6 sm:w-6" /> },
          { label: "Credit Purchases", value: stats.credit, format: undefined, border: "border-l-amber-500", iconBg: "bg-amber-50 text-amber-600", icon: <CreditCard className="h-5 w-5 sm:h-6 sm:w-6" /> },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border-l-4 ${s.border} border border-slate-200 bg-white p-4 sm:p-5 shadow-sm flex items-center justify-between`}>
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">{s.label}</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1 break-all">
                <AnimatedStatValue value={s.value} format={s.format} />
              </p>
            </div>
            <div className={`flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl ${s.iconBg}`}>
              {s.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Control Actions Panel (Search & Filters) */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-wrap">
        {/* Search Input */}
        <div className="relative flex-1 min-w-0 sm:min-w-[220px] w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search invoice, supplier, medicine, batch..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-8 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCurrentPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Payment Filter */}
        <select
          value={paymentFilter}
          onChange={(e) => {
            setPaymentFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 focus:border-[#044d73] focus:outline-none"
        >
          <option value="ALL">All Payments</option>
          <option value="CASH">Cash</option>
          <option value="CREDIT">Credit</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
          <option value="CHEQUE">Cheque</option>
          <option value="MOBILE_PAYMENT">Mobile Payment</option>
        </select>

        {/* Payment Status Filter */}
        <select
          value={paymentStatusFilter}
          onChange={(e) => {
            setPaymentStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 focus:border-[#044d73] focus:outline-none"
        >
          <option value="ALL">All Payment Statuses</option>
          <option value="PAID">Paid</option>
          <option value="PARTIAL">Partial</option>
          <option value="UNPAID">Unpaid</option>
        </select>

        {/* Supplier Filter */}
        <select
          value={supplierFilter}
          onChange={(e) => {
            setSupplierFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 focus:border-[#044d73] focus:outline-none max-w-[180px] truncate"
        >
          <option value="ALL">All Parties</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        {/* Date Range */}
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setCurrentPage(1);
              }}
              className="w-32 rounded-lg border border-slate-200 bg-white py-2.5 pl-8 pr-2 text-xs text-slate-700 focus:border-[#044d73] focus:outline-none"
              title="From Date"
            />
          </div>
          <span className="text-xs text-slate-400">to</span>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => {
                setDateTo(e.target.value);
                setCurrentPage(1);
              }}
              className="w-32 rounded-lg border border-slate-200 bg-white py-2.5 pl-8 pr-2 text-xs text-slate-700 focus:border-[#044d73] focus:outline-none"
              title="To Date"
            />
          </div>
        </div>

        {/* Reset Filter Button */}
        {isFiltered && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 px-3 py-2.5 text-xs font-medium text-slate-700 transition-colors shrink-0"
            title="Reset all filters"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
            Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto min-h-[380px]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Invoice No.</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Purc Type</th>
                <th className="py-3 px-4">Party</th>
                <th className="py-3 px-4">Items & Batches</th>
                <th className="py-3 px-4">Qty</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingPurchases ? (
                <tr><td colSpan={10} className="py-16"><DotsLoader text="Loading purchases..." size="sm" /></td></tr>
              ) : paginatedPurchases.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-sm text-slate-400">
                    {isFiltered ? (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Receipt className="h-8 w-8 text-slate-300" />
                        <p className="font-medium text-slate-600">No matching purchases found</p>
                        <p className="text-xs text-slate-400">Try adjusting your search query or filters.</p>
                        <button
                          type="button"
                          onClick={clearAllFilters}
                          className="mt-2 text-xs font-semibold text-[#044d73] hover:underline"
                        >
                          Clear all filters
                        </button>
                      </div>
                    ) : (
                      "No purchases yet."
                    )}
                  </td>
                </tr>
              ) : paginatedPurchases.map(p => {
                const totalQty = p.items.reduce((s, li) => s + li.quantity, 0);
                const currentStatus: PaymentStatus = p.paymentStatus ?? (p.paymentType === "CREDIT" ? "UNPAID" : "PAID");
                return (
                  <tr
                    key={p.id}
                    onClick={() => setViewingPurchase(p)}
                    className="hover:bg-slate-50/80 transition-colors text-slate-700 cursor-pointer group"
                  >
                    <td className="py-3 px-4 text-slate-500">{p.purchaseDate}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800 group-hover:text-[#044d73] transition-colors">
                      {p.supplierInvoiceNumber || "—"}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold border ${PAYMENT_TYPE_STYLES[p.paymentType]?.badge ?? "bg-slate-50 border-slate-200 text-slate-700"}`}>
                        {PAYMENT_TYPE_LABELS[p.paymentType] ?? p.paymentType}
                      </span>
                    </td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col gap-1 items-start">
                        <select
                          value={currentStatus}
                          disabled={statusUpdatingId === p.id}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleStatusChange(p.id, e.target.value as PaymentStatus);
                          }}
                          className={`cursor-pointer disabled:opacity-50 text-[10px] font-bold rounded-full px-2 py-0.5 border transition-colors outline-none ${PAYMENT_STATUS_STYLES[currentStatus]?.badge
                            }`}
                        >
                          <option value="PAID">Paid</option>
                          <option value="PARTIAL">Partial</option>
                          <option value="UNPAID">Unpaid</option>
                        </select>
                        {(() => {
                          const payInfo = getPurchasePaymentInfo(p);
                          if (currentStatus === "PARTIAL" && payInfo.remaining > 0.01) {
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPaymentModal(p, "REMAINING");
                                }}
                                className="inline-flex items-center gap-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 text-[10px] font-semibold px-1.5 py-0.5 border border-amber-300 transition-colors"
                                title={`Paid: Rs. ${payInfo.paid.toFixed(2)} | Due: Rs. ${payInfo.remaining.toFixed(2)}. Click to pay remaining balance.`}
                              >
                                <CreditCard className="w-2.5 h-2.5 text-amber-700" />
                                <span>Pay Rs. {payInfo.remaining.toFixed(2)}</span>
                              </button>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">{PURC_TYPE_LABELS[p.purcType]}</td>
                    <td className="py-3 px-4 text-slate-500">{p.party?.name || "—"}</td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="flex flex-col gap-1">
                        {p.items.slice(0, 2).map((li, i) => {
                          const product = products.find(pr => pr.id === li.productId);
                          return (
                            <div key={i} className="flex flex-wrap items-center gap-1.5 text-xs">
                              <span className="font-medium text-slate-800">{product?.name || "Item"}</span>
                              <span className="inline-flex items-center gap-1 rounded bg-[#044d73]/10 px-1.5 py-0.2 text-[10px] font-semibold text-[#044d73] border border-[#044d73]/20">
                                <Boxes className="w-2.5 h-2.5" /> B: {li.batchNumber}
                              </span>
                            </div>
                          );
                        })}
                        {p.items.length > 2 && (
                          <span className="text-[11px] text-slate-400 font-medium">+{p.items.length - 2} more item{p.items.length - 2 > 1 ? "s" : ""}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500">{totalQty}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{rs(Number(p.grandTotal))}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintPurchase(p);
                          }}
                          title="Print / Download Purchase Voucher"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#044d73] hover:bg-[#044d73]/10 transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                          title="Edit Purchase"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#044d73] hover:bg-[#044d73]/10 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(p.id); setDeleteError(null); }}
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

        {totalItems > 0 && (
          <div className="flex flex-col gap-4 items-center justify-between border-t border-slate-100 bg-white px-6 py-4 sm:flex-row">
            <span className="text-xs text-slate-400">
              Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, totalItems)}–{Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} of {totalItems} purchase{totalItems !== 1 ? "s" : ""}
              {isFiltered && ` (filtered from ${purchases.length} total)`}
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

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-xl shadow-xl overflow-hidden">
            <div className="flex flex-col items-center text-center gap-3 p-5 sm:p-6 border-b border-slate-100">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <Trash2 className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Delete Purchase?</h3>
                <p className="text-sm text-slate-500 mt-1">This action cannot be undone.</p>
              </div>
            </div>
            {deleteError && (
              <div className="mx-5 sm:mx-6 mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
                {deleteError}
              </div>
            )}
            <div className="flex gap-3 p-4 sm:p-6">
              <button onClick={() => setDeleteConfirmId(null)} disabled={deleting}
                className="flex-1 bg-slate-50 border border-slate-200 text-slate-600 font-medium text-sm py-2.5 rounded-lg disabled:opacity-50">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirmId)} disabled={deleting}
                className="flex-1 bg-red-500 text-white font-semibold text-sm py-2.5 rounded-lg disabled:opacity-50">
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Purchase Modal */}
      {viewingPurchase && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4" onClick={() => setViewingPurchase(null)}>
          <div className="bg-white border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="relative flex shrink-0 items-start sm:items-center justify-between p-4 sm:p-6 bg-[#044d73] text-white gap-3">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <Receipt className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base sm:text-lg font-semibold truncate">{viewingPurchase.supplierInvoiceNumber || "Purchase"}</h3>
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold border ${PAYMENT_TYPE_STYLES[viewingPurchase.paymentType]?.viewBadge ?? "bg-slate-400/20 border-slate-300 text-slate-100"}`}>
                      {PAYMENT_TYPE_LABELS[viewingPurchase.paymentType] ?? viewingPurchase.paymentType}
                    </span>
                    <select
                      value={viewingPurchase.paymentStatus ?? (viewingPurchase.paymentType === "CREDIT" ? "UNPAID" : "PAID")}
                      disabled={statusUpdatingId === viewingPurchase.id}
                      onChange={(e) => handleStatusChange(viewingPurchase.id, e.target.value as PaymentStatus)}
                      className={`cursor-pointer disabled:opacity-50 text-[10px] font-bold rounded-full px-2.5 py-0.5 border outline-none ${PAYMENT_STATUS_STYLES[viewingPurchase.paymentStatus ?? (viewingPurchase.paymentType === "CREDIT" ? "UNPAID" : "PAID")]?.viewBadge ?? "bg-slate-400/20 border-slate-300 text-slate-100"
                        }`}
                    >
                      <option value="PAID" className="text-slate-900 bg-white">Paid</option>
                      <option value="PARTIAL" className="text-slate-900 bg-white">Partial</option>
                      <option value="UNPAID" className="text-slate-900 bg-white">Unpaid</option>
                    </select>
                  </div>
                  <p className="text-xs text-white/70 mt-0.5 break-words">Date: {viewingPurchase.purchaseDate} · Party: {viewingPurchase.party?.name || "—"}</p>
                </div>
              </div>
              <button type="button" onClick={() => setViewingPurchase(null)} className="shrink-0 rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
              {/* Payment Summary & Settlement Banner */}
              {(() => {
                const payInfo = getPurchasePaymentInfo(viewingPurchase);
                return (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#044d73] flex items-center gap-1.5">
                          <Wallet className="w-4 h-4" /> Payment Status & Balance
                        </h4>
                        <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs">
                          <span className="text-slate-600">
                            Total Bill: <strong className="text-slate-800 font-mono">Rs. {payInfo.total.toFixed(2)}</strong>
                          </span>
                          <span className="text-slate-600">
                            Paid to Supplier: <strong className="text-emerald-700 font-mono">Rs. {payInfo.paid.toFixed(2)}</strong>
                          </span>
                          <span className="text-slate-600">
                            Balance Due:{" "}
                            <strong className={`font-mono ${payInfo.remaining > 0.01 ? "text-amber-800 font-bold" : "text-emerald-700 font-bold"}`}>
                              Rs. {payInfo.remaining.toFixed(2)}
                            </strong>
                          </span>
                        </div>
                      </div>
                      {payInfo.remaining > 0.01 ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openPaymentModal(viewingPurchase, "PARTIAL")}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            + Partial Pay
                          </button>
                          <button
                            type="button"
                            onClick={() => openPaymentModal(viewingPurchase, "REMAINING")}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors flex items-center gap-1.5"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            Pay Remaining (Rs. {payInfo.remaining.toFixed(2)})
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-xs font-semibold">
                          <Check className="w-3.5 h-3.5 text-emerald-700" /> Fully Settled
                        </span>
                      )}
                    </div>

                    {/* Recorded Payments List */}
                    {viewingPurchase.payments && viewingPurchase.payments.length > 0 && (
                      <div className="border-t border-slate-200/80 pt-2.5 mt-2">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                          Recorded Payment Vouchers ({viewingPurchase.payments.length})
                        </p>
                        <div className="space-y-1">
                          {viewingPurchase.payments.map((p, pIdx) => (
                            <div key={p.id || pIdx} className="flex items-center justify-between text-xs bg-white px-3 py-1.5 rounded-lg border border-slate-200/60">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-700">#{pIdx + 1}</span>
                                <span className="text-slate-500">{p.paymentDate}</span>
                                <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-medium text-slate-700">
                                  {p.method?.replace("_", " ") || "CASH"}
                                </span>
                                {p.referenceNumber && (
                                  <span className="text-slate-400 text-[11px]">Ref: {p.referenceNumber}</span>
                                )}
                                {p.notes && (
                                  <span className="text-slate-400 italic text-[11px]">({p.notes})</span>
                                )}
                              </div>
                              <span className="font-bold text-emerald-700 font-mono">
                                Rs. {Number(p.amount).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
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
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3">Rate</th>
                        <th className="py-2.5 px-3">MRP</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewingPurchase.items.map((li, idx) => {
                        const product = products.find(p => p.id === li.productId);
                        return (
                          <tr key={li.id || idx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-medium text-slate-800">{product?.name || "—"}</td>
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center gap-1 rounded bg-[#044d73]/10 px-2 py-0.5 text-[11px] font-semibold text-[#044d73] border border-[#044d73]/20">
                                <Boxes className="w-3 h-3" /> {li.batchNumber}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">{li.expiryDate}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800 text-center">{li.quantity}</td>
                            <td className="py-2.5 px-3 text-slate-600">{rs(Number(li.purchaseRate))}</td>
                            <td className="py-2.5 px-3 text-slate-600">{rs(Number(li.mrp))}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-800 text-right">{rs(Number(li.lineTotal))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {viewingPurchase.note && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700">Purchase Note</h4>
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-xs text-slate-700">{viewingPurchase.note}</p>
                </div>
              )}

              <div className="sm:ml-auto w-full sm:max-w-xs space-y-1.5 rounded-xl bg-slate-50 p-4 border border-slate-200">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Subtotal</span><span>{rs(Number(viewingPurchase.subtotal))}</span>
                </div>
                {Number(viewingPurchase.discount) > 0 && (
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Discount</span><span>- {rs(Number(viewingPurchase.discount))}</span>
                  </div>
                )}
                {Number(viewingPurchase.freightCharges) > 0 && (
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Freight & Forwarding</span><span>+ {rs(Number(viewingPurchase.freightCharges))}</span>
                  </div>
                )}
                {Number(viewingPurchase.vatRefund) > 0 && (
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>VAT Refund</span><span>- {rs(Number(viewingPurchase.vatRefund))}</span>
                  </div>
                )}
                {Number(viewingPurchase.roundOff) < 0 && (
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Rounded Off (−)</span><span>- {rs(Math.abs(Number(viewingPurchase.roundOff)))}</span>
                  </div>
                )}
                {Number(viewingPurchase.roundOff) > 0 && (
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Rounded Off (+)</span><span>+ {rs(Number(viewingPurchase.roundOff))}</span>
                  </div>
                )}
                {Number(viewingPurchase.vatAmount) > 0 && (
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>VAT</span><span>{rs(Number(viewingPurchase.vatAmount))}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-800">
                  <span>Grand Total</span><span className="text-[#044d73]">{rs(Number(viewingPurchase.grandTotal))}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white p-3.5 sm:p-4 px-4 sm:px-6">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintPurchase(viewingPurchase)}
                  className="flex items-center gap-1.5 rounded-lg bg-[#044d73] hover:bg-[#033b59] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / Download Voucher
                </button>
                <button
                  type="button"
                  onClick={() => { const p = viewingPurchase; setViewingPurchase(null); openEdit(p); }}
                  className="flex items-center gap-1.5 rounded-lg border border-[#044d73]/30 bg-[#044d73]/5 hover:bg-[#044d73]/10 px-4 py-2 text-xs font-semibold text-[#044d73] transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit Purchase
                </button>
              </div>
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-slate-200 w-full max-w-5xl max-h-[94vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden">
            <div className="relative flex shrink-0 items-start sm:items-center justify-between px-4 py-4 sm:px-7 sm:py-5 bg-[#044d73] text-white gap-3">
              <div className="flex items-start sm:items-center gap-3 sm:gap-3.5 min-w-0">
                <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <Receipt className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-semibold">
                    {editingPurchaseId ? "Edit Purchase" : "New Purchase"}
                  </h3>
                  <p className="text-xs text-white/70 line-clamp-1">Enter items on the line and set batch details directly</p>
                </div>
              </div>
              <button type="button" onClick={closeModal} className="shrink-0 rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-4 sm:space-y-6 overflow-y-auto p-4 sm:p-7">

                {saveError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-600 font-medium">
                    {saveError}
                  </div>
                )}

                <Section title="Purchase Voucher Details" icon={<Receipt className="w-3.5 h-3.5" />}>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Date">
                      <input
                        type="date"
                        value={form.date}
                        onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Supplier Invoice No.">
                      <TextInput value={form.supplierInvoiceNumber} onChange={v => setForm(p => ({ ...p, supplierInvoiceNumber: v }))} placeholder="e.g. INV-2201" />
                    </Field>
                    <Field label="Payment Type">
                      <select
                        value={form.paymentType}
                        onChange={e => {
                          const pt = e.target.value as PaymentType;
                          setForm(p => ({
                            ...p,
                            paymentType: pt,
                            paymentStatus: pt === "CREDIT" ? "UNPAID" : "PAID",
                          }));
                        }}
                        className={inputCls}
                      >
                        <option value="CASH">Cash</option>
                        <option value="CREDIT">Credit</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="CHEQUE">Cheque</option>
                        <option value="MOBILE_PAYMENT">Mobile Payment</option>
                      </select>
                    </Field>
                    <Field label="Purc Type" hint="VAT treatment for this purchase">
                      <select
                        value={form.purcType}
                        onChange={e => setForm(p => ({ ...p, purcType: e.target.value as PurcType }))}
                        className={inputCls}
                      >
                        <option value="VAT_EXEMPT">VAT/Exempt</option>
                        <option value="VAT_ITEM_WISE">VAT/Item-wise</option>
                        <option value="VAT_TAX_INCL">VAT/TaxIncl.</option>
                      </select>
                    </Field>
                    {form.purcType !== "VAT_EXEMPT" && (
                      <Field label="VAT Rate (%)">
                        <input
                          type="number" min={0} max={100} step="0.01"
                          value={form.vatRate}
                          onChange={e => setForm(p => ({ ...p, vatRate: e.target.value === "" ? "" : Number(e.target.value) }))}
                          className={inputCls}
                        />
                      </Field>
                    )}

                    <div className="sm:col-span-2 lg:col-span-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className={labelCls}>Party</label>
                        {!showNewPartyInline ? (
                          <button
                            type="button"
                            onClick={() => handleStartNewPartyInline("")}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#044d73] hover:text-[#033b59] hover:underline cursor-pointer"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            <span>+ New Party</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setShowNewPartyInline(false);
                              setInlinePartyError(null);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                          >
                            <span>Back to party search</span>
                          </button>
                        )}
                      </div>

                      {showNewPartyInline ? (
                        <div className="rounded-xl border border-[#044d73]/25 bg-slate-50/80 p-4 space-y-3.5 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                            <div className="flex items-center gap-2 text-xs font-bold text-[#044d73]">
                              <UserPlus className="w-4 h-4" />
                              <span>Add New Party Details</span>
                            </div>
                            <span className="text-[11px] text-slate-400">Saved to party catalog</span>
                          </div>

                          {inlinePartyError && (
                            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600 font-medium">
                              {inlinePartyError}
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Party Name <span className="text-red-500">*</span>
                              </label>
                              <input
                                autoFocus
                                type="text"
                                value={inlineParty.name}
                                onChange={(e) => setInlineParty((p) => ({ ...p, name: e.target.value }))}
                                placeholder="e.g. Acme Pharmaceuticals"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Contact Person (optional)
                              </label>
                              <input
                                type="text"
                                value={inlineParty.contactPerson}
                                onChange={(e) => setInlineParty((p) => ({ ...p, contactPerson: e.target.value }))}
                                placeholder="e.g. Sales Manager / Rep"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Phone Number
                              </label>
                              <input
                                type="tel"
                                value={inlineParty.phone}
                                onChange={(e) => setInlineParty((p) => ({ ...p, phone: e.target.value }))}
                                placeholder="e.g. 9841234567"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                PAN / VAT Number (optional)
                              </label>
                              <input
                                type="text"
                                value={inlineParty.panVatNumber}
                                onChange={(e) => setInlineParty((p) => ({ ...p, panVatNumber: e.target.value }))}
                                placeholder="e.g. 601234567"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Email (optional)
                              </label>
                              <input
                                type="email"
                                value={inlineParty.email}
                                onChange={(e) => setInlineParty((p) => ({ ...p, email: e.target.value }))}
                                placeholder="e.g. supplier@example.com"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Payment Terms (optional)
                              </label>
                              <input
                                type="text"
                                value={inlineParty.paymentTerms}
                                onChange={(e) => setInlineParty((p) => ({ ...p, paymentTerms: e.target.value }))}
                                placeholder="e.g. Net 30, Advance 50%"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Address (optional)
                              </label>
                              <input
                                type="text"
                                value={inlineParty.address}
                                onChange={(e) => setInlineParty((p) => ({ ...p, address: e.target.value }))}
                                placeholder="e.g. Kathmandu, Nepal"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/80">
                            <button
                              type="button"
                              onClick={() => {
                                setShowNewPartyInline(false);
                                setInlinePartyError(null);
                              }}
                              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={savingInlineParty || !inlineParty.name.trim()}
                              onClick={handleSaveInlineParty}
                              className="px-4 py-1.5 text-xs font-semibold text-white bg-[#044d73] hover:bg-[#033f60] rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
                            >
                              {savingInlineParty ? "Saving..." : "Save Party"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <SupplierPicker
                            value={form.partyId}
                            selectedName={form.partyName}
                            suppliers={suppliers}
                            onSelect={(s) => setForm(p => ({ ...p, partyId: s ? s.id : "", partyName: s ? s.name : "" }))}
                            onStartNewParty={handleStartNewPartyInline}
                          />
                          {form.partyId && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-[11px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                              {(() => {
                                const s = suppliers.find((x) => x.id === form.partyId);
                                if (!s) return null;
                                return (
                                  <>
                                    <span className="font-semibold text-slate-700">{s.name}</span>
                                    {s.contactPerson && <span className="text-slate-600">👤 {s.contactPerson}</span>}
                                    {s.phone && <span className="text-slate-600">📞 {s.phone}</span>}
                                    {s.email && <span className="text-slate-600">✉️ {s.email}</span>}
                                    {s.address && <span className="text-slate-600">📍 {s.address}</span>}
                                    {s.panVatNumber && <span className="text-slate-600">🏛️ PAN: {s.panVatNumber}</span>}
                                    {s.paymentTerms && <span className="text-slate-600">💳 Terms: {s.paymentTerms}</span>}
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-4">
                    <Field label="Purchase Note / Remarks">
                      <textarea
                        rows={2}
                        maxLength={1000}
                        value={form.note}
                        onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                        placeholder="e.g. Delivery terms, payment agreement, supplier remarks..."
                        className={`${inputCls} resize-y`}
                      />
                    </Field>
                  </div>
                </Section>

                <Section title="Items & Batch Details" icon={<PackagePlus className="w-3.5 h-3.5" />}>
                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50/90 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                            <th className="py-3 px-3 w-10 text-center">#</th>
                            <th className="py-3 px-3 min-w-[240px]">Item Name</th>
                            <th className="py-3 px-2.5 w-[90px]">Qty</th>
                            <th className="py-3 px-2 w-[70px] text-center">Unit</th>
                            <th className="py-3 px-2.5 w-[110px]">Pur. Rate</th>
                            <th className="py-3 px-2 w-[85px] text-center">VAT</th>
                            <th className="py-3 px-3 w-[110px] text-right">Amount</th>
                            <th className="py-3 px-3 min-w-[220px]">Batch Details</th>
                            <th className="py-3 px-2 w-[50px] text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {form.items.map((line, idx) => {
                            const isExpanded = expandedLineIds.includes(line.id);
                            const hasValidBatch = line.batch && line.batch.batchNo.trim() !== "" && line.batch.expDate.trim() !== "";
                            const isMissingBatch = !!line.itemId && n(line.qty) > 0 && !hasValidBatch;

                            return (
                              <Fragment key={line.id}>
                                <tr className={`transition-colors ${isMissingBatch ? "bg-amber-50/30" : "hover:bg-slate-50/50"} ${isExpanded ? "bg-slate-50/70" : ""}`}>
                                  <td className="py-3 px-3 text-center font-medium text-slate-400">{idx + 1}</td>
                                  <td className="py-3 px-3">
                                    <ItemPicker
                                      value={line.itemId}
                                      selectedName={line.itemName}
                                      products={products}
                                      onStartNewItem={(name) => handleStartNewItem(line.id, name)}
                                      onSelect={product => {
                                        updateLine(line.id, {
                                          itemId: product.id,
                                          itemName: product.name,
                                          unit: product.unit,
                                          altUnit: product.alternativeUnit ?? "",
                                          qty: line.qty || 1,
                                          batch: emptyBatch(line.qty || 1),
                                        });
                                        if (!expandedLineIds.includes(line.id)) {
                                          setExpandedLineIds(prev => [...prev, line.id]);
                                        }
                                      }}
                                    />
                                  </td>
                                  <td className="py-3 px-2.5">
                                    <input
                                      type="number" min={0} step="1" placeholder="0"
                                      value={line.qty}
                                      onChange={e => updateLine(line.id, { qty: e.target.value === "" ? "" : Number(e.target.value) })}
                                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                                    />
                                  </td>
                                  <td className="py-3 px-2 text-center">
                                    <span className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-600">
                                      {line.unit || "—"}
                                    </span>
                                  </td>
                                  <td className="py-3 px-2.5">
                                    <input
                                      type="number" min={0} step="0.01" placeholder="0.00"
                                      value={line.price}
                                      onChange={e => updateLine(line.id, { price: e.target.value === "" ? "" : Number(e.target.value) })}
                                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                                    />
                                  </td>
                                  <td className="py-3 px-2 text-center">
                                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none py-1.5 px-2 rounded-lg hover:bg-slate-100/80 transition-colors">
                                      <input
                                        type="checkbox"
                                        checked={line.vatApplicable}
                                        onChange={e => updateLine(line.id, { vatApplicable: e.target.checked })}
                                        className="h-4 w-4 rounded border-slate-300 text-[#044d73] focus:ring-[#044d73] cursor-pointer"
                                      />
                                      <span className={`text-[11px] font-bold ${line.vatApplicable ? "text-emerald-600" : "text-slate-400"}`}>
                                        {line.vatApplicable ? "13%" : "0%"}
                                      </span>
                                    </label>
                                  </td>
                                  <td className="py-3 px-3 text-right font-bold text-slate-800">
                                    <div className="flex h-9 items-center justify-end">{rs(lineAmount(line))}</div>
                                  </td>
                                  <td className="py-3 px-3">
                                    {hasValidBatch ? (
                                      <button
                                        type="button"
                                        onClick={() => toggleBatchExpand(line.id)}
                                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all ${isExpanded ? "border-[#044d73] bg-[#044d73]/10 text-[#044d73]" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                          }`}
                                      >
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        <span className="truncate max-w-[130px]">B: {line.batch?.batchNo}</span>
                                        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => toggleBatchExpand(line.id)}
                                        disabled={!line.itemId}
                                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all disabled:opacity-40 ${isExpanded ? "border-[#044d73] bg-[#044d73]/10 text-[#044d73]" : isMissingBatch ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-slate-200 bg-white text-slate-600 hover:border-[#044d73] hover:text-[#044d73]"
                                          }`}
                                      >
                                        <Boxes className="w-3.5 h-3.5" />
                                        <span>Enter Batch</span>
                                        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                      </button>
                                    )}
                                  </td>
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

                                {isExpanded && (
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
                                          <button type="button" onClick={() => toggleBatchExpand(line.id)} className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition-colors">
                                            Collapse <ChevronDown className="w-3.5 h-3.5 rotate-180" />
                                          </button>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 items-end p-3 rounded-lg bg-slate-50/80 border border-slate-200/80">
                                          <div>
                                            <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Batch No. *</label>
                                            <input type="text" required placeholder="e.g. AB2501"
                                              value={line.batch?.batchNo || ""}
                                              onChange={e => updateLineBatch(line.id, { batchNo: e.target.value })}
                                              className="h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 placeholder:text-slate-300 focus:border-[#044d73] focus:outline-none" />
                                          </div>
                                          <div>
                                            <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Quantity ({line.unit || "unit"}) *</label>
                                            <input type="number" min={1} step="1" placeholder="0"
                                              value={line.batch?.qty !== undefined ? line.batch.qty : line.qty}
                                              onChange={e => updateLineBatch(line.id, { qty: e.target.value === "" ? "" : Number(e.target.value) })}
                                              className="h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 placeholder:text-slate-300 focus:border-[#044d73] focus:outline-none" />
                                          </div>
                                          <div>
                                            <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Exp. Date *</label>
                                            <input type="date" required
                                              value={line.batch?.expDate || ""}
                                              onChange={e => updateLineBatch(line.id, { expDate: e.target.value })}
                                              className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-[#044d73] focus:outline-none" />
                                          </div>
                                          <div>
                                            <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Mfg. Date</label>
                                            <input type="date"
                                              value={line.batch?.mfgDate || ""}
                                              onChange={e => updateLineBatch(line.id, { mfgDate: e.target.value })}
                                              className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-[#044d73] focus:outline-none" />
                                          </div>
                                          <div>
                                            <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase tracking-wide">M.R.P. (Rs.)</label>
                                            <input type="number" min={0} step="0.01" placeholder="0.00"
                                              value={line.batch?.mrp || ""}
                                              onChange={e => updateLineBatch(line.id, { mrp: e.target.value === "" ? "" : Number(e.target.value) })}
                                              className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 placeholder:text-slate-300 focus:border-[#044d73] focus:outline-none" />
                                          </div>
                                          <div>
                                            <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Sale Price</label>
                                            <input type="number" min={0} step="0.01" placeholder="0.00"
                                              value={line.batch?.salePrice || ""}
                                              onChange={e => updateLineBatch(line.id, { salePrice: e.target.value === "" ? "" : Number(e.target.value) })}
                                              className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 placeholder:text-slate-300 focus:border-[#044d73] focus:outline-none" />
                                          </div>
                                        </div>

                                        <div>
                                          <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Batch Note / Remarks</label>
                                          <input
                                            type="text"
                                            placeholder="e.g. Storage instructions, damage notes, special batch remarks..."
                                            value={line.batch?.note || ""}
                                            onChange={e => updateLineBatch(line.id, { note: e.target.value })}
                                            className="h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 placeholder:text-slate-300 focus:border-[#044d73] focus:outline-none"
                                          />
                                        </div>

                                        <div className="flex items-center justify-end pt-1 border-t border-slate-100">
                                          <button type="button" onClick={() => toggleBatchExpand(line.id)} className="rounded-lg bg-[#044d73] hover:bg-[#033f60] px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors">
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

                    <div className="border-t border-slate-100 bg-slate-50/50 p-3 px-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={addLine} className="flex items-center gap-2 rounded-lg bg-[#044d73]/10 hover:bg-[#044d73]/20 px-3.5 py-2 text-xs font-semibold text-[#044d73] transition-colors">
                          <Plus className="w-4 h-4" /> Add Item
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartNewItem()}
                          className="flex items-center gap-1.5 rounded-lg border border-[#044d73]/30 bg-white hover:bg-[#044d73]/5 px-3 py-2 text-xs font-semibold text-[#044d73] transition-colors"
                        >
                          <Package className="w-3.5 h-3.5" /> + New Item Catalog
                        </button>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {form.items.length} item row{form.items.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  {(missingBatch || missingExpiry) && (
                    <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5 px-3 text-xs text-amber-700">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>Batch No. and Expiry Date are required on every item row before saving.</span>
                    </div>
                  )}
                </Section>

                <Section
                  title="Discounts & Charges"
                  icon={<Percent className="w-3.5 h-3.5" />}
                  action={
                    <button type="button" onClick={addDiscount} className="flex items-center gap-1.5 text-xs font-semibold text-[#044d73] hover:underline">
                      <Plus className="w-3.5 h-3.5" /> Add Discount / Charge
                    </button>
                  }
                >
                  {form.discounts.length === 0 ? (
                    <p className="rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs text-slate-400">No discount or charges applied to this purchase.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50/70 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            <th className="py-2.5 px-3 w-10 text-center">S.N</th>
                            <th className="py-2.5 px-3 min-w-[210px]">Adjustment / Charge Type</th>
                            <th className="py-2.5 px-3 min-w-[110px]">Amount</th>
                            <th className="py-2.5 px-3 min-w-[120px]">Type</th>
                            <th className="py-2.5 px-3 w-10 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {form.discounts.map((d, idx) => (
                            <tr key={d.id}>
                              <td className="py-2 px-3 text-center text-slate-500 font-medium">{idx + 1}</td>
                              <td className="py-2 px-3">
                                <select
                                  value={d.category || "Discount"}
                                  onChange={(e) => updateDiscount(d.id, { category: e.target.value as AdjustmentCategory })}
                                  className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs sm:text-sm text-slate-700 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                                >
                                  <option value="Discount">Discount</option>
                                  <option value="Freight and forwarding charges">Freight and forwarding charges</option>
                                  <option value="Rounded off (-)">Rounded off (-)</option>
                                  <option value="Rounded off (+)">Rounded off (+)</option>
                                  <option value="VAT refund">VAT refund</option>
                                </select>
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={d.amount}
                                  placeholder={
                                    d.category === "Rounded off (-)"
                                      ? `Auto (${adjustments.roundOffMinusTotal.toFixed(2)})`
                                      : d.category === "Rounded off (+)"
                                        ? `Auto (${adjustments.roundOffPlusTotal.toFixed(2)})`
                                        : d.type === "Percentage"
                                          ? "%"
                                          : "Rs."
                                  }
                                  onChange={(e) => updateDiscount(d.id, { amount: e.target.value === "" ? "" : Number(e.target.value) })}
                                  className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                                />
                              </td>
                              <td className="py-2 px-3">
                                {d.category === "Rounded off (-)" || d.category === "Rounded off (+)" ? (
                                  <div className="w-full rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-500">
                                    Flat (Rs.)
                                  </div>
                                ) : (
                                  <select
                                    value={d.type}
                                    onChange={(e) => updateDiscount(d.id, { type: e.target.value as DiscountType })}
                                    className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                                  >
                                    <option value="Flat">Flat (Rs.)</option>
                                    <option value="Percentage">Percentage (%)</option>
                                  </select>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button type="button" onClick={() => removeDiscount(d.id)} className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50">
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

                <div className="sm:ml-auto w-full sm:max-w-xs space-y-1.5 rounded-xl bg-slate-50 p-4 border border-slate-200">
                  <div className="flex justify-between text-xs sm:text-sm text-slate-500">
                    <span>Subtotal</span><span>{rs(subtotal)}</span>
                  </div>
                  {adjustments.discountTotal > 0 && (
                    <div className="flex justify-between text-xs sm:text-sm text-slate-500">
                      <span>Discount</span><span>- {rs(adjustments.discountTotal)}</span>
                    </div>
                  )}
                  {adjustments.freightTotal > 0 && (
                    <div className="flex justify-between text-xs sm:text-sm text-slate-500">
                      <span>Freight & Forwarding</span><span>+ {rs(adjustments.freightTotal)}</span>
                    </div>
                  )}
                  {adjustments.vatRefundTotal > 0 && (
                    <div className="flex justify-between text-xs sm:text-sm text-slate-500">
                      <span>VAT Refund</span><span>- {rs(adjustments.vatRefundTotal)}</span>
                    </div>
                  )}
                  {adjustments.roundOffMinusTotal > 0 && (
                    <div className="flex justify-between text-xs sm:text-sm text-slate-500">
                      <span>Rounded Off (−)</span><span>- {rs(adjustments.roundOffMinusTotal)}</span>
                    </div>
                  )}
                  {adjustments.roundOffPlusTotal > 0 && (
                    <div className="flex justify-between text-xs sm:text-sm text-slate-500">
                      <span>Rounded Off (+)</span><span>+ {rs(adjustments.roundOffPlusTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs sm:text-sm text-slate-500">
                    <span>VAT (estimate)</span><span>{rs(vatEstimate)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 text-sm sm:text-base font-bold text-slate-800">
                    <span>Grand Total (estimate)</span><span className="text-[#044d73]">{rs(grandTotalEstimate)}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 pt-1">Final totals are calculated by the server on save.</p>
                </div>
              </div>

              <div className="flex shrink-0 gap-3 border-t border-slate-100 bg-white p-4 sm:p-5 px-4 sm:px-7">
                <button type="button" onClick={closeModal} className="flex-1 rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.partyId || validItems.length === 0 || missingBatch || missingExpiry}
                  className="flex-1 rounded-lg bg-[#044d73] hover:bg-[#033f60] py-2.5 text-sm font-medium text-white shadow-sm transition-colors disabled:opacity-40"
                >
                  {saving ? "Saving..." : editingPurchaseId ? "Save Changes" : "Save Purchase"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tax Invoice / Purchase Voucher Modal for Printing / PDF Download */}
      {printInvoiceData && (
        <TaxInvoiceModal
          data={printInvoiceData}
          onClose={() => setPrintInvoiceData(null)}
        />
      )}

      {/* Partial Payment Modal */}
      {partialModalTarget && (
        <PartialPaymentModal
          isOpen={!!partialModalTarget}
          onClose={() => setPartialModalTarget(null)}
          invoiceId={partialModalTarget.id}
          invoiceNumber={partialModalTarget.invoiceNumber}
          partyName={partialModalTarget.partyName}
          totalAmount={partialModalTarget.totalAmount}
          alreadyPaid={partialModalTarget.alreadyPaid}
          initialAmount={partialModalTarget.initialAmount}
          existingPayments={partialModalTarget.existingPayments}
          direction="SUPPLIER"
          onConfirm={handleConfirmPartialPayment}
        />
      )}
      {/* Add New Item Modal */}
      <AddItemModal
        isOpen={isAddItemModalOpen}
        onClose={() => setIsAddItemModalOpen(false)}
        initialName={addItemInitialName}
        onSuccess={handleItemCreated}
        existingBrands={existingBrands}
      />
    </div>
  );
}