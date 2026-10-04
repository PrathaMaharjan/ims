"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Plus, X, Pencil, Trash2, Search, ChevronDown, ChevronLeft, ChevronRight,
  ShoppingCart, Wallet, CreditCard, Banknote, PackageCheck, Percent, Boxes, Check,
  AlertCircle, User, UserPlus, Printer, Package,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { AnimatedStatValue } from "../_components/ui/animated-stat-value";
import { TaxInvoiceModal, TaxInvoiceData, InvoiceItem } from "../_components/TaxInvoiceModal";
import { PartialPaymentModal } from "../_components/PartialPaymentModal";

/* ------------------------------------------------------------------ */
/* Types — matches the real backend                                    */
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

type RoundingDirection = "UP" | "DOWN";
type DiscountType = "Percentage" | "Flat";

interface Product {
  id: string;
  name: string;
  aliasName: string | null;
  manufacturer?: string | null;
  hsnCode?: string | null;
  unit: string;
  alternativeUnit: string | null;
  stockQuantity: number;
}

interface ApiBatch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  quantityAvailable: number;
  mrp: string;
  salePrice: string | null;
}

interface Customer {
  id: string;
  name: string;
  contactPerson?: string | null;
  phone: string | null;
  email?: string | null;
  address?: string | null;
  panVatNumber?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  status?: boolean;
}

