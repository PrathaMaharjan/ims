"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Printer, Search, X } from "lucide-react";
import { api } from "@/lib/api-client";
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

const TYPE_TABS: { value: TypeFilter; label: string }[] = [
  { value: "ALL", label: "All" },
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

  // Loading is derived: data counts as loaded once it was fetched for the current filters.
  const requestKey = JSON.stringify({ page, type, search, partyId, startDate, endDate });
  const [selectedRow, setSelectedRow] = useState<TransactionRow | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const loading = loadedKey !== requestKey && errorKey !== requestKey;
  const error = errorKey === requestKey ? "Failed to load transactions. Please try again." : "";

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

  const hasFilters = Boolean(searchInput || partyId || startDate || endDate);

  function clearFilters() {
    setSearchInput("");
    setSearch("");
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
        <p className="mt-1 text-xs sm:text-sm text-white/70">
          Sales, purchases, returns and payments in one place
        </p>
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
        <div className="flex flex-wrap gap-2">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setType(tab.value);
                setPage(1);
              }}
              className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-colors ${
                type === tab.value
                  ? "bg-[#044d73] text-white shadow-sm"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
                      <td className="py-3 px-4 max-w-[260px] truncate text-slate-500" title={detail}>
                        {detail}
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
          onClose={() => setSelectedRow(null)}
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
      <span className="mt-0.5 block break-words text-sm font-semibold text-slate-800">{children}</span>
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

function TransactionDetailModal({ row, onClose }: { row: TransactionRow; onClose: () => void }) {
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
