"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Printer,
  Search,
  X,
  Pencil,
  Trash2,
  AlertTriangle,
  Check,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";
import { DotsLoader } from "@/app/pharma/_components/ui/dots-loader";
import { AnimatedStatValue } from "../_components/ui/animated-stat-value";
import { TaxInvoiceModal, type InvoiceItem, type TaxInvoiceData } from "../_components/TaxInvoiceModal";

type TransactionKind =
  | "SALE"
  | "PURCHASE"
  | "SALE_RETURN"
  | "PURCHASE_RETURN"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_PAID";

// Matches GET /api/transactions response shape
interface TransactionRow {
  id: string;
  kind: TransactionKind;
  date: string;
  voucherNo: string;
  partyId: string | null;
  partyName: string | null;
  amount: number;
  paid: number | null;
  due: number | null;
  status: string | null;
  method: string | null;
  details: string | null;
}

interface Summary {
  totalSales: number;
  totalPurchases: number;
  totalSaleReturns: number;
  totalPurchaseReturns: number;
  paymentsReceived: number;
  paymentsPaid: number;
  receivable: number;
  payable: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PartyOption {
  id: string;
  name: string;
}

type TypeFilter = "ALL" | "SALE" | "PURCHASE" | "SALE_RETURN" | "PURCHASE_RETURN" | "PAYMENT";

const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 400;

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "ALL", label: "All types" },
  { value: "SALE", label: "Sales" },
  { value: "PURCHASE", label: "Purchases" },
  { value: "PURCHASE_RETURN", label: "Purchase Returns" },
  { value: "PAYMENT", label: "Payments" },
];