interface LineItemForm {
  id: string;
  productId: string;
  productName: string;
  unit: string;
  batchId: string; // required — no auto-FEFO, staff must pick one per line
  batchNo: string;
  batchExpDate: string;
  batchStock: number; // quantityAvailable of the selected batch, for the max-qty guard
  availableBatches: ApiBatch[];
  loadingBatches: boolean;
  qty: Num;
  price: Num;
  vatApplicable: boolean;
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

interface SaleForm {
  date: string;
  paymentType: PaymentType;
  paymentStatus: PaymentStatus;
  vatRate: Num;
  roundingDirection: RoundingDirection;
  partyId: string;
  partyName: string;
  items: LineItemForm[];
  discounts: DiscountRowForm[];
  prescriptionNote: string;
}


interface SaleRecord {
  id: string;
  invoiceNumber: number;
  saleDate: string;
  paymentType: PaymentType;
  paymentStatus?: PaymentStatus;
  roundingDirection: RoundingDirection;
  partyId: string | null;
  subtotal: string;
  discount: string;
  freightCharges?: string;
  vatRefund?: string;
  roundOff?: string;
  vatAmount: string;
  grandTotal: string;
  prescriptionNote: string | null;
  party?: { id: string; name: string } | null;
  items: Array<{
    id: string;
    productId: string;
    batchId: string;
    quantity: number;
    salePrice: string;
    lineTotal: string;
    batch?: { batchNumber: string; expiryDate: string } | null;
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

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface SaleStats {
  totalCount: number;
  totalRevenue: number;
  cashCount: number;
  cashRevenue: number;
  creditCount: number;
  creditRevenue: number;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const n = (v: Num) => (v === "" ? 0 : v);
const rs = (v: number) => `Rs. ${v.toFixed(2)}`;
const PAGE_LIMIT = 8;

function invoiceLabel(invoiceNumber: number) {
  return `SAL-${String(invoiceNumber).padStart(4, "0")}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function emptyLine(): LineItemForm {
  return {
    id: crypto.randomUUID(),
    productId: "",
    productName: "",
    unit: "",
    batchId: "",
    batchNo: "",
    batchExpDate: "",
    batchStock: 0,
    availableBatches: [],
    loadingBatches: false,
    qty: "",
    price: "",
    vatApplicable: true,
  };
}

function emptyDiscount(): DiscountRowForm {
  return { id: crypto.randomUUID(), category: "Discount", amount: "", type: "Percentage" };
}

function emptyForm(): SaleForm {
  return {
    date: todayISO(),
    paymentType: "CASH",
    paymentStatus: "UNPAID",
    vatRate: 13,
    roundingDirection: "DOWN",
    partyId: "",
    partyName: "",
    items: [emptyLine()],
    discounts: [],
    prescriptionNote: "",
  };
}

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
  const baseBeforeRound = subtotal - discountTotal - vatRefundTotal + freightTotal + vatEstimate;

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

  const netDeductions = discountTotal + vatRefundTotal + roundOffMinusTotal;
  const netAdditions = freightTotal + roundOffPlusTotal;

  return {
    discountTotal,
    freightTotal,
    roundOffMinusTotal,
    roundOffPlusTotal,
    vatRefundTotal,
    netDeductions,
    netAdditions,
    effectiveRoundingDirection,
    netDiscountForBackend: Math.max(0, netDeductions - netAdditions),
  };
}
function estimateVat(items: LineItemForm[], vatRate: Num) {
  const rate = n(vatRate);
  const vatableSubtotal = items.reduce((s, li) => (li.vatApplicable ? s + lineAmount(li) : s), 0);
  return (vatableSubtotal * rate) / 100;
}

/* ------------------------------------------------------------------ */
/* Small UI building blocks                                            */
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

/* ------------------------------------------------------------------ */
/* Customer combobox                                                    */
/* ------------------------------------------------------------------ */

function CustomerCombobox({
  customers,
  selectedId,
  selectedName,
  onSelectCustomer,
  onStartNewCustomer,
}: {
  customers: Customer[];
  selectedId: string;
  selectedName: string;
  onSelectCustomer: (customer: Customer | null) => void;
  onStartNewCustomer: (name?: string) => void;
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

  const activeCustomers = customers.filter((c) => Boolean(c.status));

  const filtered = query.trim()
    ? activeCustomers.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          (c.phone ?? "").includes(query) ||
          (c.panVatNumber ?? "").includes(query) ||
          (c.contactPerson ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : activeCustomers;

  const exactMatch = activeCustomers.some((c) => c.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={open ? query : selectedName}
          onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => { setQuery(selectedName); setOpen(true); }}
          placeholder="Search or select party..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm text-slate-700 transition-all placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
        />
        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        {selectedName ? (
          <button type="button" onClick={() => { onSelectCustomer(null); setQuery(""); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded" title="Clear selection">
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          <div
            onClick={() => { onSelectCustomer(null); setOpen(false); setQuery(""); }}
            className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2 text-xs text-slate-500 hover:bg-slate-50 cursor-pointer"
          >
            <span className="font-semibold text-slate-700">Walk-in / Cash Customer</span>
            <span className="text-[10px] text-slate-400 italic">No account needed</span>
          </div>

          {/* Add new party button / option */}
          <div
            onClick={() => {
              onStartNewCustomer(query.trim());
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
              {filtered.map((c) => (
                <div
                  key={c.id}
                  onClick={() => { onSelectCustomer(c); setOpen(false); setQuery(""); }}
                  className={`flex items-center justify-between px-3.5 py-2 text-left text-xs hover:bg-slate-50 cursor-pointer transition-colors ${selectedId === c.id ? "bg-[#044d73]/5 font-semibold text-[#044d73]" : "text-slate-700"
                    }`}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{c.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 truncate">
                      {c.phone ? <span>Ph: {c.phone}</span> : <span>No phone</span>}
                      {c.panVatNumber && <span>· PAN: {c.panVatNumber}</span>}
                      {c.paymentTerms && <span>· {c.paymentTerms}</span>}
                      {c.address && <span>· {c.address}</span>}
                    </div>
                  </div>
                  {selectedId === c.id && <Check className="h-4 w-4 text-[#044d73] shrink-0" />}
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
/* Item Picker — searches the already-loaded products list              */
/* ------------------------------------------------------------------ */

function ItemPicker({
  products,
  value,
  selectedName,
  onSelect,
}: {
  products: Product[];
  value: string;
  selectedName?: string;
  onSelect: (item: Product) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selected = products.find((p) => p.id === value) ?? null;
  const displayName = selected?.name || selectedName || "";
  const filtered = products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()) || (p.aliasName ?? "").toLowerCase().includes(query.toLowerCase()));

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
        if (rect.bottom < 0 || rect.top > window.innerHeight) setOpen(false);
        else setCoords({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 320) });
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
          {displayName || "Select item to sell..."}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && coords && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => { setOpen(false); setQuery(""); }} />
          <div
            style={{ top: `${coords.top}px`, left: `${coords.left}px`, width: `${coords.width}px` }}
            className="fixed z-[101] max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-100 bg-white p-2.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search medicine item…" className="w-full text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none" />
            </div>
            {filtered.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-400">No matching items found.</p>
            ) : (
              <div className="py-1">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { onSelect(p); setOpen(false); setQuery(""); }}
                    className={`flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors ${selected?.id === p.id ? "bg-[#044d73]/5 font-semibold text-[#044d73]" : "text-slate-700"
                      }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{p.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Stock: {p.stockQuantity} {p.unit}</p>
                    </div>
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
/* Batch Picker — real batches fetched on demand, ordered FEFO by the
   backend already (soonest expiry first); manual selection required     */
/* ------------------------------------------------------------------ */

function BatchPicker({
  batches,
  loading,
  selectedBatchId,
  unit,
  onSelectBatch,
}: {
  batches: ApiBatch[];
  loading: boolean;
  selectedBatchId: string;
  unit: string;
  onSelectBatch: (batch: ApiBatch) => void;
}) {
  const selected = batches.find((b) => b.id === selectedBatchId);
  const soonestId = batches[0]?.id;

  if (loading) return <span className="text-slate-400 italic text-[11px]">Loading batches...</span>;
  if (batches.length === 0) return <span className="text-red-500 font-medium text-[11px]">No active batches in stock</span>;

  return (
    <div className="relative">
      <select
        value={selectedBatchId}
        onChange={(e) => {
          const b = batches.find((x) => x.id === e.target.value);
          if (b) onSelectBatch(b);
        }}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-2.5 pr-7 text-xs font-medium text-slate-700 focus:border-[#044d73] focus:outline-none"
      >
        <option value="">Select batch...</option>
        {batches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.batchNumber} · Exp: {b.expiryDate} (Stock: {b.quantityAvailable} {unit}) - {rs(Number(b.salePrice ?? b.mrp))}
          </option>
        ))}
      </select>

      {selected && (
        <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span>Exp: <strong className="font-medium text-slate-700">{selected.expiryDate}</strong></span>
            {selected.id === soonestId && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">Earliest Expiry</span>}
          </span>
          <span className="font-medium text-slate-600">Stock: {selected.quantityAvailable} {unit}</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function SalesPage() {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 1 });

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingSales, setLoadingSales] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [stats, setStats] = useState<SaleStats>({
    totalCount: 0, totalRevenue: 0, cashCount: 0, cashRevenue: 0, creditCount: 0, creditRevenue: 0,
  });

  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"ALL" | PaymentType>("ALL");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<"ALL" | PaymentStatus>("ALL");
  const [partyFilter, setPartyFilter] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [viewingSale, setViewingSale] = useState<SaleRecord | null>(null);
  const [printInvoiceData, setPrintInvoiceData] = useState<TaxInvoiceData | null>(null);
  const [form, setForm] = useState<SaleForm>(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  function getSalePaymentInfo(s: SaleRecord) {
    const total = parseFloat(s.grandTotal) || 0;
    const paid = (s.payments ?? []).reduce((sum, p) => sum + (parseFloat(String(p.amount)) || 0), 0);
    const effectivePaid = s.paymentStatus === "PAID" && paid === 0 ? total : paid;
    const remaining = s.paymentStatus === "PAID" ? 0 : Math.max(0, total - effectivePaid);
    return { total, paid: effectivePaid, remaining };
  }

  function openPaymentModal(sale: SaleRecord, mode: "PARTIAL" | "REMAINING" = "PARTIAL") {
    const { total, paid, remaining } = getSalePaymentInfo(sale);
    setPartialModalTarget({
      id: sale.id,
      invoiceNumber: invoiceLabel(sale.invoiceNumber),
      partyName: sale.party?.name,
      totalAmount: total,
      alreadyPaid: paid,
      initialAmount: mode === "REMAINING" ? remaining : (remaining > 0 ? remaining : total),
      existingPayments: sale.payments,
    });
  }

  /* ---- initial catalog load: products + customers, in parallel ---- */

  useEffect(() => {
    async function loadCatalog() {
      setLoadingCatalog(true);
      try {
        const [productsRes, customersRes] = await Promise.all([
          api.get("/api/product"),
          api.get("/api/parties", { params: { limit: 100, type: "CUSTOMER" } }),
        ]);
        setProducts(productsRes.data.products);
        setCustomers(customersRes.data.parties);
      } catch {
        setLoadError("Failed to load products/customers.");
      } finally {
        setLoadingCatalog(false);
      }
    }
    loadCatalog();
  }, []);

  /* ---- sales list — server-side pagination, refetches only on page change ---- */

  const loadSales = useCallback(async () => {
    setLoadingSales(true);
    try {
      const res = await api.get("/api/sales", { params: { page: currentPage, limit: PAGE_LIMIT } });
      setSales(res.data.sales);
      setPagination(res.data.pagination);
    } catch {
      setLoadError("Failed to load sales.");
    } finally {
      setLoadingSales(false);
    }
  }, [currentPage]);

  useEffect(() => { loadSales(); }, [loadSales]);



  const loadStats = useCallback(async () => {
    try {
      const res = await api.get("/api/sales/stats");
      setStats(res.data.stats);
    } catch {
      // non-critical — keep whatever was last loaded
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  function applyStatsDelta(prev: SaleRecord | null, next: SaleRecord | null) {
    setStats((s) => {
      let { totalCount, totalRevenue, cashCount, cashRevenue, creditCount, creditRevenue } = s;
      if (prev) {
        totalCount -= 1;
        totalRevenue -= Number(prev.grandTotal);
        if (prev.paymentType === "CASH") { cashCount -= 1; cashRevenue -= Number(prev.grandTotal); }
        else if (prev.paymentType === "CREDIT") { creditCount -= 1; creditRevenue -= Number(prev.grandTotal); }
      }
      if (next) {
        totalCount += 1;
        totalRevenue += Number(next.grandTotal);
        if (next.paymentType === "CASH") { cashCount += 1; cashRevenue += Number(next.grandTotal); }
        else if (next.paymentType === "CREDIT") { creditCount += 1; creditRevenue += Number(next.grandTotal); }
      }
      return { totalCount, totalRevenue, cashCount, cashRevenue, creditCount, creditRevenue };
    });
  }

  /* ---- client-side filtering of the current page (search has no backend
     support yet, same limitation pattern used on other pages) ---- */

  const filteredSales = search
    ? sales.filter((s) => {
      const q = search.toLowerCase();
      return (
        invoiceLabel(s.invoiceNumber).toLowerCase().includes(q) ||
        (s.party?.name ?? "").toLowerCase().includes(q) ||
        (s.prescriptionNote ?? "").toLowerCase().includes(q)
      );
    })
    : sales;

  const visibleSales = filteredSales.filter((s) => {
    if (paymentFilter !== "ALL" && s.paymentType !== paymentFilter) return false;
    const status = s.paymentStatus ?? "UNPAID";
    if (paymentStatusFilter !== "ALL" && status !== paymentStatusFilter) return false;
    if (partyFilter !== "ALL") {
      if (partyFilter === "WALK_IN") {
        if (s.partyId || s.party?.id) return false;
      } else {
        if ((s.partyId ?? s.party?.id) !== partyFilter) return false;
      }
    }
    return true;
  });



  const [showNewCustomerInline, setShowNewCustomerInline] = useState(false);
  const [inlineCust, setInlineCust] = useState({
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    panVatNumber: "",
    paymentTerms: "",
    address: "",
  });
  const [savingInlineCust, setSavingInlineCust] = useState(false);
  const [inlineCustError, setInlineCustError] = useState<string | null>(null);

  async function handleSaveInlineCustomer() {
    if (!inlineCust.name.trim()) {
      setInlineCustError("Party name is required.");
      return;
    }
    setSavingInlineCust(true);
    setInlineCustError(null);

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
      name: inlineCust.name.trim(),
      partyType: "BOTH",
    };
    if (inlineCust.contactPerson.trim()) payload.contactPerson = inlineCust.contactPerson.trim();
    if (inlineCust.phone.trim()) payload.phone = inlineCust.phone.trim();
    if (inlineCust.email.trim()) payload.email = inlineCust.email.trim();
    if (inlineCust.panVatNumber.trim()) payload.panVatNumber = inlineCust.panVatNumber.trim();
    if (inlineCust.paymentTerms.trim()) payload.paymentTerms = inlineCust.paymentTerms.trim();
    if (inlineCust.address.trim()) payload.address = inlineCust.address.trim();

    try {
      const res = await api.post("/api/parties", payload);
      const created: Customer = res.data.party;
      setCustomers((prev) => [created, ...prev]);
      setForm((p) => ({
        ...p,
        partyId: created.id,
        partyName: created.name,
      }));
      setShowNewCustomerInline(false);
      setInlineCust({ name: "", contactPerson: "", phone: "", email: "", panVatNumber: "", paymentTerms: "", address: "" });
    } catch (err: any) {
      setInlineCustError(
        err?.response?.data?.details?.fieldErrors?.email?.[0] ||
        err?.response?.data?.error ||
        "Failed to create party."
      );
    } finally {
      setSavingInlineCust(false);
    }
  }

  function handleStartNewCustomerInline(initialName: string = "") {
    setInlineCust({ name: initialName, contactPerson: "", phone: "", email: "", panVatNumber: "", paymentTerms: "", address: "" });
    setInlineCustError(null);
    setShowNewCustomerInline(true);
  }

  /* ---- sale modal ---- */

  function openAdd() {
    setEditingSaleId(null);
    setForm(emptyForm());
    setSaveError(null);
    setShowNewCustomerInline(false);
    setInlineCust({ name: "", contactPerson: "", phone: "", email: "", panVatNumber: "", paymentTerms: "", address: "" });
    setInlineCustError(null);
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

  const handlePrintSale = (sale: SaleRecord) => {
    const partyObj = customers.find((c) => c.id === sale.partyId) || sale.party;
    let vatableTotal = 0;
    let nonVatableTotal = 0;

    const items: InvoiceItem[] = sale.items.map((li, index) => {
      const prod = products.find((p) => p.id === li.productId);
      const isVat = (li as any).vatApplicable !== false;
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
        rate: Number(li.salePrice),
        amount: amt,
        batchNumber: li.batch?.batchNumber,
        expiryDate: li.batch?.expiryDate,
      };
    });

    const discount = Number(sale.discount || 0);
    const taxableAmount = Math.max(0, vatableTotal - discount);

    setPrintInvoiceData({
      type: "SALE",
      invoiceNumber: generateRandomInvoiceNo(sale.id),
      date: sale.saleDate ? sale.saleDate.split("T")[0] : "",
      partyName: partyObj?.name || (sale.party?.name ?? "Walk-in (Cash)"),
      partyAddress: (partyObj as any)?.address || undefined,
      partyPan: (partyObj as any)?.panVatNumber || undefined,
      partyPhone: (partyObj as any)?.phone || undefined,
      paymentType: sale.paymentType,
      items,
      subtotal: Number(sale.subtotal),
      discount,
      freightCharges: Number(sale.freightCharges || 0),
      vatRefund: Number(sale.vatRefund || 0),
      taxableAmount: Number(sale.vatAmount) > 0 ? taxableAmount : (vatableTotal > 0 ? taxableAmount : 0),
      nonTaxableAmount: nonVatableTotal,
      vatAmount: Number(sale.vatAmount || 0),
      roundOff: Number(sale.roundOff || 0),
      grandTotal: Number(sale.grandTotal),
    });
  };

  async function openEdit(record: SaleRecord) {
    setEditingSaleId(record.id);
    setSaveError(null);

    // Fetch batches for every distinct product on this sale so the pickers
    // are populated immediately, in parallel rather than one by one.
    const productIds = [...new Set(record.items.map((it) => it.productId))];
    const batchesByProduct = new Map<string, ApiBatch[]>();
    await Promise.all(
      productIds.map(async (productId) => {
        try {
          const res = await api.get(`/api/product/${productId}/batches`);
          batchesByProduct.set(productId, res.data.batches);
        } catch {
          batchesByProduct.set(productId, []);
        }
      })
    );

    setForm({
      date: record.saleDate.slice(0, 10),
      paymentType: record.paymentType,
      paymentStatus: record.paymentStatus ?? "UNPAID",
      vatRate: 13, // not persisted per-sale, same known limitation as purchases
      roundingDirection: record.roundingDirection,
      partyId: record.party?.id ?? "",
      partyName: record.party?.name ?? "",
      prescriptionNote: record.prescriptionNote ?? "",
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
      items: record.items.map((it) => {
        const product = products.find((p) => p.id === it.productId);
        const batches = batchesByProduct.get(it.productId) ?? [];
        const currentBatch = batches.find((b) => b.id === it.batchId) ?? it.batch;
        return {
          id: crypto.randomUUID(),
          productId: it.productId,
          productName: product?.name ?? "",
          unit: product?.unit ?? "",
          batchId: it.batchId,
          batchNo: currentBatch?.batchNumber ?? "",
          batchExpDate: currentBatch?.expiryDate ?? "",
          batchStock: batches.find((b) => b.id === it.batchId)?.quantityAvailable ?? it.quantity,
          availableBatches: batches,
          loadingBatches: false,
          qty: it.quantity,
          price: Number(it.salePrice),
          vatApplicable: true,
        };
      }),
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingSaleId(null);
    setSaveError(null);
    setShowNewCustomerInline(false);
    setInlineCust({ name: "", contactPerson: "", phone: "", email: "", panVatNumber: "", paymentTerms: "", address: "" });
    setInlineCustError(null);
  }

  function updateLine(id: string, patch: Partial<LineItemForm>) {
    setForm((p) => ({ ...p, items: p.items.map((li) => (li.id === id ? { ...li, ...patch } : li)) }));
  }

  async function handleSelectItem(lineId: string, product: Product) {
    updateLine(lineId, {
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      batchId: "",
      batchNo: "",
      batchExpDate: "",
      batchStock: 0,
      availableBatches: [],
      loadingBatches: true,
      qty: 1,
    });
    try {
      const res = await api.get(`/api/batches/${product.id}`);
      const batches: ApiBatch[] = res.data.batches; // already FEFO-ordered by the backend
      updateLine(lineId, { availableBatches: batches, loadingBatches: false });
    } catch {
      updateLine(lineId, { loadingBatches: false });
    }
  }

  function handleSelectBatch(lineId: string, batch: ApiBatch) {
    updateLine(lineId, {
      batchId: batch.id,
      batchNo: batch.batchNumber,
      batchExpDate: batch.expiryDate,
      batchStock: batch.quantityAvailable,
      price: batch.salePrice ? Number(batch.salePrice) : Number(batch.mrp),
    });
  }

  function addLine() {
    setForm((p) => ({ ...p, items: [...p.items, emptyLine()] }));
  }

  function removeLine(id: string) {
    setForm((p) => ({ ...p, items: p.items.length > 1 ? p.items.filter((li) => li.id !== id) : p.items }));
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

  /* ---- validation ---- */

  const validItems = form.items.filter((li) => li.productId && li.batchId && n(li.qty) > 0);
  const missingBatch = form.items.some((li) => li.productId && n(li.qty) > 0 && !li.batchId);
  const hasExceededBatchStock = form.items.some(
    (li) => li.batchId && n(li.qty) > 0 && (li.batchStock <= 0 || n(li.qty) > li.batchStock)
  );

  const subtotal = subtotalOf(form.items);
  const vatEstimate = estimateVat(form.items, form.vatRate);
  const adjustments = calculateAdjustmentsBreakdown(form.discounts, subtotal, vatEstimate);
  const hasRoundingAdjustment = form.discounts.some(
    (d) => d.category === "Rounded off (-)" || d.category === "Rounded off (+)"
  );
  const rawTotalEstimate =
    subtotal -
    adjustments.discountTotal -
    adjustments.vatRefundTotal -
    adjustments.roundOffMinusTotal +
    adjustments.freightTotal +
    adjustments.roundOffPlusTotal +
    vatEstimate;
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
      partyId: form.partyId || undefined,
      saleDate: form.date,
      paymentType: form.paymentType,
      vatRate: n(form.vatRate),
      discount: adjustments.discountTotal,
      freightCharges: adjustments.freightTotal,
      vatRefund: adjustments.vatRefundTotal,
      roundOff: roundOffValue,
      roundingDirection: adjustments.effectiveRoundingDirection,
      prescriptionNote: form.prescriptionNote.trim() || undefined,
      items: validItems.map((li) => ({
        productId: li.productId,
        batchId: li.batchId, // required — matches the backend's manual-only contract
        quantity: n(li.qty),
        salePrice: n(li.price),
        vatApplicable: li.vatApplicable,
      })),
    };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (validItems.length === 0 || missingBatch || hasExceededBatchStock) return;

    setSaving(true);
    setSaveError(null);

    try {
      const payload = buildPayload();

      if (editingSaleId) {
        await api.patch(`/api/sales/${editingSaleId}`, payload);
        const refreshed = await api.get(`/api/sales/${editingSaleId}`);
        const updated: SaleRecord = { ...refreshed.data.sale, paymentStatus: refreshed.data.sale.paymentStatus ?? "UNPAID" };
        const original = sales.find((s) => s.id === editingSaleId) ?? null;
        applyStatsDelta(original, updated);
        setSales((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      } else {
        const created = await api.post("/api/sales", payload);
        const fullSale = await api.get(`/api/sales/${created.data.saleId}`);
        const newSale: SaleRecord = { ...fullSale.data.sale, paymentStatus: fullSale.data.sale.paymentStatus ?? "UNPAID" };
        applyStatsDelta(null, newSale);
        if (currentPage === 1 && paymentFilter === "ALL" && !search) {
          setSales((prev) => [newSale, ...prev].slice(0, PAGE_LIMIT));
        }
        setPagination((p) => ({ ...p, total: p.total + 1, totalPages: Math.ceil((p.total + 1) / PAGE_LIMIT) }));
      }

      closeModal();
      // Refresh product stock in the background — a sale always changes stockQuantity.
      api.get("/api/product").then((r) => setProducts(r.data.products)).catch(() => { });
    } catch (err: any) {
      setSaveError(err?.response?.data?.error ?? "Failed to save sale.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(saleId: string, newStatus: PaymentStatus) {
    const sale = sales.find((item) => item.id === saleId) ?? (viewingSale?.id === saleId ? viewingSale : null);
    if (!sale) return;

    const { remaining } = getSalePaymentInfo(sale);

    if (newStatus === "PARTIAL") {
      openPaymentModal(sale, "PARTIAL");
      return;
    }

    if (newStatus === "PAID" && remaining > 0.01) {
      openPaymentModal(sale, "REMAINING");
      return;
    }

    const previous = sale.paymentStatus;

    // update the UI first so the dropdown feels instant
    setSales((prev) => prev.map((item) => (item.id === saleId ? { ...item, paymentStatus: newStatus } : item)));
    setViewingSale((prev) => (prev?.id === saleId ? { ...prev, paymentStatus: newStatus } : prev));

    setStatusUpdatingId(saleId);
    try {
      const res = await api.patch(`/api/sales/${saleId}/status`, { paymentStatus: newStatus });
      if (res.data?.sale) {
        setSales((prev) => prev.map((item) => (item.id === saleId ? { ...item, ...res.data.sale } : item)));
        setViewingSale((prev) => (prev?.id === saleId ? { ...prev, ...res.data.sale } : prev));
      }
    } catch (err: any) {
      // roll back if the server rejected it
      setSales((prev) => prev.map((item) => (item.id === saleId ? { ...item, paymentStatus: previous } : item)));
      setViewingSale((prev) => (prev?.id === saleId ? { ...prev, paymentStatus: previous } : prev));
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
    const saleId = partialModalTarget.id;
    setStatusUpdatingId(saleId);
    try {
      const alreadyPaid = partialModalTarget.alreadyPaid || 0;
      const totalPaid = alreadyPaid + data.amount;
      const grandTotal = partialModalTarget.totalAmount;
      const willBePaid = totalPaid >= grandTotal - 0.009;
      const expectedStatus: PaymentStatus = willBePaid ? "PAID" : "PARTIAL";

      const res = await api.patch(`/api/sales/${saleId}/status`, {
        paymentStatus: expectedStatus,
        ...data,
      });

      const updatedSale = res.data?.sale;
      const newStatus = updatedSale?.paymentStatus ?? expectedStatus;
      const newPayments = updatedSale?.payments;

      setSales((prev) =>
        prev.map((item) => {
          if (item.id !== saleId) return item;
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

      setViewingSale((prev) => {
        if (prev?.id !== saleId) return prev;
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

  async function handleDelete(id: string) {
    setDeleting(true);
    setDeleteError(null);
    try {
      const target = sales.find((s) => s.id === id) ?? null;
      await api.delete(`/api/sales/${id}`);
      applyStatsDelta(target, null);
      setSales((prev) => prev.filter((s) => s.id !== id));
      setPagination((p) => {
        const newTotal = Math.max(0, p.total - 1);
        return { ...p, total: newTotal, totalPages: Math.max(1, Math.ceil(newTotal / PAGE_LIMIT)) };
      });
      if (sales.length === 1 && currentPage > 1) setCurrentPage((p) => p - 1);
      setDeleteConfirmId(null);
      api.get("/api/product").then((r) => setProducts(r.data.products)).catch(() => { });
    } catch (err: any) {
      setDeleteError(err?.response?.data?.error ?? "Failed to delete sale.");
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = pagination.totalPages;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="rounded-xl bg-[#044d73] p-4 sm:px-6 sm:py-5 text-white shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>
          <p className="text-xs text-white/70 mt-0.5">Sales invoices, cash & credit billing with batch inventory tracking</p>
        </div>
        <button
          onClick={openAdd}
          disabled={loadingCatalog}
          className="flex items-center gap-2 bg-white text-[#044d73] hover:bg-slate-50 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Add Sale
        </button>
      </div>

      {loadError && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-600 font-medium">{loadError}</div>}

      {/* Stats — real backend aggregate, fixed regardless of page/search/filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border-l-4 border-l-slate-400 border border-slate-200 bg-white p-4 sm:p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Total Sales</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-1"><AnimatedStatValue value={stats.totalCount} /></p>
          </div>
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600">
            <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>
        <div className="rounded-xl border-l-4 border-l-[#044d73] border border-slate-200 bg-white p-4 sm:p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Total Revenue</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-1"><AnimatedStatValue value={stats.totalRevenue} format={rs} /></p>
          </div>
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-[#044d73]/10 text-[#044d73]">
            <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>
        <div className="rounded-xl border-l-4 border-l-emerald-500 border border-slate-200 bg-white p-4 sm:p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Cash Sales</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-1"><AnimatedStatValue value={stats.cashCount} /></p>
          </div>
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Banknote className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>
        <div className="rounded-xl border-l-4 border-l-amber-500 border border-slate-200 bg-white p-4 sm:p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Credit Sales</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-1">
              <AnimatedStatValue value={stats.creditCount} /> <span className="text-sm font-semibold text-slate-500">({rs(stats.creditRevenue)})</span>
            </p>
          </div>
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <CreditCard className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-wrap">
        <div className="relative flex-1 min-w-0 sm:min-w-[200px] w-full sm:max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search this page by invoice, party, or note"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
          />
        </div>
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value as typeof paymentFilter)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 focus:border-[#044d73] focus:outline-none"
        >
          <option value="ALL">All Payment Types</option>
          <option value="CASH">Cash</option>
          <option value="CREDIT">Credit</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
          <option value="CHEQUE">Cheque</option>
          <option value="MOBILE_PAYMENT">Mobile Payment</option>
        </select>

        <select
          value={paymentStatusFilter}
          onChange={(e) => setPaymentStatusFilter(e.target.value as typeof paymentStatusFilter)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 focus:border-[#044d73] focus:outline-none"
        >
          <option value="ALL">All Payment Statuses</option>
          <option value="PAID">Paid</option>
          <option value="PARTIAL">Partial</option>
          <option value="UNPAID">Unpaid</option>
        </select>

        {/* Party Filter */}
        <select
          value={partyFilter}
          onChange={(e) => {
            setPartyFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 focus:border-[#044d73] focus:outline-none max-w-[180px] truncate"
        >
          <option value="ALL">All Parties</option>
          <option value="WALK_IN">Walk-in (Cash)</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Invoice No.</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Party</th>
                <th className="py-3 px-4">Items & Dispensed Batches</th>
                <th className="py-3 px-4">Total Qty</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingSales ? (
                <tr><td colSpan={9} className="py-16 text-center text-sm text-slate-400">Loading sales...</td></tr>
              ) : visibleSales.length === 0 ? (
                <tr><td colSpan={9} className="py-16 text-center text-sm text-slate-400">No sales vouchers match criteria.</td></tr>
              ) : visibleSales.map((s) => {
                const totalQty = s.items.reduce((acc, li) => acc + li.quantity, 0);
                const currentStatus: PaymentStatus = s.paymentStatus ?? "UNPAID";
                return (
                  <tr key={s.id} onClick={() => setViewingSale(s)} className="hover:bg-slate-50/80 transition-colors text-slate-700 cursor-pointer group">
                    <td className="py-3 px-4 text-slate-500">{s.saleDate.slice(0, 10)}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800 group-hover:text-[#044d73] transition-colors">{invoiceLabel(s.invoiceNumber)}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold border ${PAYMENT_TYPE_STYLES[s.paymentType]?.badge ?? "bg-slate-50 border-slate-200 text-slate-700"}`}>
                        {PAYMENT_TYPE_LABELS[s.paymentType] ?? s.paymentType}
                      </span>
                    </td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col gap-1 items-start">
                        <select
                          value={currentStatus}
                          disabled={statusUpdatingId === s.id}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleStatusChange(s.id, e.target.value as PaymentStatus);
                          }}
                          className={`cursor-pointer disabled:opacity-50 text-[10px] font-bold rounded-full px-2 py-0.5 border transition-colors outline-none ${PAYMENT_STATUS_STYLES[currentStatus]?.badge
                            }`}
                        >
                          <option value="PAID">Paid</option>
                          <option value="PARTIAL">Partial</option>
                          <option value="UNPAID">Unpaid</option>
                        </select>
                        {(() => {
                          const payInfo = getSalePaymentInfo(s);
                          if (currentStatus === "PARTIAL" && payInfo.remaining > 0.01) {
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPaymentModal(s, "REMAINING");
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
                    <td className="py-3 px-4">
                      {s.party?.name ? (
                        <div className="flex items-center gap-1.5 font-medium text-slate-800"><User className="w-3.5 h-3.5 text-slate-400" /><span>{s.party.name}</span></div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Walk-in (Cash)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="flex flex-col gap-1">
                        {s.items.slice(0, 2).map((li, i) => {
                          const product = products.find((p) => p.id === li.productId);
                          return (
                            <div key={i} className="flex flex-wrap items-center gap-1.5 text-xs">
                              <span className="font-medium text-slate-800">{product?.name || "Item"}</span>
                              {li.batch?.batchNumber && (
                                <span className="inline-flex items-center gap-1 rounded bg-[#044d73]/10 px-1.5 py-0.2 text-[10px] font-semibold text-[#044d73] border border-[#044d73]/20">
                                  <Boxes className="w-2.5 h-2.5" /> B: {li.batch.batchNumber}
                                </span>
                              )}
                            </div>
                          );
                        })}
                        {s.items.length > 2 && (
                          <span className="text-[11px] text-slate-400 font-medium">+{s.items.length - 2} more item{s.items.length - 2 > 1 ? "s" : ""}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500">{totalQty}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{rs(Number(s.grandTotal))}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintSale(s);
                          }}
                          title="Print / Download Tax Invoice"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#044d73] hover:bg-[#044d73]/10 transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); openEdit(s); }} title="Edit Sale" className="p-1.5 rounded-lg text-slate-400 hover:text-[#044d73] hover:bg-[#044d73]/10 transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(s.id); setDeleteError(null); }} title="Delete" className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
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

        {pagination.total > 0 && (
          <div className="flex flex-col gap-4 items-center justify-between border-t border-slate-100 bg-white px-6 py-4 sm:flex-row">
            <span className="text-xs text-slate-400">Page {currentPage} of {totalPages} · {pagination.total} total sale{pagination.total !== 1 ? "s" : ""}</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
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
                <h3 className="text-base font-semibold text-slate-900">Delete Sales Voucher?</h3>
                <p className="text-sm text-slate-500 mt-1">This will reverse the stock deducted by this sale.</p>
              </div>
            </div>
            {deleteError && <div className="mx-6 mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{deleteError}</div>}
            <div className="flex gap-3 p-6">
              <button onClick={() => setDeleteConfirmId(null)} disabled={deleting} className="flex-1 bg-slate-50 border border-slate-200 text-slate-600 font-medium text-sm py-2.5 rounded-lg disabled:opacity-50">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirmId)} disabled={deleting} className="flex-1 bg-red-500 text-white font-semibold text-sm py-2.5 rounded-lg disabled:opacity-50">
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Sale Modal */}
      {viewingSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewingSale(null)}>
          <div className="bg-white border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="relative flex shrink-0 items-center justify-between p-6 bg-[#044d73] text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><ShoppingCart className="h-5 w-5" /></div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{invoiceLabel(viewingSale.invoiceNumber)}</h3>
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold border ${PAYMENT_TYPE_STYLES[viewingSale.paymentType]?.viewBadge ?? "bg-slate-400/20 border-slate-300 text-slate-100"}`}>
                      {PAYMENT_TYPE_LABELS[viewingSale.paymentType] ?? viewingSale.paymentType}
                    </span>
                    <select
                      value={viewingSale.paymentStatus ?? "UNPAID"}
                      disabled={statusUpdatingId === viewingSale.id}
                      onChange={(e) => handleStatusChange(viewingSale.id, e.target.value as PaymentStatus)}
                      className={`cursor-pointer disabled:opacity-50 text-[10px] font-bold rounded-full px-2.5 py-0.5 border outline-none ${PAYMENT_STATUS_STYLES[viewingSale.paymentStatus ?? "UNPAID"]?.viewBadge ?? "bg-slate-400/20 border-slate-300 text-slate-100"
                        }`}
                    >
                      <option value="PAID" className="text-slate-900 bg-white">Paid</option>
                      <option value="PARTIAL" className="text-slate-900 bg-white">Partial</option>
                      <option value="UNPAID" className="text-slate-900 bg-white">Unpaid</option>
                    </select>
                  </div>
                  <p className="text-xs text-white/70 mt-0.5">Date: {viewingSale.saleDate.slice(0, 10)} · Party: {viewingSale.party?.name || "Walk-in Cash Customer"}</p>
                </div>
              </div>
              <button type="button" onClick={() => setViewingSale(null)} className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium uppercase text-[10px]">Voucher No</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{invoiceLabel(viewingSale.invoiceNumber)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium uppercase text-[10px]">Date</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{viewingSale.saleDate.slice(0, 10)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium uppercase text-[10px]">Party</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{viewingSale.party?.name || "Walk-in Cash"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium uppercase text-[10px]">Payment Type</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{PAYMENT_TYPE_LABELS[viewingSale.paymentType] ?? viewingSale.paymentType}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium uppercase text-[10px]">Payment Status</span>
                  <select
                    value={viewingSale.paymentStatus ?? "UNPAID"}
                    disabled={statusUpdatingId === viewingSale.id}
                    onChange={(e) => handleStatusChange(viewingSale.id, e.target.value as PaymentStatus)}
                    className={`cursor-pointer disabled:opacity-50 text-xs font-bold rounded-lg px-2 py-1 border mt-0.5 outline-none block w-full ${PAYMENT_STATUS_STYLES[viewingSale.paymentStatus ?? "UNPAID"]?.badge
                      }`}
                  >
                    <option value="PAID">Paid</option>
                    <option value="PARTIAL">Partial</option>
                    <option value="UNPAID">Unpaid</option>
                  </select>
                </div>
              </div>

              {/* Payment Summary & Settlement Banner */}
              {(() => {
                const payInfo = getSalePaymentInfo(viewingSale);
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
                            Paid: <strong className="text-emerald-700 font-mono">Rs. {payInfo.paid.toFixed(2)}</strong>
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
                            onClick={() => openPaymentModal(viewingSale, "PARTIAL")}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            + Partial Pay
                          </button>
                          <button
                            type="button"
                            onClick={() => openPaymentModal(viewingSale, "REMAINING")}
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
                    {viewingSale.payments && viewingSale.payments.length > 0 && (
                      <div className="border-t border-slate-200/80 pt-2.5 mt-2">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                          Recorded Payment Vouchers ({viewingSale.payments.length})
                        </p>
                        <div className="space-y-1">
                          {viewingSale.payments.map((p, pIdx) => (
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
                  <PackageCheck className="w-4 h-4" /> Sold Items & Dispensed Batches
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Item Name</th>
                        <th className="py-2.5 px-3">Deducted Batch</th>
                        <th className="py-2.5 px-3">Expiry Date</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3">Rate</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewingSale.items.map((li, idx) => {
                        const product = products.find((p) => p.id === li.productId);
                        return (
                          <tr key={li.id || idx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-medium text-slate-800">{product?.name || "—"}</td>
                            <td className="py-2.5 px-3">
                              {li.batch?.batchNumber ? (
                                <span className="inline-flex items-center gap-1 rounded bg-[#044d73]/10 px-2 py-0.5 text-[11px] font-semibold text-[#044d73] border border-[#044d73]/20">
                                  <Boxes className="w-3 h-3" /> {li.batch.batchNumber}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">{li.batch?.expiryDate || "—"}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800 text-center">{li.quantity}</td>
                            <td className="py-2.5 px-3 text-slate-600">{rs(Number(li.salePrice))}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-800 text-right">{rs(Number(li.lineTotal))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {viewingSale.prescriptionNote && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Notes / Prescription Reference</span>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap">{viewingSale.prescriptionNote}</p>
                </div>
              )}

              <div className="ml-auto w-full max-w-xs space-y-1.5 rounded-xl bg-slate-50 p-4 border border-slate-200">
                <div className="flex justify-between text-xs text-slate-500"><span>Subtotal</span><span>{rs(Number(viewingSale.subtotal))}</span></div>
                {Number(viewingSale.discount) > 0 && (
                  <div className="flex justify-between text-xs text-slate-500"><span>Discount</span><span>- {rs(Number(viewingSale.discount))}</span></div>
                )}
                {Number(viewingSale.freightCharges) > 0 && (
                  <div className="flex justify-between text-xs text-slate-500"><span>Freight & Forwarding</span><span>+ {rs(Number(viewingSale.freightCharges))}</span></div>
                )}
                {Number(viewingSale.vatRefund) > 0 && (
                  <div className="flex justify-between text-xs text-slate-500"><span>VAT Refund</span><span>- {rs(Number(viewingSale.vatRefund))}</span></div>
                )}
                {Number(viewingSale.roundOff) < 0 && (
                  <div className="flex justify-between text-xs text-slate-500"><span>Rounded Off (−)</span><span>- {rs(Math.abs(Number(viewingSale.roundOff)))}</span></div>
                )}
                {Number(viewingSale.roundOff) > 0 && (
                  <div className="flex justify-between text-xs text-slate-500"><span>Rounded Off (+)</span><span>+ {rs(Number(viewingSale.roundOff))}</span></div>
                )}
                {Number(viewingSale.vatAmount) > 0 && (
                  <div className="flex justify-between text-xs text-slate-500"><span>VAT</span><span>{rs(Number(viewingSale.vatAmount))}</span></div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-800"><span>Grand Total</span><span className="text-[#044d73]">{rs(Number(viewingSale.grandTotal))}</span></div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 bg-white p-4 px-6">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintSale(viewingSale)}
                  className="flex items-center gap-1.5 rounded-lg bg-[#044d73] hover:bg-[#033b59] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / Download Tax Invoice
                </button>
                <button type="button" onClick={() => { const s = viewingSale; setViewingSale(null); openEdit(s); }} className="flex items-center gap-1.5 rounded-lg border border-[#044d73]/30 bg-[#044d73]/5 hover:bg-[#044d73]/10 px-4 py-2 text-xs font-semibold text-[#044d73] transition-colors">
                  <Pencil className="w-3.5 h-3.5" /> Edit Sale Voucher
                </button>
              </div>
              <button type="button" onClick={() => setViewingSale(null)} className="rounded-lg bg-slate-100 hover:bg-slate-200 px-5 py-2 text-xs font-semibold text-slate-700 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Sale Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-slate-200 w-full max-w-5xl max-h-[94vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden">
            <div className="relative flex shrink-0 items-center justify-between px-7 py-5 bg-[#044d73] text-white">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10"><ShoppingCart className="h-6 w-6" /></div>
                <div>
                  <h3 className="text-xl font-semibold">{editingSaleId ? "Edit Sales Voucher" : "Add Sale"}</h3>
                  <p className="text-xs text-white/70">Invoice number is assigned automatically; select party, items, and batch details</p>
                </div>
              </div>
              <button type="button" onClick={closeModal} className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-6 overflow-y-auto p-7">
                {saveError && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-600 font-medium">{saveError}</div>}

                <Section title="Voucher & Party" icon={<ShoppingCart className="w-3.5 h-3.5" />}>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Date">
                      <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} className={inputCls} />
                    </Field>
                    <Field label="Payment Type">
                      <select
                        value={form.paymentType}
                        onChange={(e) => {
                          const pt = e.target.value as PaymentType;
                          setForm((p) => ({
                            ...p,
                            paymentType: pt,
                            paymentStatus: "UNPAID",
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

                    <Field label="VAT Rate (%)">
                      <input type="number" min={0} max={100} step="0.01" value={form.vatRate} onChange={(e) => setForm((p) => ({ ...p, vatRate: e.target.value === "" ? "" : Number(e.target.value) }))} className={inputCls} />
                    </Field>

                    <div className="sm:col-span-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className={labelCls}>Party</label>
                        {!showNewCustomerInline ? (
                          <button
                            type="button"
                            onClick={() => handleStartNewCustomerInline("")}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#044d73] hover:text-[#033b59] hover:underline cursor-pointer"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            <span>+ New Party</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setShowNewCustomerInline(false);
                              setInlineCustError(null);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                          >
                            <span>Back to party search</span>
                          </button>
                        )}
                      </div>

                      {showNewCustomerInline ? (
                        <div className="rounded-xl border border-[#044d73]/25 bg-slate-50/80 p-4 space-y-3.5 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                            <div className="flex items-center gap-2 text-xs font-bold text-[#044d73]">
                              <UserPlus className="w-4 h-4" />
                              <span>Add New Party Details</span>
                            </div>
                            <span className="text-[11px] text-slate-400">Saved to party catalog</span>
                          </div>

                          {inlineCustError && (
                            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600 font-medium">
                              {inlineCustError}
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
                                value={inlineCust.name}
                                onChange={(e) => setInlineCust((p) => ({ ...p, name: e.target.value }))}
                                placeholder="e.g. Ram Bahadur"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Contact Person (optional)
                              </label>
                              <input
                                type="text"
                                value={inlineCust.contactPerson}
                                onChange={(e) => setInlineCust((p) => ({ ...p, contactPerson: e.target.value }))}
                                placeholder="e.g. Manager / Rep name"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Phone Number
                              </label>
                              <input
                                type="tel"
                                value={inlineCust.phone}
                                onChange={(e) => setInlineCust((p) => ({ ...p, phone: e.target.value }))}
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
                                value={inlineCust.panVatNumber}
                                onChange={(e) => setInlineCust((p) => ({ ...p, panVatNumber: e.target.value }))}
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
                                value={inlineCust.email}
                                onChange={(e) => setInlineCust((p) => ({ ...p, email: e.target.value }))}
                                placeholder="e.g. customer@example.com"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Payment Terms (optional)
                              </label>
                              <input
                                type="text"
                                value={inlineCust.paymentTerms}
                                onChange={(e) => setInlineCust((p) => ({ ...p, paymentTerms: e.target.value }))}
                                placeholder="e.g. Net 30, Cash on Delivery"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Address (optional)
                              </label>
                              <input
                                type="text"
                                value={inlineCust.address}
                                onChange={(e) => setInlineCust((p) => ({ ...p, address: e.target.value }))}
                                placeholder="e.g. Kathmandu"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/80">
                            <button
                              type="button"
                              onClick={() => {
                                setShowNewCustomerInline(false);
                                setInlineCustError(null);
                              }}
                              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={savingInlineCust || !inlineCust.name.trim()}
                              onClick={handleSaveInlineCustomer}
                              className="px-4 py-1.5 text-xs font-semibold text-white bg-[#044d73] hover:bg-[#033f60] rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
                            >
                              {savingInlineCust ? "Saving..." : "Save Party"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <CustomerCombobox
                            customers={customers}
                            selectedId={form.partyId}
                            selectedName={form.partyName}
                            onSelectCustomer={(cust) => setForm((p) => ({ ...p, partyId: cust ? cust.id : "", partyName: cust ? cust.name : "" }))}
                            onStartNewCustomer={handleStartNewCustomerInline}
                          />
                          {form.partyId && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-[11px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                              {(() => {
                                const c = customers.find((x) => x.id === form.partyId);
                                if (!c) return null;
                                return (
                                  <>
                                    <span className="font-semibold text-slate-700">{c.name}</span>
                                    {c.contactPerson && <span className="text-slate-600">👤 {c.contactPerson}</span>}
                                    {c.phone && <span className="text-slate-600">📞 {c.phone}</span>}
                                    {c.email && <span className="text-slate-600">✉️ {c.email}</span>}
                                    {c.address && <span className="text-slate-600">📍 {c.address}</span>}
                                    {c.panVatNumber && <span className="text-slate-600">🏛️ PAN: {c.panVatNumber}</span>}
                                    {c.paymentTerms && <span className="text-slate-600">💳 Terms: {c.paymentTerms}</span>}
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </Section>

                <Section title="Items & Batch Allocation" icon={<PackageCheck className="w-3.5 h-3.5" />}>
                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50/90 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                            <th className="py-3 px-3 w-10 text-center">#</th>
                            <th className="py-3 px-3 min-w-[220px]">Medicine / Item</th>
                            <th className="py-3 px-3 min-w-[220px]">Batch</th>
                            <th className="py-3 px-2.5 w-[90px]">Qty</th>
                            <th className="py-3 px-2 w-[70px] text-center">Unit</th>
                            <th className="py-3 px-2.5 w-[110px]">Sale Rate</th>
                            <th className="py-3 px-2 w-[85px] text-center">VAT</th>
                            <th className="py-3 px-3 w-[110px] text-right">Amount</th>
                            <th className="py-3 px-2 w-[50px] text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {form.items.map((line, idx) => {
                            const exceedsStock = !!line.batchId && n(line.qty) > 0 && (line.batchStock <= 0 || n(line.qty) > line.batchStock);

                            return (
                              <tr key={line.id} className={`transition-colors ${exceedsStock ? "bg-red-50/40" : "hover:bg-slate-50/50"}`}>
                                <td className="py-3 px-3 text-center font-medium text-slate-400">{idx + 1}</td>
                                <td className="py-3 px-3">
                                  <ItemPicker
                                    products={products}
                                    value={line.productId}
                                    selectedName={line.productName}
                                    onSelect={(p) => handleSelectItem(line.id, p)}
                                  />
                                </td>
                                <td className="py-3 px-3">
                                  {!line.productId ? (
                                    <span className="text-slate-400 italic text-[11px]">Select an item first</span>
                                  ) : (
                                    <BatchPicker
                                      batches={line.availableBatches}
                                      loading={line.loadingBatches}
                                      selectedBatchId={line.batchId}
                                      unit={line.unit}
                                      onSelectBatch={(b) => handleSelectBatch(line.id, b)}
                                    />
                                  )}
                                </td>
                                <td className="py-3 px-2.5">
                                  <input
                                    type="number"
                                    min={1}
                                    max={line.batchStock > 0 ? line.batchStock : undefined}
                                    step="1"
                                    placeholder="0"
                                    value={line.qty}
                                    onChange={(e) => updateLine(line.id, { qty: e.target.value === "" ? "" : Number(e.target.value) })}
                                    className={`h-9 w-full rounded-lg border px-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 ${exceedsStock ? "border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-red-500" : "border-slate-200 bg-white focus:border-[#044d73] focus:ring-[#044d73]"
                                      }`}
                                  />
                                  {exceedsStock && (
                                    <span className="text-[10px] text-red-600 font-bold block mt-0.5">
                                      {line.batchStock <= 0 ? "Out of stock" : `Max: ${line.batchStock}`}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-2 text-center">
                                  <span className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-600">{line.unit || "—"}</span>
                                </td>
                                <td className="py-3 px-2.5">
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    placeholder="0.00"
                                    value={line.price}
                                    onChange={(e) => updateLine(line.id, { price: e.target.value === "" ? "" : Number(e.target.value) })}
                                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                                  />
                                </td>
                                <td className="py-3 px-2 text-center">
                                  <label className="inline-flex items-center gap-1.5 cursor-pointer select-none py-1.5 px-2 rounded-lg hover:bg-slate-100/80 transition-colors">
                                    <input
                                      type="checkbox"
                                      checked={line.vatApplicable}
                                      onChange={(e) => updateLine(line.id, { vatApplicable: e.target.checked })}
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
                                <td className="py-3 px-2 text-center">
                                  <button type="button" onClick={() => removeLine(line.id)} disabled={form.items.length <= 1} title="Remove item" className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="border-t border-slate-100 bg-slate-50/50 p-3 px-4 flex items-center justify-between">
                      <button type="button" onClick={addLine} className="flex items-center gap-2 rounded-lg bg-[#044d73]/10 hover:bg-[#044d73]/20 px-3.5 py-2 text-xs font-semibold text-[#044d73] transition-colors">
                        <Plus className="w-4 h-4" /> Add Item Line
                      </button>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {form.items.length} item row{form.items.length !== 1 ? "s" : ""} — add another line to sell the same item from a different batch
                      </span>
                    </div>
                  </div>

                  {missingBatch && (
                    <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5 px-3 text-xs text-amber-700">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>Select a batch for every item line before saving.</span>
                    </div>
                  )}
                  {hasExceededBatchStock && (
                    <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-2.5 px-3 text-xs text-red-700">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                      <span>One or more items exceed batch stock or are out of stock. Please adjust quantity or select another batch.</span>
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
                    <p className="rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs text-slate-400">No discount or charges applied to this sale.</p>
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
                                    <option value="Percentage">Percentage (%)</option>
                                    <option value="Flat">Flat (Rs.)</option>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <div>
                    <label className={labelCls}>Notes / Prescription Reference</label>
                    <textarea
                      rows={3}
                      value={form.prescriptionNote}
                      onChange={(e) => setForm((p) => ({ ...p, prescriptionNote: e.target.value }))}
                      placeholder="Doctor name, prescription remarks or dispensing notes..."
                      className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 placeholder:text-slate-300 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                    />
                  </div>

                  <div className="space-y-1.5 rounded-xl bg-slate-50 p-4 border border-slate-200">
                    <div className="flex justify-between text-xs sm:text-sm text-slate-500"><span>Subtotal</span><span>{rs(subtotal)}</span></div>
                    {adjustments.discountTotal > 0 && (
                      <div className="flex justify-between text-xs sm:text-sm text-slate-500"><span>Discount</span><span>- {rs(adjustments.discountTotal)}</span></div>
                    )}
                    {adjustments.freightTotal > 0 && (
                      <div className="flex justify-between text-xs sm:text-sm text-slate-500"><span>Freight & Forwarding</span><span>+ {rs(adjustments.freightTotal)}</span></div>
                    )}
                    {adjustments.vatRefundTotal > 0 && (
                      <div className="flex justify-between text-xs sm:text-sm text-slate-500"><span>VAT Refund</span><span>- {rs(adjustments.vatRefundTotal)}</span></div>
                    )}
                    {adjustments.roundOffMinusTotal > 0 && (
                      <div className="flex justify-between text-xs sm:text-sm text-slate-500"><span>Rounded Off (−)</span><span>- {rs(adjustments.roundOffMinusTotal)}</span></div>
                    )}
                    {adjustments.roundOffPlusTotal > 0 && (
                      <div className="flex justify-between text-xs sm:text-sm text-slate-500"><span>Rounded Off (+)</span><span>+ {rs(adjustments.roundOffPlusTotal)}</span></div>
                    )}
                    <div className="flex justify-between text-xs sm:text-sm text-slate-500"><span>VAT (estimate)</span><span>{rs(vatEstimate)}</span></div>
                    <div className="flex justify-between border-t border-slate-200 pt-2 text-sm sm:text-base font-bold text-slate-800"><span>Grand Total (estimate)</span><span className="text-[#044d73]">{rs(grandTotalEstimate)}</span></div>
                    <p className="text-[10px] text-slate-400 pt-1">Final totals are calculated by the server on save.</p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex shrink-0 gap-3 border-t border-slate-100 bg-white p-4 sm:p-5 px-4 sm:px-7">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || validItems.length === 0 || missingBatch || hasExceededBatchStock}
                  className="flex-1 rounded-lg bg-[#044d73] hover:bg-[#033f60] py-2.5 text-sm font-medium text-white shadow-sm transition-colors disabled:opacity-40"
                >
                  {saving ? "Saving..." : editingSaleId ? "Save Changes" : "Save Sale Voucher"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tax Invoice Modal for Printing / PDF Download */}
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
          direction="CUSTOMER"
          onConfirm={handleConfirmPartialPayment}
        />
      )}
    </div>
  );
}