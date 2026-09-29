"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Layers,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Boxes,
  X,
  Building2,
  Package,
  Eye,
  FileText,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { AnimatedStatValue } from "../_components/ui/animated-stat-value";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ExpiryStatus = "EXPIRED" | "NEAR_EXPIRY" | "ACTIVE";

export interface BatchItem {
  batchId: string;
  batchNumber: string;
  productId: string;
  productName: string;
  unit: string;
  partyName: string | null;
  expiryDate: string; // e.g. "2026-10-12"
  daysLeft: number;
  quantityAvailable: number;
  purchasePrice: number;
  valueAtRisk: number;
  status: ExpiryStatus;
  note?: string | null;
}

// One row of GET /api/batches/[productId] — used both for the note/details
// block and for the replacement-batch dropdown when a return is completed.
export interface ProductBatch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  quantityAvailable: number;
  note?: string | null;
  manufacturingDate?: string | null;
  mrp?: string | number | null;
  salePrice?: string | number | null;
  quantityReceived?: number;
}

export interface ExpirySummary {
  expired: { count: number; value: number };
  nearExpiry: { count: number; value: number };
  withinDays: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PurchaseReturn {
  id: string;
  batchId: string;
  productId: string;
  quantity: number;
  reason: string | null;
  status: "PENDING" | "COMPLETED";
  returnDate: string;
  batchNumber: string;
  productName: string;
  partyName: string | null;
  resolutionType: "MONEY" | "QUANTITY" | null;
  resolutionAmount: string | null;
}

interface WriteOff {
  id: string;
  batchId: string;
  quantity: number;
  totalLoss: string;
  createdAt: string;
}

type StatusFilterOption = "all" | "expired" | "near" | "ok";
type ActionPanel = "none" | "return" | "writeoff";

const PAGE_LIMIT = 10;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const rs = (amount: number) =>
  `Rs. ${Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// Pulls a readable message out of an axios error (string or zod-flatten object)
function errMsg(err: unknown): string {
  const data = (err as { response?: { data?: { error?: unknown } } })?.response?.data;
  const e = data?.error;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") return "Please check the values you entered.";
  return "Something went wrong. Please try again.";
}

const STATUS_STYLE: Record<
  ExpiryStatus,
  { bg: string; text: string; dot: string; label: string }
> = {
  ACTIVE: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    label: "Active",
  },
  NEAR_EXPIRY: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
    label: "Near Expiry",
  },
  EXPIRED: {
    bg: "bg-red-50",
    text: "text-red-600",
    dot: "bg-red-500",
    label: "Expired",
  },
};

function formatExpiryCountdown(
  daysLeft: number,
  status: ExpiryStatus,
): {
  text: string;
  badgeStyle: string;
} {
  if (status === "EXPIRED" || daysLeft < 0) {
    const daysAgo = Math.abs(daysLeft);
    return {
      text: daysAgo === 0 ? "Expired today" : `Expired ${daysAgo}d ago`,
      badgeStyle: "bg-red-50 text-red-700 border-red-200",
    };
  }

  if (daysLeft === 0) {
    return {
      text: "Expires today",
      badgeStyle: "bg-amber-100 text-amber-800 border-amber-300 font-semibold",
    };
  }

  if (status === "NEAR_EXPIRY" || daysLeft <= 30) {
    return {
      text: `Expires in ${daysLeft}d`,
      badgeStyle: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }

  return {
    text: `${daysLeft} days remaining`,
    badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
}

// "YYYY-MM-DD" for tomorrow in local time — earliest valid replacement expiry
function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const selectCls =
  "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 focus:border-[#044d73] focus:outline-none";

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#044d73] focus:outline-none";

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function BatchesPage() {
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [summary, setSummary] = useState<ExpirySummary | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    totalPages: 1,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>("all");
  const [withinDays, setWithinDays] = useState<number>(90);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedBatch, setSelectedBatch] = useState<BatchItem | null>(null);

  // All batches of a product, keyed by productId. Fetched from
  // GET /api/batches/[productId] when the modal opens — gives us both the
  // batch note/details and the list of batches a replacement can go into.
  const [productBatches, setProductBatches] = useState<Record<string, ProductBatch[]>>({});
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  // Purchase returns (all statuses) and write-offs, for the status column
  const [allReturns, setAllReturns] = useState<PurchaseReturn[]>([]);
  const [writeOffs, setWriteOffs] = useState<WriteOff[]>([]);

  // Modal action state
  const [panel, setPanel] = useState<ActionPanel>("none");
  const [returnQty, setReturnQty] = useState("");
  const [returnReason, setReturnReason] = useState("");

  const [completingId, setCompletingId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<"MONEY" | "QUANTITY">("MONEY");
  const [amount, setAmount] = useState("");
  // Expiry date of the replacement stock the supplier sent back
  const [newExpiry, setNewExpiry] = useState("");

  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  // Fetch batches using existing backend endpoint GET /api/batches
  const fetchBatches = useCallback(
    async (
      pageToFetch: number = 1,
      currentFilter = statusFilter,
      days = withinDays,
    ) => {
      setLoading(true);
      try {
        const res = await api.get("/api/batches", {
          params: {
            status: currentFilter,
            withinDays: days,
            page: pageToFetch,
            limit: PAGE_LIMIT,
          },
        });

        if (res.data) {
          const rows: BatchItem[] = res.data.batches || [];
          setBatches(rows);
          // Keep an open modal in sync with the reloaded row (fresh stock
          // after a return / completion), so the modal can stay open.
          setSelectedBatch((prev) =>
            prev ? (rows.find((b) => b.batchId === prev.batchId) ?? prev) : prev,
          );
          if (res.data.summary) {
            setSummary(res.data.summary);
          }
          if (res.data.pagination) {
            setPagination(res.data.pagination);
          }
        }
      } catch (err) {
        console.error("Failed to load batches:", err);
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, withinDays],
  );

  const [staticStats, setStaticStats] = useState({
    total: 0,
    active: 0,
    nearExpiry: 0,
    expired: 0,
  });

  const loadStaticStats = useCallback(async (days = withinDays) => {
    try {
      const res = await api.get("/api/batches", {
        params: { status: "all", withinDays: days, page: 1, limit: 1 },
      });
      if (res.data) {
        const total = res.data.pagination?.total ?? 0;
        const expired = res.data.summary?.expired.count ?? 0;
        const nearExpiry = res.data.summary?.nearExpiry.count ?? 0;
        const active = Math.max(0, total - expired - nearExpiry);
        setStaticStats({ total, active, nearExpiry, expired });
      }
    } catch (err) {
      console.error("Failed to load batch stats:", err);
    }
  }, []);

  // GET /api/purchase-returns (all statuses) and GET /api/write-offs
  const loadReturnsAndWriteOffs = useCallback(async () => {
    const [ret, wo] = await Promise.allSettled([
      api.get("/api/purchases/returns", { params: { limit: 100 } }),
      api.get("/api/purchases/writeoff"),
    ]);
    if (ret.status === "fulfilled") setAllReturns(ret.value.data?.items ?? []);
    else console.error("Failed to load returns:", ret.reason);
    if (wo.status === "fulfilled") setWriteOffs(wo.value.data?.writeOffs ?? []);
    else console.error("Failed to load write-offs:", wo.reason);
  }, []);

  // Quick lookups for the table column
  const writtenOffIds = useMemo(
    () => new Set(writeOffs.map((w) => w.batchId)),
    [writeOffs],
  );
  const returnsByBatch = useMemo(() => {
    const map: Record<string, PurchaseReturn[]> = {};
    for (const r of allReturns) {
      (map[r.batchId] ||= []).push(r);
    }
    return map;
  }, [allReturns]);

  // After any action: reload the table, returns/write-offs, and drop the
  // cached product batches so quantities in the modal are fresh.
  const refreshAll = useCallback(() => {
    fetchBatches(pagination.page);
    loadStaticStats(withinDays);
    loadReturnsAndWriteOffs();
    setProductBatches({});
  }, [fetchBatches, loadStaticStats, loadReturnsAndWriteOffs, pagination.page, withinDays]);

  function closeModal() {
    setSelectedBatch(null);
    setPanel("none");
    setCompletingId(null);
    setActionError("");
  }

  // POST /api/purchase-returns
  async function submitReturn() {
    if (!selectedBatch) return;
    setSaving(true);
    setActionError("");
    try {
      await api.post("/api/purchases/returns", {
        batchId: selectedBatch.batchId,
        quantity: Number(returnQty),
        reason: returnReason.trim() || undefined,
      });
      setReturnQty("");
      setReturnReason("");
      setPanel("none");
      // Stay on the modal so the new "Pending" return shows up right here
      refreshAll();
    } catch (err) {
      setActionError(errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  // POST /api/write-offs — writes off the whole remaining stock of the batch
  async function submitWriteOff() {
    if (!selectedBatch) return;
    setSaving(true);
    setActionError("");
    try {
      await api.post("/api/purchases/writeoff", { batchId: selectedBatch.batchId });
      setPanel("none");
      // Stay on the modal so the "Written off" state shows right here
      refreshAll();
    } catch (err) {
      setActionError(errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  // PATCH /api/purchase-returns/:id — done by hand once the supplier settles
  async function submitComplete() {
    if (!completingId) return;
    setSaving(true);
    setActionError("");
    try {
      // Empty amount → refund at cost (returned qty × purchase price);
      // the API requires a positive amount.
      const ret = allReturns.find((r) => r.id === completingId);
      if (!ret) return;
      const defaultAmount = ret.quantity * (selectedBatch?.purchasePrice ?? 0);
      // Replacement stock always goes back into the same batch it was
      // returned from, with the new expiry date from the supplier.
      const body =
        resolution === "MONEY"
          ? { resolutionType: "MONEY", resolutionAmount: amount ? Number(amount) : defaultAmount }
          : { resolutionType: "QUANTITY", resolvedBatchId: ret.batchId, expiryDate: newExpiry };
      await api.patch(`/api/purchases/returns/${completingId}`, body);
      setCompletingId(null);
      setAmount("");
      setNewExpiry("");
      // Stay on the modal so the return flips to "Completed" right here
      refreshAll();
    } catch (err) {
      setActionError(errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadStaticStats(withinDays);
  }, [withinDays, loadStaticStats]);

  useEffect(() => {
    fetchBatches(1, statusFilter, withinDays);
  }, [statusFilter, withinDays, fetchBatches]);

  useEffect(() => {
    loadReturnsAndWriteOffs();
  }, [loadReturnsAndWriteOffs]);

  // When a batch is selected, pull every batch of that product once
  useEffect(() => {
    if (!selectedBatch) return;
    const productId = selectedBatch.productId;
    if (productBatches[productId]) return;

    let isMounted = true;
    setLoadingDetails(true);

    api
      .get(`/api/batches/${productId}`)
      .then((res) => {
        if (!isMounted) return;
        setProductBatches((prev) => ({ ...prev, [productId]: res.data?.batches ?? [] }));
      })
      .catch((err) => {
        console.error("Failed to fetch batch note/details:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingDetails(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedBatch, productBatches]);

  // Client-side text filter for batch number, product name, or supplier
  const filteredBatches = useMemo(() => {
    if (!searchQuery.trim()) return batches;
    const q = searchQuery.toLowerCase().trim();
    return batches.filter(
      (b) =>
        b.batchNumber?.toLowerCase().includes(q) ||
        b.productName?.toLowerCase().includes(q) ||
        b.partyName?.toLowerCase().includes(q),
    );
  }, [batches, searchQuery]);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="rounded-xl bg-[#044d73] px-6 py-5 text-white shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Batch Tracking & Expiry
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshAll}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            href="/pharma/inventory"
            className="flex items-center gap-2 bg-white text-[#044d73] hover:bg-slate-50 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            <Boxes className="h-4 w-4" strokeWidth={2.5} />
            Inventory View
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Batches",
            value: staticStats.total,
            border: "border-l-slate-400",
            iconBg: "bg-slate-50 text-slate-600",
            icon: <Layers className="h-5 w-5 sm:h-6 sm:w-6" />,
          },
          {
            label: "Active Batches",
            value: staticStats.active,
            border: "border-l-emerald-500",
            iconBg: "bg-emerald-50 text-emerald-600",
            icon: <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" />,
          },
          {
            label: `Near Expiry (≤${withinDays}d)`,
            value: staticStats.nearExpiry,
            border: "border-l-amber-500",
            iconBg: "bg-amber-50 text-amber-600",
            icon: <Clock className="h-5 w-5 sm:h-6 sm:w-6" />,
          },
          {
            label: "Expired Batches",
            value: staticStats.expired,
            border: "border-l-red-500",
            iconBg: "bg-red-50 text-red-500",
            icon: <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6" />,
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
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-wrap">
        <div className="relative flex-1 min-w-0 sm:min-w-[200px] w-full sm:max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by batch, product, supplier"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-8 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Expiry Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as StatusFilterOption)
          }
          className={selectCls}
          title="Filter by status"
        >
          <option value="all">All Statuses</option>
          <option value="expired">Expired</option>
          <option value="near">Near Expiry</option>
          <option value="ok">Active / Safe</option>
        </select>

        {/* Near Expiry Window selector */}
        <select
          value={withinDays}
          onChange={(e) => setWithinDays(Number(e.target.value))}
          className={selectCls}
          title="Near expiry window"
        >
          <option value={15}>Near expiry: 15 days</option>
          <option value={30}>Near expiry: 30 days</option>
          <option value={60}>Near expiry: 60 days</option>
          <option value={90}>Near expiry: 90 days</option>
          <option value={180}>Near expiry: 180 days</option>
          <option value={365}>Near expiry: 365 days</option>
        </select>

        {/* Active status indicator & reset */}
        {statusFilter !== "all" && (
          <button
            onClick={() => setStatusFilter("all")}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition-colors shrink-0"
          >
            <span>Filtering: <strong className="capitalize">{statusFilter === "near" ? "Near Expiry" : statusFilter === "ok" ? "Active" : statusFilter}</strong></span>
            <X className="w-3.5 h-3.5 text-slate-500" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">Batch & Product</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4">Countdown</th>
                <th className="py-3 px-4">Available Qty</th>
                <th className="py-3 px-4">Purchase Price</th>
                <th className="py-3 px-4">Value at Risk</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Return / Write-off</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={10}
                    className="py-16 text-center text-sm text-slate-400"
                  >
                    Loading batches...
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="py-16 text-center text-sm text-slate-400"
                  >
                    {searchQuery
                      ? `No batch matching "${searchQuery}".`
                      : "No batches match criteria."}
                  </td>
                </tr>
              ) : (
                filteredBatches.map((b) => {
                  const countdown = formatExpiryCountdown(b.daysLeft, b.status);
                  const st = STATUS_STYLE[b.status];

                  const isWrittenOff = writtenOffIds.has(b.batchId);
                  const batchReturns = returnsByBatch[b.batchId] ?? [];
                  const pendingCount = batchReturns.filter((r) => r.status === "PENDING").length;
                  const completed = batchReturns.filter((r) => r.status === "COMPLETED");

                  return (
                    <tr
                      key={b.batchId}
                      onClick={() => setSelectedBatch(b)}
                      className="hover:bg-slate-50/80 transition-colors text-slate-700 cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 group-hover:text-[#044d73] transition-colors">
                            {b.productName}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#044d73] bg-[#044d73]/10 px-1.5 py-0.2 rounded border border-[#044d73]/20">
                              <Boxes className="w-3 h-3" /> {b.batchNumber}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {b.unit}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {b.partyName ? (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[140px]">
                              {b.partyName}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {b.expiryDate}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${countdown.badgeStyle}`}
                        >
                          {countdown.text}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800">
                          {b.quantityAvailable}{" "}
                          <span className="text-xs font-normal text-slate-400">
                            {b.unit}
                          </span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {rs(b.purchasePrice)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={
                            b.status === "EXPIRED"
                              ? "text-red-600 font-semibold"
                              : b.status === "NEAR_EXPIRY"
                                ? "text-amber-700 font-semibold"
                                : "text-slate-800 font-medium"
                          }
                        >
                          {rs(b.valueAtRisk)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${st.bg} ${st.text}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${st.dot}`}
                          />
                          {st.label}
                        </span>
                      </td>

                      {/* Return / write-off status */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          {isWrittenOff && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white">
                              <Trash2 className="w-3 h-3" />
                              Written Off
                            </span>
                          )}
                          {pendingCount > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Return Pending{pendingCount > 1 ? ` (${pendingCount})` : ""}
                            </span>
                          )}
                          {completed.map((r) => (
                            <span
                              key={r.id}
                              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              {r.resolutionType === "MONEY"
                                ? `Money Returned · ${rs(Number(r.resolutionAmount ?? 0))}`
                                : "Stock Replaced"}
                            </span>
                          ))}
                          {!isWrittenOff && batchReturns.length === 0 && (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBatch(b);
                            }}
                            title="Open actions"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#044d73] hover:bg-[#044d73]/10 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
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

        {pagination.total > 0 && (
          <div className="flex flex-col gap-4 items-center justify-between border-t border-slate-100 bg-white px-6 py-4 sm:flex-row">
            <span className="text-xs text-slate-400">
              Showing{" "}
              {Math.min(
                (pagination.page - 1) * pagination.limit + 1,
                pagination.total,
              )}
              –{Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
              of {pagination.total} batch{pagination.total !== 1 ? "es" : ""}
            </span>

            <div className="flex items-center justify-between w-full sm:w-auto gap-6">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Page {pagination.page} of {pagination.totalPages || 1}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchBatches(pagination.page - 1)}
                  disabled={pagination.page <= 1 || loading}
                  className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-20 disabled:pointer-events-none transition-colors touch-manipulation"
                  title="Previous Page"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => fetchBatches(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages || loading}
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

      {/* Batch Action Modal — details, note, returns and write-off */}
      {selectedBatch &&
        (() => {
          const st = STATUS_STYLE[selectedBatch.status];
          const siblings = productBatches[selectedBatch.productId] ?? [];
          const extra = siblings.find(
            (x) => x.id === selectedBatch.batchId || x.batchNumber === selectedBatch.batchNumber,
          );
          const batchReturns = returnsByBatch[selectedBatch.batchId] ?? [];
          const batchWriteOff = writeOffs.find((w) => w.batchId === selectedBatch.batchId);

          return (
            <div
              className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={closeModal}
            >
              <div
                className="bg-white border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="relative flex shrink-0 items-center justify-between p-6 bg-[#044d73] text-white">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                      <Package className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xl font-semibold">
                          {selectedBatch.productName}
                        </h3>
                        <span className="rounded-md bg-white/20 px-2 py-0.5 text-xs font-bold text-white border border-white/25">
                          #{selectedBatch.batchNumber}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.bg} ${st.text}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${st.dot}`}
                          />
                          {st.label}
                        </span>
                      </div>
                      <p className="text-xs text-white/70 mt-0.5">
                        Expiry: {selectedBatch.expiryDate} · Unit:{" "}
                        {selectedBatch.unit}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Metrics grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Stock Available
                      </span>
                      <span className="text-xl font-bold text-slate-800 mt-1 block">
                        {selectedBatch.quantityAvailable}{" "}
                        <span className="text-xs font-normal text-slate-500">
                          {selectedBatch.unit}
                        </span>
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Purchase Cost
                      </span>
                      <span className="text-xl font-bold text-slate-800 mt-1 block">
                        {rs(selectedBatch.purchasePrice)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Value at Risk
                      </span>
                      <span className="text-xl font-bold text-red-600 mt-1 block">
                        {rs(selectedBatch.valueAtRisk)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Days Calculation
                      </span>
                      <span
                        className={`text-sm font-semibold mt-2 block ${selectedBatch.daysLeft < 0
                          ? "text-red-600"
                          : selectedBatch.daysLeft <= 30
                            ? "text-amber-600"
                            : "text-emerald-600"
                          }`}
                      >
                        {selectedBatch.daysLeft < 0
                          ? `${Math.abs(selectedBatch.daysLeft)} days overdue`
                          : `${selectedBatch.daysLeft} days remaining`}
                      </span>
                    </div>
                  </div>

                  {/* Already written off */}
                  {batchWriteOff && (
                    <div className="flex items-start gap-2.5 rounded-xl bg-slate-100 p-3.5 text-slate-700 border border-slate-300">
                      <Trash2 className="h-4 w-4 mt-0.5 shrink-0 text-slate-600" />
                      <div className="text-xs">
                        <strong className="font-semibold block text-sm">
                          Written off
                        </strong>
                        {batchWriteOff.quantity} {selectedBatch.unit} removed ·
                        loss {rs(Number(batchWriteOff.totalLoss))}
                      </div>
                    </div>
                  )}

                  {/* -------------------------------------------------- */}
                  {/* Purchase returns on this batch                      */}
                  {/* -------------------------------------------------- */}
                  {batchReturns.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="w-4 h-4 text-[#044d73]" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Returns on this batch
                        </span>
                      </div>

                      {batchReturns.map((r) => (
                        <div
                          key={r.id}
                          className={`rounded-lg border p-3 space-y-3 ${
                            r.status === "PENDING"
                              ? "border-amber-200 bg-amber-50/50"
                              : "border-emerald-200 bg-emerald-50/40"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="text-xs text-slate-600">
                              <span className="font-bold text-slate-800">
                                {r.quantity} {selectedBatch.unit}
                              </span>{" "}
                              sent back on {r.returnDate}
                              {r.reason ? ` · ${r.reason}` : ""}
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Supplier: {r.partyName ?? "—"}
                                {r.status === "COMPLETED" &&
                                  ` · ${
                                    r.resolutionType === "MONEY"
                                      ? `money returned ${rs(Number(r.resolutionAmount ?? 0))}`
                                      : "stock replaced"
                                  }`}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {r.status === "PENDING" ? (
                                <>
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    Pending
                                  </span>
                                  {completingId !== r.id && (
                                    <button
                                      onClick={() => {
                                        setPanel("none");
                                        setCompletingId(r.id);
                                        setResolution("MONEY");
                                        setAmount("");
                                        setNewExpiry("");
                                        setActionError("");
                                      }}
                                      className="rounded-lg bg-[#044d73] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#033a57]"
                                    >
                                      Mark Completed
                                    </button>
                                  )}
                                </>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {r.resolutionType === "MONEY" ? "Money Returned" : "Stock Replaced"}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Manual completion — ask what the supplier gave back */}
                          {completingId === r.id && (
                            <div className="space-y-3 border-t border-amber-100 pt-3">
                              <p className="text-xs font-medium text-slate-600">
                                What did the supplier give back?
                              </p>
                              <div className="flex gap-2">
                                {(["MONEY", "QUANTITY"] as const).map((t) => (
                                  <button
                                    key={t}
                                    onClick={() => setResolution(t)}
                                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium ${
                                      resolution === t
                                        ? "border-[#044d73] bg-[#044d73]/10 text-[#044d73]"
                                        : "border-slate-200 bg-white text-slate-600"
                                    }`}
                                  >
                                    {t === "MONEY" ? "Money" : "Replacement stock"}
                                  </button>
                                ))}
                              </div>

                              {resolution === "MONEY" ? (
                                <div>
                                  <label className="text-xs font-medium text-slate-500">
                                    Amount (leave empty to use quantity × purchase price)
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className={inputCls}
                                  />
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <p className="text-xs text-slate-600">
                                    <strong>
                                      {r.quantity} {selectedBatch.unit}
                                    </strong>{" "}
                                    will be added back to batch{" "}
                                    <strong>#{selectedBatch.batchNumber}</strong>.
                                  </p>
                                  <div>
                                    <label className="text-xs font-medium text-slate-500">
                                      New expiry date of the replacement stock
                                    </label>
                                    <input
                                      type="date"
                                      min={tomorrow()}
                                      value={newExpiry}
                                      onChange={(e) => setNewExpiry(e.target.value)}
                                      className={inputCls}
                                    />
                                  </div>
                                </div>
                              )}

                              {actionError && (
                                <p className="text-xs text-red-600">{actionError}</p>
                              )}

                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setCompletingId(null);
                                    setActionError("");
                                  }}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={submitComplete}
                                  disabled={
                                    saving ||
                                    (resolution === "QUANTITY" &&
                                      (!newExpiry || newExpiry < tomorrow()))
                                  }
                                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                                >
                                  {saving ? "Saving..." : "Complete return"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* -------------------------------------------------- */}
                  {/* Return form                                         */}
                  {/* -------------------------------------------------- */}
                  {panel === "return" && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Return to supplier
                      </span>
                      <p className="text-xs text-slate-500">
                        The stock leaves the shelf now and the return stays{" "}
                        <strong>Pending</strong> until you mark it completed by hand.
                      </p>
                      <div>
                        <label className="text-xs font-medium text-slate-500">
                          Quantity (max {selectedBatch.quantityAvailable})
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={selectedBatch.quantityAvailable}
                          value={returnQty}
                          onChange={(e) => setReturnQty(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-500">
                          Reason (optional)
                        </label>
                        <input
                          value={returnReason}
                          onChange={(e) => setReturnReason(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      {actionError && <p className="text-xs text-red-600">{actionError}</p>}
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setPanel("none");
                            setActionError("");
                          }}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={submitReturn}
                          disabled={
                            saving ||
                            !Number(returnQty) ||
                            Number(returnQty) > selectedBatch.quantityAvailable
                          }
                          className="rounded-lg bg-[#044d73] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                        >
                          {saving ? "Saving..." : "Create return"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* -------------------------------------------------- */}
                  {/* Write-off confirm                                   */}
                  {/* -------------------------------------------------- */}
                  {panel === "writeoff" && (
                    <div className="rounded-xl border border-red-200 bg-red-50/60 p-4 space-y-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-red-800">
                        Write off expired stock
                      </span>
                      <p className="text-xs text-red-900">
                        All{" "}
                        <strong>
                          {selectedBatch.quantityAvailable} {selectedBatch.unit}
                        </strong>{" "}
                        left on this batch will be removed from stock and booked as a loss of{" "}
                        <strong>{rs(selectedBatch.valueAtRisk)}</strong>. This cannot be undone.
                      </p>
                      {actionError && <p className="text-xs text-red-600">{actionError}</p>}
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setPanel("none");
                            setActionError("");
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={submitWriteOff}
                          disabled={saving}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                        >
                          {saving ? "Writing off..." : "Write off everything"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Batch Note Section */}
                  {(() => {
                    const batchNote = selectedBatch.note ?? extra?.note;
                    return (
                      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#044d73]" />
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                              Batch Note (Recorded during Purchase)
                            </span>
                          </div>
                          {!batchNote && loadingDetails && (
                            <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                              <RefreshCw className="w-3 h-3 animate-spin text-[#044d73]" />
                              Fetching note...
                            </span>
                          )}
                        </div>

                        {batchNote ? (
                          <div className="rounded-lg bg-amber-50/70 border border-amber-200/80 p-3.5 text-xs text-amber-900 whitespace-pre-wrap leading-relaxed font-sans shadow-xs">
                            {batchNote}
                          </div>
                        ) : !loadingDetails ? (
                          <p className="text-xs text-slate-400 italic bg-slate-50 rounded-lg p-3 border border-slate-100">
                            No note was recorded for this batch during purchase.
                          </p>
                        ) : null}
                      </div>
                    );
                  })()}

                  {/* Batch metadata */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Supplier</span>
                      <span className="font-semibold text-slate-800">
                        {selectedBatch.partyName ||
                          "Not linked to a supplier"}
                      </span>
                    </div>
                    {extra?.manufacturingDate && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Manufacturing Date</span>
                        <span className="font-semibold text-slate-800">
                          {extra.manufacturingDate}
                        </span>
                      </div>
                    )}
                    {extra?.mrp && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">MRP</span>
                        <span className="font-semibold text-slate-800">
                          {rs(Number(extra.mrp))}
                        </span>
                      </div>
                    )}
                    {extra?.salePrice && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Sale Price</span>
                        <span className="font-semibold text-slate-800">
                          {rs(Number(extra.salePrice))}
                        </span>
                      </div>
                    )}
                    {extra?.quantityReceived != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Initial Quantity Received</span>
                        <span className="font-semibold text-slate-800">
                          {extra.quantityReceived} {selectedBatch.unit}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Batch UUID</span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {selectedBatch.batchId}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Product UUID</span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {selectedBatch.productId}
                      </span>
                    </div>
                  </div>

                  {selectedBatch.status === "EXPIRED" && (
                    <div className="flex items-start gap-2.5 rounded-xl bg-red-50 p-3.5 text-red-800 border border-red-200">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-red-600" />
                      <div>
                        <strong className="font-semibold block text-sm">
                          Batch is Expired
                        </strong>
                      </div>
                    </div>
                  )}

                  {selectedBatch.status === "NEAR_EXPIRY" && (
                    <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 p-3.5 text-amber-800 border border-amber-200">
                      <Clock className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                      <div>
                        <strong className="font-semibold block text-sm">
                          Expiring Soon
                        </strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer actions */}
                <div className="shrink-0 flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
                  {selectedBatch.quantityAvailable > 0 && (
                    <button
                      onClick={() => {
                        setActionError("");
                        setCompletingId(null);
                        setReturnQty(String(selectedBatch.quantityAvailable));
                        setPanel(panel === "return" ? "none" : "return");
                      }}
                      className="flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Return to Supplier
                    </button>
                  )}

                  {selectedBatch.status === "EXPIRED" &&
                    selectedBatch.quantityAvailable > 0 && (
                      <button
                        onClick={() => {
                          setActionError("");
                          setCompletingId(null);
                          setPanel(panel === "writeoff" ? "none" : "writeoff");
                        }}
                        className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                        Write Off
                      </button>
                    )}

                  <button
                    onClick={closeModal}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}