const KIND_BADGE: Record<TransactionKind, { label: string; className: string }> = {
  SALE: { label: "Sale", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PURCHASE: { label: "Purchase", className: "bg-sky-50 text-sky-700 border-sky-200" },
  SALE_RETURN: { label: "Sale Return", className: "bg-amber-50 text-amber-700 border-amber-200" },
  PURCHASE_RETURN: { label: "Purchase Return", className: "bg-orange-50 text-orange-700 border-orange-200" },
  PAYMENT_RECEIVED: { label: "Payment In", className: "bg-teal-50 text-teal-700 border-teal-200" },
  PAYMENT_PAID: { label: "Payment Out", className: "bg-violet-50 text-violet-700 border-violet-200" },
};

const STATUS_BADGE: Record<string, string> = {
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PARTIAL: "bg-amber-50 text-amber-700 border-amber-200",
  UNPAID: "bg-red-50 text-red-700 border-red-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
};

const EMPTY_SUMMARY: Summary = {
  totalSales: 0,
  totalPurchases: 0,
  totalSaleReturns: 0,
  totalPurchaseReturns: 0,
  paymentsReceived: 0,
  paymentsPaid: 0,
  receivable: 0,
  payable: 0,
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency: "NPR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/^\w|\s\w/g, (c) => c.toUpperCase());
}

export default function TransactionsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isOwner = user?.isOwner ?? false;
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    totalPages: 1,
  });
  const [parties, setParties] = useState<PartyOption[]>([]);

  const [type, setType] = useState<TypeFilter>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [partyId, setPartyId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [refreshCount, setRefreshCount] = useState(0);

  // Modal states
  const [selectedRow, setSelectedRow] = useState<TransactionRow | null>(null);
  const [deletingRow, setDeletingRow] = useState<TransactionRow | null>(null);
  const [editingPaymentRow, setEditingPaymentRow] = useState<TransactionRow | null>(null);

  // Loading is derived: data counts as loaded once it was fetched for the current filters.
  const requestKey = JSON.stringify({ page, type, search, partyId, startDate, endDate, refreshCount });
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const loading = loadedKey !== requestKey && errorKey !== requestKey;
  const error = errorKey === requestKey ? "Failed to load transactions. Please try again." : "";

  function handleEdit(row: TransactionRow) {
    if (row.kind === "SALE") {
      router.push(`/pharma/sales?edit=${row.id}`);
    } else if (row.kind === "PURCHASE") {
      router.push(`/pharma/purchase?edit=${row.id}`);
    } else if (row.kind === "PAYMENT_RECEIVED" || row.kind === "PAYMENT_PAID") {
      setEditingPaymentRow(row);
    }
  }

  // Party dropdown options (loaded once)
  useEffect(() => {
    api
      .get("/api/parties", { params: { limit: 200 } })
      .then((res) => setParties(res.data?.parties ?? []))
      .catch((err) => console.error("Failed to load parties:", err));
  }, []);

  // Debounce the search box so we don't hit the API on every keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/transactions", {
        params: {
          page,
          limit: PAGE_LIMIT,
          type,
          search: search || undefined,
          partyId: partyId || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      })
      .then((res) => {
        if (cancelled) return;
        setRows(res.data.transactions ?? []);
        setSummary(res.data.summary ?? EMPTY_SUMMARY);
        setPagination(res.data.pagination);
        setLoadedKey(requestKey);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load transactions:", err);
        setErrorKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, page, type, search, partyId, startDate, endDate]);

  const hasFilters = Boolean(searchInput || type !== "ALL" || partyId || startDate || endDate);

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setType("ALL");
    setPartyId("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* Header Banner */}
      <div className="rounded-xl bg-[#044d73] p-4 sm:px-6 sm:py-5 text-white shadow-sm">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">All Transactions</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <SummaryCard label="Total Sales" value={summary.totalSales} accent="border-l-emerald-500" />
        <SummaryCard label="Total Purchases" value={summary.totalPurchases} accent="border-l-sky-500" />
        <SummaryCard label="To Collect" value={summary.receivable} accent="border-l-amber-500" />
        <SummaryCard label="To Pay" value={summary.payable} accent="border-l-red-500" />
      </div>
      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search voucher no. or party..."
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:border-[#044d73]"
            />
          </div>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as TypeFilter);
              setPage(1);
            }}
            aria-label="Transaction type"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#044d73]"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={partyId}
            onChange={(e) => {
              setPartyId(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#044d73]"
          >
            <option value="">All parties</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={startDate}
            max={endDate || undefined}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            aria-label="From date"
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#044d73]"
          />
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            aria-label="To date"
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#044d73]"
          />
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex w-fit items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16">
            <DotsLoader text="Loading transactions..." size="md" />
          </div>
        ) : error ? (
          <div className="p-12 text-center text-sm text-red-600">{error}</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">No transactions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Voucher</th>
                  <th className="py-3 px-4">Party</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Due</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const badge = KIND_BADGE[row.kind];
                  const detail = row.details ?? (row.method ? titleCase(row.method) : "—");
                  return (
                    <tr
                      key={`${row.kind}-${row.id}`}
                      onClick={() => setSelectedRow(row)}
                      className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                    >
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600">{formatDate(row.date)}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">{row.voucherNo}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {row.partyId ? (
                          <Link
                            href={`/pharma/parties/${row.partyId}/ledger`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[#044d73] hover:underline"
                          >
                            {row.partyName ?? "—"}
                          </Link>
                        ) : (
                          <span className="text-slate-500">{row.partyName ?? "—"}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        <div className="max-w-40 line-clamp-2 wrap-break-word" title={detail}>
                          {detail}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-semibold text-slate-800">
                        {formatCurrency(row.amount)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap text-slate-600">
                        {row.paid === null ? "—" : formatCurrency(row.paid)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap text-slate-600">
                        {row.due === null ? "—" : formatCurrency(row.due)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {row.status ? (
                          <span
                            className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                              STATUS_BADGE[row.status] ?? "bg-slate-50 text-slate-600 border-slate-200"
                            }`}
                          >
                            {titleCase(row.status)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isOwner ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {(row.kind === "SALE" ||
                              row.kind === "PURCHASE" ||
                              row.kind === "PAYMENT_RECEIVED" ||
                              row.kind === "PAYMENT_PAID") && (
                              <button
                                type="button"
                                onClick={() => handleEdit(row)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:border-[#044d73] hover:bg-[#044d73]/5 hover:text-[#044d73] transition-colors"
                                title={`Edit ${badge.label}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span className="hidden lg:inline">Edit</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDeletingRow(row)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-rose-600 shadow-2xs hover:border-rose-300 hover:bg-rose-50 transition-colors"
                              title={`Delete ${badge.label}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="hidden lg:inline">Delete</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">
                            View &amp; Print only
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && pagination.total > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">
              Page {pagination.page} of {Math.max(pagination.totalPages, 1)} · {pagination.total} records
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-20 disabled:pointer-events-none transition-colors touch-manipulation"
                title="Previous Page"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, pagination.totalPages))}
                disabled={page >= pagination.totalPages}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-20 disabled:pointer-events-none transition-colors touch-manipulation"
                title="Next Page"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedRow && (
        <TransactionDetailModal
          key={`${selectedRow.kind}-${selectedRow.id}`}
          row={selectedRow}
          isOwner={isOwner}
          onClose={() => setSelectedRow(null)}
          onEdit={(row) => handleEdit(row)}
          onDelete={(row) => setDeletingRow(row)}
        />
      )}

      {deletingRow && (
        <DeleteConfirmationModal
          row={deletingRow}
          onClose={() => setDeletingRow(null)}
          onDeleted={() => {
            if (selectedRow?.id === deletingRow.id) setSelectedRow(null);
            setRefreshCount((c) => c + 1);
          }}
        />
      )}

      {editingPaymentRow && (
        <EditPaymentModal
          row={editingPaymentRow}
          onClose={() => setEditingPaymentRow(null)}
          onSaved={() => {
            if (selectedRow?.id === editingPaymentRow.id) setSelectedRow(null);
            setRefreshCount((c) => c + 1);
          }}
        />
      )}
    </div>
  );
}

// Matches GET /api/transactions/[kind]/[id] response shape
interface DetailData {
  party: { id: string; name: string; phone: string | null; address: string | null; panVatNumber: string | null } | null;
  paymentType: string | null;
  supplierInvoiceNumber: string | null;
  note: string | null;
  items: {
    productName: string;
    batchNumber: string | null;
    expiryDate: string | null;
    quantity: number;
    rate: number;
    mrp: number | null;
    lineTotal: number;
    vatApplicable: boolean;
    aliasName: string | null;
    hsnCode: string | null;
    manufacturer: string | null;
    unit: string;
  }[];
  payments: {
    id: string;
    amount: number;
    date: string;
    method: string | null;
    referenceNumber: string | null;
    notes: string | null;
  }[];
  totals: {
    subtotal: number;
    discount: number;
    freightCharges: number;
    vatAmount: number;
    vatRefund: number;
    roundOff: number;
    grandTotal: number;
    paid: number;
    due: number;
  } | null;
  fields: { label: string; value: string }[];
}

function InfoCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="block text-[10px] font-medium uppercase text-slate-400">{label}</span>
      <span className="mt-0.5 block wrap-break-word text-sm font-semibold text-slate-800">{children}</span>
    </div>
  );
}

function TotalLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs text-slate-500">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// Same stable "invoice number" the Sales page prints for a sale (derived from its id).
function invoiceNoFromId(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return String(100000 + (Math.abs(hash) % 900000));
}

function buildInvoiceData(row: TransactionRow, d: DetailData): TaxInvoiceData | null {
  const t = d.totals;
  if (!t || (row.kind !== "SALE" && row.kind !== "PURCHASE")) return null;

  let vatableTotal = 0;
  let nonVatableTotal = 0;
  const items: InvoiceItem[] = d.items.map((it, index) => {
    if (it.vatApplicable) vatableTotal += it.lineTotal;
    else nonVatableTotal += it.lineTotal;
    return {
      sn: index + 1,
      itemCode: it.aliasName || `ITM-${String(index + 1).padStart(3, "0")}`,
      hsNo: it.hsnCode || "—",
      name: it.productName,
      company: it.manufacturer || "—",
      quantity: it.quantity,
      unit: it.unit || "Pcs",
      rate: it.rate,
      amount: it.lineTotal,
      batchNumber: it.batchNumber ?? undefined,
      expiryDate: it.expiryDate ?? undefined,
    };
  });

  const taxableAmount = Math.max(0, vatableTotal - t.discount);
  return {
    type: row.kind,
    invoiceNumber:
      row.kind === "PURCHASE" ? d.supplierInvoiceNumber || invoiceNoFromId(row.id) : invoiceNoFromId(row.id),
    date: row.date,
    partyName: d.party?.name ?? (row.kind === "SALE" ? "Walk-in (Cash)" : "Supplier"),
    partyAddress: d.party?.address || undefined,
    partyPan: d.party?.panVatNumber || undefined,
    partyPhone: d.party?.phone || undefined,
    paymentType: d.paymentType ?? "CASH",
    items,
    subtotal: t.subtotal,
    discount: t.discount,
    freightCharges: t.freightCharges,
    vatRefund: t.vatRefund,
    taxableAmount: vatableTotal > 0 ? taxableAmount : 0,
    nonTaxableAmount: nonVatableTotal,
    vatAmount: t.vatAmount,
    roundOff: t.roundOff,
    grandTotal: t.grandTotal,
  };
}

function TransactionDetailModal({
  row,
  isOwner = false,
  onClose,
  onEdit,
  onDelete,
}: {
  row: TransactionRow;
  isOwner?: boolean;
  onClose: () => void;
  onEdit: (row: TransactionRow) => void;
  onDelete: (row: TransactionRow) => void;
}) {
  // null = still loading
  const [result, setResult] = useState<{ detail: DetailData | null } | null>(null);
  const [printData, setPrintData] = useState<TaxInvoiceData | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/api/transactions/${row.kind}/${row.id}`)
      .then((res) => {
        if (!cancelled) setResult({ detail: res.data.detail });
      })
      .catch((err) => {
        console.error("Failed to load transaction detail:", err);
        if (!cancelled) setResult({ detail: null });
      });
    return () => {
      cancelled = true;
    };
  }, [row.kind, row.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !printData) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, printData]);

  const badge = KIND_BADGE[row.kind];
  const detail = result?.detail ?? null;
  const isInvoice = row.kind === "SALE" || row.kind === "PURCHASE";
  const t = detail?.totals;

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 bg-[#044d73] p-5 text-white sm:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-semibold">{row.voucherNo}</h3>
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${badge.className}`}>
                {badge.label}
              </span>
              {row.status && (
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                    STATUS_BADGE[row.status] ?? "bg-slate-50 text-slate-600 border-slate-200"
                  }`}
                >
                  {titleCase(row.status)}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-white/70">
              Date: {formatDate(row.date)} · Party: {row.partyName ?? "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
          {result === null ? (
            <div className="py-12">
              <DotsLoader text="Loading details..." size="md" />
            </div>
          ) : !detail ? (
            <p className="py-12 text-center text-sm text-red-600">Could not load the details. Please try again.</p>
          ) : (
            <>
              {/* Party info */}
              {detail.party && (
                <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200/80 bg-slate-50 p-4 sm:grid-cols-4">
                  <InfoCell label="Party">{detail.party.name}</InfoCell>
                  <InfoCell label="Phone">{detail.party.phone || "—"}</InfoCell>
                  <InfoCell label="Address">{detail.party.address || "—"}</InfoCell>
                  <InfoCell label="PAN / VAT">{detail.party.panVatNumber || "—"}</InfoCell>
                </div>
              )}

              {/* Returns & payments: simple label/value grid */}
              {!isInvoice && detail.fields.length > 0 && (
                <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200/80 bg-slate-50 p-4 sm:grid-cols-3">
                  {detail.fields.map((f) => (
                    <InfoCell key={f.label} label={f.label}>
                      {f.label === "Amount" || f.label === "Return Value" ? formatCurrency(Number(f.value)) : f.value}
                    </InfoCell>
                  ))}
                </div>
              )}

              {/* Invoices: payment summary */}
              {isInvoice && t && (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600">
                    <span>
                      Payment Type:{" "}
                      <strong className="text-slate-800">{titleCase(detail.paymentType ?? "—")}</strong>
                    </span>
                    <span>
                      Total Bill: <strong className="font-mono text-slate-800">{formatCurrency(t.grandTotal)}</strong>
                    </span>
                    <span>
                      Paid: <strong className="font-mono text-emerald-700">{formatCurrency(t.paid)}</strong>
                    </span>
                    <span>
                      Balance Due:{" "}
                      <strong className={`font-mono ${t.due > 0.01 ? "text-amber-800" : "text-emerald-700"}`}>
                        {formatCurrency(t.due)}
                      </strong>
                    </span>
                  </div>

                  {detail.payments.length > 0 && (
                    <div className="border-t border-slate-200/80 pt-2.5">
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Recorded Payments ({detail.payments.length})
                      </p>
                      <div className="space-y-1">
                        {detail.payments.map((p, i) => (
                          <div
                            key={p.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-xs"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-slate-700">#{i + 1}</span>
                              <span className="text-slate-500">{formatDate(p.date)}</span>
                              <span className="rounded bg-slate-100 px-1.5 text-[10px] font-medium text-slate-700">
                                {titleCase(p.method ?? "CASH")}
                              </span>
                              {p.referenceNumber && (
                                <span className="text-[11px] text-slate-400">Ref: {p.referenceNumber}</span>
                              )}
                              {p.notes && <span className="text-[11px] italic text-slate-400">({p.notes})</span>}
                            </div>
                            <span className="font-mono font-bold text-emerald-700">{formatCurrency(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Invoices: items */}
              {isInvoice && (
                <div>
                  <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-[#044d73]">
                    {row.kind === "SALE" ? "Sold Items & Batches" : "Purchased Items & Batches"}
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          <th className="px-3 py-2.5">#</th>
                          <th className="px-3 py-2.5">Item</th>
                          <th className="px-3 py-2.5">Batch</th>
                          <th className="px-3 py-2.5">Expiry</th>
                          <th className="px-3 py-2.5 text-center">Qty</th>
                          <th className="px-3 py-2.5 text-right">Rate</th>
                          {row.kind === "PURCHASE" && <th className="px-3 py-2.5 text-right">MRP</th>}
                          <th className="px-3 py-2.5 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detail.items.map((it, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2.5 text-slate-400">{i + 1}</td>
                            <td className="px-3 py-2.5 font-medium text-slate-800">{it.productName}</td>
                            <td className="px-3 py-2.5 text-slate-700">{it.batchNumber || "—"}</td>
                            <td className="px-3 py-2.5 text-slate-600">{it.expiryDate || "—"}</td>
                            <td className="px-3 py-2.5 text-center font-semibold text-slate-800">{it.quantity}</td>
                            <td className="px-3 py-2.5 text-right text-slate-600">{formatCurrency(it.rate)}</td>
                            {row.kind === "PURCHASE" && (
                              <td className="px-3 py-2.5 text-right text-slate-600">
                                {it.mrp === null ? "—" : formatCurrency(it.mrp)}
                              </td>
                            )}
                            <td className="px-3 py-2.5 text-right font-bold text-slate-800">
                              {formatCurrency(it.lineTotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {isInvoice && detail.note && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Note</span>
                  <p className="whitespace-pre-wrap text-xs text-slate-700">{detail.note}</p>
                </div>
              )}

              {/* Invoices: totals */}
              {isInvoice && t && (
                <div className="ml-auto w-full max-w-xs space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <TotalLine label="Subtotal" value={formatCurrency(t.subtotal)} />
                  {t.discount > 0 && <TotalLine label="Discount" value={`- ${formatCurrency(t.discount)}`} />}
                  {t.freightCharges > 0 && (
                    <TotalLine label="Freight & Forwarding" value={`+ ${formatCurrency(t.freightCharges)}`} />
                  )}
                  {t.vatRefund > 0 && <TotalLine label="VAT Refund" value={`- ${formatCurrency(t.vatRefund)}`} />}
                  {t.roundOff !== 0 && (
                    <TotalLine
                      label={t.roundOff < 0 ? "Rounded Off (−)" : "Rounded Off (+)"}
                      value={`${t.roundOff < 0 ? "-" : "+"} ${formatCurrency(Math.abs(t.roundOff))}`}
                    />
                  )}
                  {t.vatAmount > 0 && <TotalLine label="VAT" value={formatCurrency(t.vatAmount)} />}
                  <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-800">
                    <span>Grand Total</span>
                    <span className="text-[#044d73]">{formatCurrency(t.grandTotal)}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white p-4 px-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            {isInvoice && (
              <button
                type="button"
                disabled={!detail}
                onClick={() => detail && setPrintData(buildInvoiceData(row, detail))}
                className="flex items-center gap-1.5 rounded-lg bg-[#044d73] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#033b59] disabled:opacity-40"
              >
                <Printer className="h-3.5 w-3.5" /> Print / Download Tax Invoice
              </button>
            )}
            {row.partyId && (
              <Link
                href={`/pharma/parties/${row.partyId}/ledger`}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                View Party Ledger
              </Link>
            )}
            {isOwner && (row.kind === "SALE" ||
              row.kind === "PURCHASE" ||
              row.kind === "PAYMENT_RECEIVED" ||
              row.kind === "PAYMENT_PAID") && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(row);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#044d73] transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            )}
            {isOwner && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(row);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>

    {/* Sibling, not a child: portal clicks would bubble up to the overlay above and close it. */}
    {printData && <TaxInvoiceModal data={printData} onClose={() => setPrintData(null)} />}
    </>
  );
}

function DeleteConfirmationModal({
  row,
  onClose,
  onDeleted,
}: {
  row: TransactionRow;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const badge = KIND_BADGE[row.kind];

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/api/transactions/${row.kind}/${row.id}`);
      onDeleted();
      onClose();
    } catch (err: any) {
      console.error("Failed to delete transaction:", err);
      setError(err?.response?.data?.error || err.message || "Failed to delete transaction");
    } finally {
      setLoading(false);
    }
  };

  const getWarning = () => {
    switch (row.kind) {
      case "SALE":
        return "Deleting this sale will permanently remove the invoice and return all sold item quantities back to their respective batches and product inventory.";
      case "PURCHASE":
        return "Deleting this purchase will permanently remove the bill and deduct the received stock from inventory. If any item has already been sold or moved, deletion will be blocked.";
      case "PAYMENT_RECEIVED":
        return "Deleting this payment receipt will remove the payment from the party ledger and recalculate the customer invoice payment status.";
      case "PAYMENT_PAID":
        return "Deleting this payment voucher will remove the payment from the party ledger and recalculate the supplier bill payment status.";
      case "SALE_RETURN":
        return "Deleting this sale return will remove the return record and reverse any stock adjustments made.";
      case "PURCHASE_RETURN":
        return "Deleting this purchase return will remove the return record and restore available stock.";
      default:
        return "Are you sure you want to delete this transaction? This action cannot be undone.";
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 text-rose-600 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 border border-rose-100">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Delete Transaction</h3>
            <p className="text-xs text-slate-500">This action cannot be undone.</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 mb-4 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">Transaction:</span>
            <span className="font-semibold text-slate-800">{row.voucherNo}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Type:</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.className}`}>
              {badge.label}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Party:</span>
            <span className="font-semibold text-slate-800">{row.partyName ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Date:</span>
            <span className="text-slate-700">{formatDate(row.date)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200/80 pt-1.5 font-bold">
            <span className="text-slate-700">Amount:</span>
            <span className="text-[#044d73]">{formatCurrency(row.amount)}</span>
          </div>
        </div>

        <p className="text-xs mb-4 leading-relaxed bg-amber-50/80 border border-amber-200/60 rounded-lg p-3 text-amber-900">
          {getWarning()}
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 transition-colors disabled:opacity-50"
          >
            {loading ? <DotsLoader size="sm" /> : <Trash2 className="h-3.5 w-3.5" />}
            {loading ? "Deleting..." : "Delete Permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditPaymentModal({
  row,
  onClose,
  onSaved,
}: {
  row: TransactionRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(String(row.amount || ""));
  const [date, setDate] = useState(row.date);
  const [method, setMethod] = useState(row.method || "CASH");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState(row.details || "");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isReceived = row.kind === "PAYMENT_RECEIVED";

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/api/transactions/${row.kind}/${row.id}`)
      .then((res) => {
        if (!cancelled && res.data?.detail) {
          const d = res.data.detail;
          const refField = d.fields?.find((f: any) => f.label === "Reference No.");
          if (refField && refField.value !== "—") {
            setReferenceNumber(refField.value);
          }
          const notesField = d.fields?.find((f: any) => f.label === "Notes");
          if (notesField && notesField.value !== "—") {
            setNotes(notesField.value);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load payment detail for edit:", err);
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [row.kind, row.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = parseFloat(amount);
    if (isNaN(numAmt) || numAmt <= 0) {
      setError("Please enter a valid amount greater than 0");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.patch(`/api/transactions/${row.kind}/${row.id}`, {
        amount: numAmt,
        paymentDate: date,
        method,
        referenceNumber: referenceNumber.trim() || null,
        notes: notes.trim() || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      console.error("Failed to update payment:", err);
      setError(err?.response?.data?.error || err.message || "Failed to update payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-[#044d73] px-6 py-4 text-white">
          <div>
            <h3 className="text-base font-bold">
              {isReceived ? "Edit Customer Payment Receipt" : "Edit Supplier Payment Voucher"}
            </h3>
            <p className="text-xs text-white/80">
              {row.voucherNo} {row.partyName ? `· ${row.partyName}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {fetching ? (
            <div className="py-8">
              <DotsLoader text="Loading payment details..." size="md" />
            </div>
          ) : (
            <>
              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount (NPR) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 font-mono outline-none focus:border-[#044d73] focus:ring-2 focus:ring-[#044d73]/10"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#044d73]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#044d73]"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="ESEWA">eSewa</option>
                    <option value="KHALTI">Khalti</option>
                    <option value="CARD">Card</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reference / Cheque No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. CHQ-98124, TXN-10293..."
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#044d73]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Optional details or remarks..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#044d73] resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#044d73] px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#033b59] transition-colors disabled:opacity-50"
                >
                  {loading ? <DotsLoader size="sm" /> : <Check className="h-3.5 w-3.5" />}
                  {loading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 border-l-4 ${accent} bg-white p-4 shadow-sm sm:p-5`}>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-800 sm:text-2xl">
        <AnimatedStatValue value={value} format={formatCurrency} />
      </p>
    </div>
  );
}
