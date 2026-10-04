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
  DollarSign,
  ArrowDownLeft,
  Pencil,
  Check,
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
type ActionFilterOption = "all" | "action_needed" | "pending_return" | "completed_return" | "written_off";
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
  "rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#044d73] focus:ring-1 focus:ring-[#044d73] focus:outline-none";

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#044d73] focus:ring-1 focus:ring-[#044d73] focus:outline-none transition-colors";

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
  const [actionFilter, setActionFilter] = useState<ActionFilterOption>("all");
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
  const [writeOffReason, setWriteOffReason] = useState("");

  const [completingId, setCompletingId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<"MONEY" | "QUANTITY">("MONEY");
  const [amount, setAmount] = useState("");
  // Expiry date of the replacement stock the supplier sent back
  const [newExpiry, setNewExpiry] = useState("");
  // Manufacturing date of the replacement stock
  const [newMfg, setNewMfg] = useState("");

  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  // Edit batch modal state (frontend)
  const [editingBatch, setEditingBatch] = useState<BatchItem | null>(null);
  const [editForm, setEditForm] = useState({
    batchNumber: "",
    expiryDate: "",
    quantityAvailable: 0,
    purchasePrice: 0,
    mrp: "",
    salePrice: "",
    note: "",
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  function triggerToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }

  function handleOpenEdit(batch: BatchItem) {
    setActionError("");
    setEditingBatch(batch);
    setEditForm({
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      quantityAvailable: batch.quantityAvailable,
      purchasePrice: batch.purchasePrice,
      mrp: (batch as any).mrp ? String((batch as any).mrp) : "",
      salePrice: (batch as any).salePrice ? String((batch as any).salePrice) : "",
      note: batch.note ?? "",
    });
  }

  function handleCloseEdit() {
    setEditingBatch(null);
  }

  // PATCH /api/batches/:batchId
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBatch) return;

    const qty = Math.max(0, Number(editForm.quantityAvailable) || 0);
    const cost = Math.max(0, Number(editForm.purchasePrice) || 0);
    const body: Record<string, unknown> = {
      batchNumber: editForm.batchNumber.trim(),
      expiryDate: editForm.expiryDate,
      quantityAvailable: qty,
      purchasePrice: cost,
      note: editForm.note.trim() || null,
    };
    // MRP / sale price aren't in the list row, so only send them when filled in
    if (editForm.mrp !== "") body.mrp = Number(editForm.mrp);
    if (editForm.salePrice !== "") body.salePrice = Number(editForm.salePrice);

    setSaving(true);
    setActionError("");
    try {
      await api.patch(`/api/batches/${editingBatch.batchId}`, body);
      triggerToast(`Batch #${body.batchNumber} updated successfully!`);
      setEditingBatch(null);
      setSelectedBatch((prev) =>
        prev && prev.batchId === editingBatch.batchId
          ? {
            ...prev,
            batchNumber: editForm.batchNumber.trim(),
            expiryDate: editForm.expiryDate,
            quantityAvailable: qty,
            purchasePrice: cost,
            valueAtRisk: qty * cost,
            note: editForm.note.trim() || null,
          }
          : prev
      );
      refreshAll();
    } catch (err) {
      setActionError(errMsg(err));
    } finally {
      setSaving(false);
    }
  }

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
  const writeOffByBatch = useMemo(() => {
    const map = new Map<string, WriteOff>();
    for (const w of writeOffs) {
      map.set(w.batchId, w);
    }
    return map;
  }, [writeOffs]);
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
    setWriteOffReason("");
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
      await api.post("/api/purchases/writeoff", {
        batchId: selectedBatch.batchId,
        reason: writeOffReason.trim() || undefined,
      });
      setPanel("none");
      setWriteOffReason("");
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
          : {
              resolutionType: "QUANTITY",
              resolvedBatchId: ret.batchId,
              expiryDate: newExpiry,
              manufacturingDate: newMfg || undefined,
            };
      await api.patch(`/api/purchases/returns/${completingId}`, body);
      setCompletingId(null);
      setAmount("");
      setNewExpiry("");
      setNewMfg("");
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

  // Client-side text filter for batch number, product name, or supplier, plus action filter
  const filteredBatches = useMemo(() => {
    let list = batches;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (b) =>
          b.batchNumber?.toLowerCase().includes(q) ||
          b.productName?.toLowerCase().includes(q) ||
          b.partyName?.toLowerCase().includes(q),
      );
    }
    if (actionFilter !== "all") {
      list = list.filter((b) => {
        const isWO = writtenOffIds.has(b.batchId);
        const bReturns = returnsByBatch[b.batchId] ?? [];
        const hasPending = bReturns.some((r) => r.status === "PENDING");
        const hasCompleted = bReturns.some((r) => r.status === "COMPLETED");

        if (actionFilter === "pending_return") return hasPending;
        if (actionFilter === "completed_return") return hasCompleted;
        if (actionFilter === "written_off") return isWO;
        if (actionFilter === "action_needed") {
          return b.status === "EXPIRED" && b.quantityAvailable > 0 && !hasPending && !isWO;
        }
        return true;
      });
    }
    return list;
  }, [batches, searchQuery, actionFilter, writtenOffIds, returnsByBatch]);

  return (
    <div className="flex flex-col gap-8 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-white shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shrink-0">
            <Check className="h-3.5 w-3.5 stroke-[3]" />
          </div>
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

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

        {/* Expiry Status Filter: Expiry, Near Expiry, and Safe */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 overflow-x-auto">
          {[
            { id: "all", label: "All" },
            { id: "expired", label: "Expired" },
            { id: "near", label: "Near Expiry" },
            { id: "ok", label: "Safe" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as StatusFilterOption)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${statusFilter === tab.id
                ? "bg-white text-[#044d73] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
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
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-16 text-center text-sm text-slate-400"
                  >
                    Loading batches...
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
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

                      {/* Status + return / write-off sub-label (merged) */}
                      <td className="py-3 px-4">
                        {(() => {
                          const wo = writeOffByBatch.get(b.batchId);
                          const bReturns = returnsByBatch[b.batchId] ?? [];
                          const hasPending = bReturns.some((r) => r.status === "PENDING");
                          const hasCompleted = bReturns.some((r) => r.status === "COMPLETED");

                          let sub: { text: string; cls: string } | null = null;
                          if (wo) {
                            sub = { text: "Written off", cls: "text-slate-400" };
                          } else if (hasPending) {
                            sub = { text: "Return pending", cls: "text-amber-600 font-medium" };
                          } else if (hasCompleted) {
                            sub = { text: "Returned", cls: "text-slate-400" };
                          } else if (b.status === "EXPIRED" && b.quantityAvailable > 0) {
                            sub = { text: "Action needed", cls: "text-amber-600 font-medium" };
                          }

                          return (
                            <div className="flex flex-col items-start gap-1">
                              <span
                                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${st.bg} ${st.text}`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${st.dot}`}
                                />
                                {st.label}
                              </span>
                              {sub && (
                                <span
                                  className={`pl-1 text-[11px] leading-none whitespace-nowrap ${sub.cls}`}
                                >
                                  {sub.text}
                                </span>
                              )}
                            </div>
                          );
                        })()}
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
                    <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
                            <Trash2 className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-rose-950">Inventory Written Off</h4>
                            <p className="text-[11px] text-rose-700">
                              Disposed and booked as financial expense loss under Inventory Write-off
                            </p>
                          </div>
                        </div>
                        <span className="rounded-full bg-rose-100 border border-rose-300 px-2.5 py-0.5 text-xs font-bold text-rose-800">
                          Recorded Loss
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2.5 border-t border-rose-200/60 text-xs">
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-semibold">Quantity Removed</span>
                          <span className="font-bold text-slate-800 text-sm">{batchWriteOff.quantity} {selectedBatch.unit}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-semibold">Total Loss</span>
                          <span className="font-bold text-rose-600 text-sm">{rs(Number(batchWriteOff.totalLoss))}</span>
                        </div>
                        {batchWriteOff.createdAt && (
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Date Written Off</span>
                            <span className="font-semibold text-slate-700 text-xs mt-0.5 block">
                              {new Date(batchWriteOff.createdAt).toISOString().slice(0, 10)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* -------------------------------------------------- */}
                  {/* Purchase returns on this batch                      */}
                  {/* -------------------------------------------------- */}
                  {batchReturns.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <RotateCcw className="w-4 h-4 text-[#044d73]" />
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            Purchase Returns & Debit Notes
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-slate-500">
                          {batchReturns.length} {batchReturns.length === 1 ? "Record" : "Records"}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {batchReturns.map((r) => {
                          const isPending = r.status === "PENDING";
                          return (
                            <div
                              key={r.id}
                              className={`rounded-xl border p-4 space-y-3 transition-colors ${isPending
                                ? "border-amber-200 bg-amber-50/50"
                                : "border-emerald-200 bg-emerald-50/40"
                                }`}
                            >
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="space-y-1.5 flex-1 min-w-[200px]">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-bold text-slate-900">
                                      {r.quantity} {selectedBatch.unit} Returned
                                    </span>
                                    {isPending ? (
                                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                                        <span className="relative flex h-2 w-2">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                        </span>
                                        Pending Settlement
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        Completed / Settled
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                                    <span>Return Date: <strong className="text-slate-800">{r.returnDate}</strong></span>
                                    {r.partyName && (
                                      <span>Supplier: <strong className="text-slate-800">{r.partyName}</strong></span>
                                    )}
                                    {r.reason && (
                                      <span>Reason: <span className="text-slate-700 italic">"{r.reason}"</span></span>
                                    )}
                                  </div>
                                  {!isPending && (
                                    <div className="inline-flex items-center gap-1.5 mt-1 rounded-md bg-emerald-100/90 border border-emerald-300/80 px-2.5 py-1 text-xs font-medium text-emerald-800">
                                      <strong>Resolution:</strong>{" "}
                                      {r.resolutionType === "MONEY"
                                        ? `Refund / Debit Note Settled · ${rs(Number(r.resolutionAmount ?? 0))}`
                                        : "Replacement stock received into batch"}
                                    </div>
                                  )}
                                </div>

                                {isPending && completingId !== r.id && (
                                  <button
                                    onClick={() => {
                                      setPanel("none");
                                      setCompletingId(r.id);
                                      setResolution("MONEY");
                                      setAmount(String(r.quantity * (selectedBatch.purchasePrice || 0)));
                                      setNewExpiry("");
                                      setNewMfg("");
                                      setActionError("");
                                    }}
                                    className="rounded-lg bg-[#044d73] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#033a57] shadow-xs transition-colors shrink-0"
                                  >
                                    Settle Return
                                  </button>
                                )}
                              </div>

                              {/* Manual completion — ask what the supplier gave back */}
                              {completingId === r.id && (
                                <div className="space-y-3.5 border-t border-amber-200/80 pt-3.5 bg-white p-3.5 rounded-lg border border-slate-200">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold text-slate-800">
                                      How was this return settled by {r.partyName || "supplier"}?
                                    </p>
                                    <span className="text-[11px] text-slate-500">
                                      {r.quantity} {selectedBatch.unit}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    {(["MONEY", "QUANTITY"] as const).map((t) => (
                                      <button
                                        key={t}
                                        type="button"
                                        onClick={() => setResolution(t)}
                                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${resolution === t
                                          ? "border-[#044d73] bg-[#044d73]/10 text-[#044d73] shadow-xs"
                                          : "border-slate-200 bg-slate-50 hover:bg-white text-slate-600"
                                          }`}
                                      >
                                        {t === "MONEY" ? "Credit Note / Refund" : "Replacement Stock"}
                                      </button>
                                    ))}
                                  </div>

                                  {resolution === "MONEY" ? (
                                    <div>
                                      <label className="text-xs font-semibold text-slate-600 block mb-1">
                                        Settlement Amount (Rs.)
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder={`Default: ${r.quantity * (selectedBatch.purchasePrice || 0)}`}
                                        className={inputCls}
                                      />
                                      <p className="text-[11px] text-slate-500 mt-1">
                                        Default is purchase cost: {r.quantity} × {rs(selectedBatch.purchasePrice)} = {rs(r.quantity * (selectedBatch.purchasePrice || 0))}.
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                        <strong>{r.quantity} {selectedBatch.unit}</strong> will be added back to batch{" "}
                                        <strong>#{selectedBatch.batchNumber}</strong> with a fresh expiry date.
                                      </p>
                                      <div>
                                        <label className="text-xs font-semibold text-slate-600 block mb-1">
                                          Manufacturing Date of Replacement Stock
                                        </label>
                                        <input
                                          type="date"
                                          max={new Date().toLocaleDateString("en-CA")}
                                          value={newMfg}
                                          onChange={(e) => setNewMfg(e.target.value)}
                                          className={inputCls}
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs font-semibold text-slate-600 block mb-1">
                                          New Expiry Date of Replacement Stock
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
                                    <p className="text-xs text-red-600 font-medium">{actionError}</p>
                                  )}

                                  <div className="flex justify-end gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCompletingId(null);
                                        setActionError("");
                                      }}
                                      className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-1.5 text-xs font-medium text-slate-700 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={submitComplete}
                                      disabled={
                                        saving ||
                                        (resolution === "QUANTITY" &&
                                          (!newExpiry ||
                                            newExpiry < tomorrow() ||
                                            !newMfg ||
                                            newMfg >= newExpiry))
                                      }
                                      className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors disabled:opacity-40"
                                    >
                                      {saving ? "Saving..." : "Confirm Settlement"}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* -------------------------------------------------- */}
                  {/* Return form                                         */}
                  {/* -------------------------------------------------- */}
                  {panel === "return" && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="w-4 h-4 text-amber-700" />
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                          Return to Supplier (Purchase Return / Debit Note)
                        </span>
                      </div>
                      <p className="text-xs text-amber-800">
                        This stock will be deducted from your inventory and tracked as a Debit Note against the supplier.
                        <strong> This is not a business loss</strong> because the supplier owes you a refund or replacement.
                      </p>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Quantity to Return (Max {selectedBatch.quantityAvailable} {selectedBatch.unit})
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={selectedBatch.quantityAvailable}
                          placeholder={`Enter quantity (e.g. ${selectedBatch.quantityAvailable})`}
                          value={returnQty}
                          onChange={(e) => setReturnQty(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Reason (Optional, e.g. Expired / Damaged / Near Expiry)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Expired batch return for credit note"
                          value={returnReason}
                          onChange={(e) => setReturnReason(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      {actionError && <p className="text-xs text-red-600 font-medium">{actionError}</p>}
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPanel("none");
                            setActionError("");
                          }}
                          className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-1.5 text-xs font-medium text-slate-700 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={submitReturn}
                          disabled={
                            saving ||
                            !Number(returnQty) ||
                            Number(returnQty) > selectedBatch.quantityAvailable
                          }
                          className="rounded-lg bg-[#044d73] hover:bg-[#033a57] px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors disabled:opacity-40"
                        >
                          {saving ? "Saving..." : "Create Return"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* -------------------------------------------------- */}
                  {/* Write-off confirm                                   */}
                  {/* -------------------------------------------------- */}
                  {panel === "writeoff" && (
                    <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Trash2 className="w-4 h-4 text-red-600" />
                        <span className="text-xs font-bold uppercase tracking-wider text-red-900">
                          Write Off Expired Stock (Inventory Loss)
                        </span>
                      </div>
                      <p className="text-xs text-red-900 leading-relaxed">
                        All{" "}
                        <strong>
                          {selectedBatch.quantityAvailable} {selectedBatch.unit}
                        </strong>{" "}
                        left on this batch will be completely removed from shelf stock and recorded as an accounting financial loss of{" "}
                        <strong className="text-red-700">{rs(selectedBatch.valueAtRisk)}</strong> under <em>Inventory Write-off</em> expenses.
                        This cannot be undone.
                      </p>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Quantity to Write Off ({selectedBatch.unit})
                        </label>
                        <input
                          type="number"
                          disabled
                          value={selectedBatch.quantityAvailable}
                          className={`${inputCls} bg-slate-100/90 text-slate-600 cursor-not-allowed border-slate-200`}
                        />
                        <p className="text-[11px] text-slate-500 mt-1">
                          Write-off removes the full remaining stock ({selectedBatch.quantityAvailable} {selectedBatch.unit}) from inventory.
                        </p>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Reason / Note (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Expired on shelf, damaged packaging, discarded"
                          value={writeOffReason}
                          onChange={(e) => setWriteOffReason(e.target.value)}
                          className={inputCls}
                        />
                      </div>

                      {actionError && <p className="text-xs text-red-600 font-medium">{actionError}</p>}
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPanel("none");
                            setActionError("");
                            setWriteOffReason("");
                          }}
                          className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-1.5 text-xs font-medium text-slate-700 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={submitWriteOff}
                          disabled={saving}
                          className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors disabled:opacity-40"
                        >
                          {saving ? "Writing off..." : "Confirm Write Off"}
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
                        {selectedBatch.partyName || "Not linked to a supplier"}
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

                  {/* Contextual Action Prompt for Expired Batches */}
                  {selectedBatch.status === "EXPIRED" && selectedBatch.quantityAvailable > 0 && !batchWriteOff && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-amber-50 border border-amber-200/90 p-4 text-amber-950">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-amber-600" />
                        <div>
                          <strong className="font-bold block text-sm">Expired Stock on Shelf</strong>
                          <p className="text-xs text-amber-800 mt-0.5">
                            {selectedBatch.quantityAvailable} {selectedBatch.unit} expired. Return it to the supplier for credit/replacement (no loss) or write it off.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setActionError("");
                            setCompletingId(null);
                            setReturnQty(String(selectedBatch.quantityAvailable));
                            setPanel(panel === "return" ? "none" : "return");
                          }}
                          className="rounded-lg border border-amber-300 bg-white hover:bg-amber-100/60 px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-2xs transition-colors"
                        >
                          Return to Supplier
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActionError("");
                            setCompletingId(null);
                            setPanel(panel === "writeoff" ? "none" : "writeoff");
                          }}
                          className="rounded-lg bg-red-600 hover:bg-red-700 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition-colors"
                        >
                          Write Off
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedBatch.status === "NEAR_EXPIRY" && selectedBatch.quantityAvailable > 0 && (
                    <div className="flex items-start gap-2.5 rounded-xl bg-amber-50/80 p-3.5 text-amber-800 border border-amber-200">
                      <Clock className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                      <div>
                        <strong className="font-semibold block text-sm">
                          Expiring Soon ({selectedBatch.daysLeft} days remaining)
                        </strong>
                        <p className="text-xs text-amber-700 mt-0.5">
                          Consider dispensing first or initiating an early return to the supplier before expiry.
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedBatch.quantityAvailable === 0 && (
                    <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-slate-600 text-xs">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>
                        This batch has <strong>0 available stock</strong> on shelf{" "}
                        {batchWriteOff ? "(written off as loss)" : batchReturns.length > 0 ? "(returned to supplier or dispensed)" : "(fully sold/dispensed)"}.
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer actions */}
                <div className="shrink-0 flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
                  {selectedBatch.quantityAvailable > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setActionError("");
                        setCompletingId(null);
                        setReturnQty(String(selectedBatch.quantityAvailable));
                        setPanel(panel === "return" ? "none" : "return");
                      }}
                      className="flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 shadow-2xs transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Return to Supplier
                    </button>
                  )}

                  {selectedBatch.status === "EXPIRED" &&
                    selectedBatch.quantityAvailable > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setActionError("");
                          setCompletingId(null);
                          setPanel(panel === "writeoff" ? "none" : "writeoff");
                        }}
                        className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 shadow-2xs transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Write Off
                      </button>
                    )}

                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Edit Batch Modal Popup (Frontend) */}
      {editingBatch && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
          onClick={handleCloseEdit}
        >
          <div
            className="bg-white border border-slate-200 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#044d73] text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/10 text-white flex items-center justify-center border border-white/20 shrink-0">
                  <Pencil className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edit Batch</h3>
                  <p className="text-xs text-sky-100/90 mt-0.5">
                    {editingBatch.productName} · Batch #{editingBatch.batchNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseEdit}
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEdit}>
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Product & Supplier Context Pill */}
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Product</span>
                    <span className="font-semibold text-slate-800">{editingBatch.productName}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block font-medium">Supplier</span>
                    <span className="font-semibold text-slate-800">{editingBatch.partyName || "Direct Purchase"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Batch Number */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Batch Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.batchNumber}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, batchNumber: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#044d73] focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Expiry Date */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Expiry Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={editForm.expiryDate}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, expiryDate: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#044d73] focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Available Stock */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Available Stock ({editingBatch.unit}) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={editForm.quantityAvailable}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, quantityAvailable: Number(e.target.value) }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#044d73] focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Purchase Price (Cost) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Purchase Price / Cost (Rs.) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      required
                      value={editForm.purchasePrice}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, purchasePrice: Number(e.target.value) }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#044d73] focus:border-transparent transition-all"
                    />
                  </div>

                  {/* MRP */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      MRP (Rs.)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder="Optional"
                      value={editForm.mrp}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, mrp: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#044d73] focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Selling Price */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Selling Price (Rs.)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder="Optional"
                      value={editForm.salePrice}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, salePrice: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#044d73] focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Batch Notes / Location
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Shelf A-3, supplier promo batch..."
                    value={editForm.note}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, note: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#044d73] focus:border-transparent transition-all resize-none"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2.5 px-6 py-4 bg-slate-50 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  className="rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-200/70 transition-colors"
                >
                  Cancel
                </button>
                {actionError && (
                  <span className="mr-auto text-xs text-rose-600">{actionError}</span>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#044d73] hover:bg-[#033b59] px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-60"
                >
                  <Check className="h-4 w-4" />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}