"use client";

import { useEffect, useState, use, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Printer,
  Calendar,
  Building2,
  Phone,
  MapPin,
  RefreshCw,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { PartyLedgerResult } from "@/controller/party/ledger";
import { formatBsDate, getFiscalYear } from "@/lib/nepali-date";
import { AnimatedStatValue } from "@/app/pharma/_components/ui/animated-stat-value";
import { DotsLoader } from "@/app/pharma/_components/ui/dots-loader";

interface PartyOption {
  id: string;
  name: string;
  partyType: string;
}

export default function PartyLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const partyId = resolvedParams.id;
  const router = useRouter();

  const [ledger, setLedger] = useState<PartyLedgerResult | null>(null);
  const [partiesList, setPartiesList] = useState<PartyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date filters
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Printable area row selection state
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());

  // Fetch all parties for the party switcher dropdown
  useEffect(() => {
    api
      .get("/api/parties", { params: { limit: 100 } })
      .then((res) => {
        if (res.data?.parties) {
          setPartiesList(res.data.parties);
        }
      })
      .catch((err) => {
        console.error("Failed to load parties list for switcher:", err);
      });
  }, []);

  const loadLedger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/parties/${partyId}/ledger`, {
        params: {
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      });
      const data: PartyLedgerResult = res.data;
      setLedger(data);

      // Default: select all entries for printing
      if (data?.entries) {
        setSelectedEntryIds(new Set(data.entries.map((e) => e.id)));
      }
    } catch (err) {
      console.error("Failed to load party ledger:", err);
      setError("Failed to load party ledger statement.");
    } finally {
      setLoading(false);
    }
  }, [partyId, startDate, endDate]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  // Selection toggle handlers
  const handleToggleEntry = (id: string) => {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!ledger?.entries) return;
    setSelectedEntryIds(new Set(ledger.entries.map((e) => e.id)));
  };

  const handleDeselectAll = () => {
    setSelectedEntryIds(new Set());
  };

  // Helper to select only Invoice / Sales / Purchase entries
  const handleSelectInvoicesOnly = () => {
    if (!ledger?.entries) return;
    const invoiceIds = ledger.entries
      .filter((e) => e.type === "Sale" || e.type === "Purc")
      .map((e) => e.id);
    setSelectedEntryIds(new Set(invoiceIds));
  };

  const isAllSelected = useMemo(() => {
    if (!ledger?.entries || ledger.entries.length === 0) return false;
    return selectedEntryIds.size === ledger.entries.length;
  }, [ledger, selectedEntryIds]);

  const isSomeSelected = useMemo(() => {
    return selectedEntryIds.size > 0 && !isAllSelected;
  }, [selectedEntryIds, isAllSelected]);

  // Dynamic totals for selected rows (used in print footer if partial selection is made)
  const selectedSummary = useMemo(() => {
    if (!ledger?.entries) {
      return { totalDebit: 0, totalCredit: 0, count: 0, net: 0 };
    }
    const filtered = ledger.entries.filter((e) => selectedEntryIds.has(e.id));
    const totalDebit = filtered.reduce((acc, curr) => acc + (curr.debit || 0), 0);
    const totalCredit = filtered.reduce((acc, curr) => acc + (curr.credit || 0), 0);
    return {
      totalDebit,
      totalCredit,
      count: filtered.length,
      net: totalDebit - totalCredit,
    };
  }, [ledger, selectedEntryIds]);

  const handlePrint = () => {
    const originalTitle = document.title;
    if (ledger?.party?.name) {
      document.title = `${ledger.party.name} - Ledger Statement`;
    }
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  const handleQuickPreset = (preset: "today" | "thisMonth" | "thisYear" | "last30" | "last90" | "all") => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    if (preset === "all") {
      setStartDate("");
      setEndDate("");
      return;
    }

    if (preset === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
      return;
    }

    if (preset === "thisMonth") {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(todayStr);
      return;
    }

    if (preset === "last30") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(todayStr);
      return;
    }

    if (preset === "last90") {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(todayStr);
      return;
    }

    if (preset === "thisYear") {
      const currentMonth = today.getMonth();
      const fiscalStartYear = currentMonth >= 6 ? today.getFullYear() : today.getFullYear() - 1;
      const d = new Date(fiscalStartYear, 6, 16);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(todayStr);
    }
  };

  const formatCurrency = (val: number) => {
    return Number(val || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const rs = (n: number) =>
    `Rs. ${Number(n || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const isPartialSelection = selectedEntryIds.size > 0 && selectedEntryIds.size < (ledger?.entries.length || 0);

  return (
    <div className="flex flex-col gap-6 md:gap-8 pb-16">
      {/* Header Banner */}
      <div className="print:hidden rounded-xl bg-[#044d73] px-4 py-4 sm:px-6 sm:py-5 text-white shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Party Ledger</h1>
            {ledger?.party?.partyType && (
              <span className="rounded-md bg-white/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-white">
                {ledger.party.partyType}
              </span>
            )}
          </div>
          {ledger?.party?.name ? (
            <p className="text-xs sm:text-sm text-white/80 mt-1">
              Account Statement for <span className="font-semibold text-white">{ledger.party.name}</span>
            </p>
          ) : (
            <p className="text-xs sm:text-sm text-white/80 mt-1">
              Party account ledger and transaction statement
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={() => loadLedger()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#044d73] shadow-sm hover:bg-slate-50 transition-colors shrink-0"
          >
            <Printer className="h-4 w-4" />
            {isPartialSelection ? `Print Selected (${selectedEntryIds.size})` : "Print Ledger"}
          </button>
        </div>
      </div>

      {/* Stat Dashboards (Hidden when Printing) */}
      {ledger && (
        <div className="print:hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 border-l-4 border-l-slate-400 bg-white p-4 sm:p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">
                Opening Balance
              </p>
              <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-1">
                <AnimatedStatValue value={ledger.openingBalance.amount} format={rs} />
                {ledger.openingBalance.amount > 0 && (
                  <span className="text-xs font-semibold text-slate-500 ml-1.5 font-sans">
                    {ledger.openingBalance.type}
                  </span>
                )}
              </p>
            </div>
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 border-l-4 border-l-sky-500 bg-white p-4 sm:p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">
                Total Debit (Dr)
              </p>
              <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-1">
                <AnimatedStatValue value={ledger.summary.totalDebit} format={rs} />
              </p>
            </div>
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <ArrowDownLeft className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 border-l-4 border-l-indigo-500 bg-white p-4 sm:p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">
                Total Credit (Cr)
              </p>
              <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-1">
                <AnimatedStatValue value={ledger.summary.totalCredit} format={rs} />
              </p>
            </div>
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <ArrowUpRight className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </div>

          <div
            className={`rounded-xl border border-slate-200 border-l-4 ${
              ledger.summary.closingBalanceType === "Debit Balance"
                ? "border-l-emerald-500"
                : "border-l-amber-500"
            } bg-white p-4 sm:p-5 shadow-sm flex items-center justify-between`}
          >
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">
                {ledger.summary.closingBalanceType}
              </p>
              <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-1">
                <AnimatedStatValue value={ledger.summary.closingBalance} format={rs} />
                <span className="text-xs font-semibold text-slate-500 ml-1.5 font-sans">
                  {ledger.summary.closingBalanceType === "Debit Balance" ? "Dr" : "Cr"}
                </span>
              </p>
            </div>
            <div
              className={`flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl ${
                ledger.summary.closingBalanceType === "Debit Balance"
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-amber-50 text-amber-600"
              }`}
            >
              <Building2 className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </div>
        </div>
      )}

      {/* Control Actions & Filter Panel (Hidden when Printing) */}
      <div className="print:hidden flex flex-col gap-3.5 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Party Selector */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <span className="text-xs sm:text-sm font-semibold text-slate-500 whitespace-nowrap">
              Party Account:
            </span>
            <div className="relative flex-1 max-w-md">
              <select
                value={partyId}
                onChange={(e) => router.push(`/pharma/parties/${e.target.value}/ledger`)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-white py-2 px-3 text-xs sm:text-sm font-bold text-slate-800 focus:border-[#044d73] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#044d73]/10 transition-all cursor-pointer"
              >
                {partiesList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.partyType})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date range picker */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <label className="text-slate-400 font-medium text-xs">From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs text-slate-800 font-semibold focus:outline-none bg-transparent cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <label className="text-slate-400 font-medium text-xs">To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs text-slate-800 font-semibold focus:outline-none bg-transparent cursor-pointer"
              />
            </div>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="rounded-lg bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 text-xs font-semibold transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Quick Filter Presets */}
        <div className="flex items-center gap-1.5 pt-3 border-t border-slate-100 overflow-x-auto">
          <span className="text-slate-400 text-xs font-medium flex items-center gap-1 mr-1 shrink-0">
            <Filter className="h-3.5 w-3.5 text-[#044d73]" /> Period:
          </span>
          {[
            { id: "today", label: "Today" },
            { id: "thisMonth", label: "This Month" },
            { id: "thisYear", label: "This FY" },
            { id: "last30", label: "Last 30 Days" },
            { id: "last90", label: "Last 90 Days" },
            { id: "all", label: "All Time" },
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleQuickPreset(preset.id as any)}
              className="rounded-md border border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors whitespace-nowrap"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Printable Area Selection Bar (Hidden when Printing) */}
      {ledger && ledger.entries.length > 0 && (
        <div className="print:hidden flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Printable Selection:</span>
            <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 font-bold text-[#044d73]">
              {selectedEntryIds.size} of {ledger.entries.length} items selected
            </span>
            {isPartialSelection && (
              <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-medium">
                Only selected entries will be printed
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-2.5 py-1 rounded bg-white border border-slate-200 font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={handleSelectInvoicesOnly}
              className="px-2.5 py-1 rounded bg-white border border-slate-200 font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Invoices Only
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="px-2.5 py-1 rounded bg-white border border-slate-200 font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {loading && !ledger ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center shadow-sm">
          <DotsLoader text="Loading party ledger statement..." size="md" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl text-center text-sm font-medium">
          {error}
        </div>
      ) : ledger ? (
        /* The Printable Sheet Layout matching user's photo */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-10 font-sans print:border-none print:shadow-none print:p-0 print:m-0 text-slate-900">
          {/* Statement Header */}
          <div className="text-center space-y-1 border-b border-slate-200 pb-4 mb-5">
            <h2 className="text-lg sm:text-xl font-bold uppercase tracking-wider text-slate-900">
              {ledger.organization.businessName} {ledger.organization.fiscalYear}
            </h2>
            <p className="text-xs font-semibold text-slate-700">
              Page 1 : LEDGER{" "}
              {ledger.dateRange.startBsDate && ledger.dateRange.endBsDate ? (
                <span>
                  ( From {ledger.dateRange.startBsDate} to {ledger.dateRange.endBsDate} )
                  <span className="text-slate-500 font-normal ml-1">
                    [{ledger.dateRange.startDate} to {ledger.dateRange.endDate}]
                  </span>
                </span>
              ) : ledger.dateRange.startBsDate ? (
                <span>
                  ( From {ledger.dateRange.startBsDate} [{ledger.dateRange.startDate}] onwards )
                </span>
              ) : ledger.dateRange.endBsDate ? (
                <span>
                  ( Up to {ledger.dateRange.endBsDate} [{ledger.dateRange.endDate}] )
                </span>
              ) : (
                <span>( Full Statement )</span>
              )}
            </p>
            <div className="pt-2 text-left">
              <span className="text-xs sm:text-sm font-bold uppercase text-slate-800">
                Account : {ledger.party.name}
              </span>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 mt-0.5">
                {ledger.party.panVatNumber && (
                  <span>PAN/VAT: {ledger.party.panVatNumber}</span>
                )}
                {ledger.party.phone && <span>Ph: {ledger.party.phone}</span>}
                {ledger.party.address && <span>Address: {ledger.party.address}</span>}
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-y border-slate-300 bg-slate-50/80 font-bold text-slate-700 text-left">
                  {/* Selection Checkbox Header (Hidden on Print) */}
                  <th className="print:hidden py-2 px-2 text-center w-8">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeSelected;
                      }}
                      onChange={(e) => {
                        if (e.target.checked) handleSelectAll();
                        else handleDeselectAll();
                      }}
                      title="Select / Deselect all for printing"
                      className="h-3.5 w-3.5 rounded border-slate-300 text-[#044d73] focus:ring-[#044d73] cursor-pointer"
                    />
                  </th>
                  <th className="py-2 px-2 whitespace-nowrap">Nepali Date</th>
                  <th className="py-2 px-2 whitespace-nowrap">English Date</th>
                  <th className="py-2 px-2 whitespace-nowrap">Type</th>
                  <th className="py-2 px-2 whitespace-nowrap">Vch No</th>
                  <th className="py-2 px-3">Particulars</th>
                  <th className="py-2 px-2 text-right whitespace-nowrap">Debit (Rs.)</th>
                  <th className="py-2 px-2 text-right whitespace-nowrap">Credit (Rs.)</th>
                  <th className="py-2 px-2 text-right whitespace-nowrap">Balance (Rs.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-mono text-[11px]">
                {/* Opening Balance / Totals b/d Row */}
                <tr className={`bg-slate-50/50 font-bold border-b border-slate-200 ${isPartialSelection ? "print:hidden" : ""}`}>
                  <td className="print:hidden py-2 px-2 text-center text-slate-300">—</td>
                  <td className="py-2 px-2 font-sans italic text-slate-400">
                    {ledger.dateRange.startBsDate || "—"}
                  </td>
                  <td className="py-2 px-2 font-sans italic text-slate-400">
                    {ledger.dateRange.startDate || "—"}
                  </td>
                  <td className="py-2 px-2 text-slate-500 font-sans">Opn</td>
                  <td className="py-2 px-2 text-slate-400">—</td>
                  <td className="py-2 px-3 font-sans font-bold text-slate-800">
                    Totals b/d
                  </td>
                  <td className="py-2 px-2 text-right font-bold text-slate-800">
                    {ledger.openingBalance.amount > 0 && ledger.openingBalance.type === "Dr"
                      ? formatCurrency(ledger.openingBalance.amount)
                      : ""}
                  </td>
                  <td className="py-2 px-2 text-right font-bold text-slate-800">
                    {ledger.openingBalance.amount > 0 && ledger.openingBalance.type === "Cr"
                      ? formatCurrency(ledger.openingBalance.amount)
                      : ""}
                  </td>
                  <td className="py-2 px-2 text-right font-bold text-slate-700 font-sans">
                    {ledger.openingBalance.amount > 0
                      ? `${formatCurrency(ledger.openingBalance.amount)} ${ledger.openingBalance.type}`
                      : "0.00"}
                  </td>
                </tr>

                {/* Transaction Rows */}
                {ledger.entries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 font-sans italic">
                      No transactions recorded in this period.
                    </td>
                  </tr>
                ) : (
                  ledger.entries.map((item, idx) => {
                    const isSelected = selectedEntryIds.has(item.id);
                    return (
                      <tr
                        key={`${item.id}-${idx}`}
                        className={`transition-colors hover:bg-slate-50/70 ${
                          !isSelected ? "opacity-60 bg-slate-50/30 print:hidden" : ""
                        }`}
                      >
                        {/* Checkbox column (Hidden when printing) */}
                        <td className="print:hidden py-1.5 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleEntry(item.id)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-[#044d73] focus:ring-[#044d73] cursor-pointer"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-slate-700 whitespace-nowrap">
                          {item.nepaliDate}
                        </td>
                        <td className="py-1.5 px-2 text-slate-600 whitespace-nowrap">
                          {item.englishDate}
                        </td>
                        <td className="py-1.5 px-2 font-sans font-medium text-slate-700">
                          {item.type}
                        </td>
                        <td className="py-1.5 px-2 font-sans font-semibold text-slate-800 whitespace-nowrap">
                          {item.vchNo}
                        </td>
                        <td className="py-1.5 px-3 font-sans text-slate-800">
                          {item.particulars}
                        </td>
                        <td className="py-1.5 px-2 text-right text-slate-900 font-semibold whitespace-nowrap">
                          {item.debit > 0 ? formatCurrency(item.debit) : ""}
                        </td>
                        <td className="py-1.5 px-2 text-right text-slate-900 font-semibold whitespace-nowrap">
                          {item.credit > 0 ? formatCurrency(item.credit) : ""}
                        </td>
                        <td className="py-1.5 px-2 text-right text-slate-800 font-sans whitespace-nowrap">
                          <span className="font-semibold">{formatCurrency(item.balance)}</span>{" "}
                          <span className="text-[10px] font-bold text-slate-500">{item.balanceType}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Bottom Summary Table matching the exact layout */}
              <tfoot className="border-t-2 border-slate-300 font-mono text-xs">
                {/* Total Row */}
                <tr className="border-b border-slate-200 font-bold bg-slate-50/50">
                  <td className="print:hidden"></td>
                  <td colSpan={5} className="py-2.5 px-3 font-sans text-right uppercase">
                    {isPartialSelection ? `Total (Selected ${selectedSummary.count} Items)` : "Total"}
                  </td>
                  <td className="py-2.5 px-2 text-right font-bold text-slate-900 whitespace-nowrap">
                    {formatCurrency(
                      isPartialSelection ? selectedSummary.totalDebit : ledger.summary.totalDebit
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-right font-bold text-slate-900 whitespace-nowrap">
                    {formatCurrency(
                      isPartialSelection ? selectedSummary.totalCredit : ledger.summary.totalCredit
                    )}
                  </td>
                  <td className="py-2.5 px-2"></td>
                </tr>

                {/* Net Closing Balance Row (Shown only when full ledger is printed) */}
                {!isPartialSelection ? (
                  <>
                    <tr className="border-b border-slate-200 font-bold">
                      <td className="print:hidden"></td>
                      <td colSpan={5} className="py-2.5 px-3 font-sans text-right uppercase text-slate-700">
                        {ledger.summary.closingBalanceType}
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-slate-900 whitespace-nowrap">
                        {ledger.summary.closingBalanceType === "Credit Balance"
                          ? formatCurrency(ledger.summary.closingBalance)
                          : ""}
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-slate-900 whitespace-nowrap">
                        {ledger.summary.closingBalanceType === "Debit Balance"
                          ? formatCurrency(ledger.summary.closingBalance)
                          : ""}
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-[#044d73] font-sans">
                        {formatCurrency(ledger.summary.closingBalance)}{" "}
                        {ledger.summary.closingBalanceType === "Debit Balance" ? "Dr" : "Cr"}
                      </td>
                    </tr>

                    {/* Grand Total Row */}
                    <tr className="border-y-2 border-slate-400 font-extrabold bg-slate-100/60 text-slate-950">
                      <td className="print:hidden"></td>
                      <td colSpan={5} className="py-2.5 px-3 font-sans text-right uppercase tracking-wider">
                        Grand Total
                      </td>
                      <td className="py-2.5 px-2 text-right whitespace-nowrap">
                        {formatCurrency(ledger.summary.grandTotal)}
                      </td>
                      <td className="py-2.5 px-2 text-right whitespace-nowrap">
                        {formatCurrency(ledger.summary.grandTotal)}
                      </td>
                      <td className="py-2.5 px-2"></td>
                    </tr>
                  </>
                ) : (
                  /* When partial selection is printed: Show clear Net Balance of selected items */
                  <tr className="border-y-2 border-slate-400 font-extrabold bg-slate-100/60 text-slate-950">
                    <td className="print:hidden"></td>
                    <td colSpan={5} className="py-2.5 px-3 font-sans text-right uppercase tracking-wider">
                      Net Selected Balance
                    </td>
                    <td colSpan={2} className="py-2.5 px-2 text-right whitespace-nowrap">
                      {formatCurrency(Math.abs(selectedSummary.net))} {selectedSummary.net >= 0 ? "Dr" : "Cr"}
                    </td>
                    <td className="py-2.5 px-2"></td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>

          {/* Signature / Verification Line for Printouts */}
          <div className="hidden print:flex justify-between items-end pt-16 text-xs font-sans text-slate-500">
            <div className="border-t border-slate-400 pt-1 w-44 text-center">
              Prepared By
            </div>
            <div className="border-t border-slate-400 pt-1 w-44 text-center">
              Verified By
            </div>
            <div className="border-t border-slate-400 pt-1 w-44 text-center">
              Authorized Signature
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
