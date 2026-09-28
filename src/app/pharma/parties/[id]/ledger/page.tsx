"use client";

import { useEffect, useState, use, useCallback } from "react";
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
      setLedger(res.data);
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
      // Nepali Fiscal Year starts mid-July (Shrawan 1)
      const currentMonth = today.getMonth(); // 0-indexed (July is 6)
      const fiscalStartYear = currentMonth >= 6 ? today.getFullYear() : today.getFullYear() - 1;
      const d = new Date(fiscalStartYear, 6, 16); // Approx July 16 (Shrawan 1)
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

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-16">
      {/* Top Action Bar (Hidden when Printing) */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/pharma/parties"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Parties
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">Party:</span>
            <select
              value={partyId}
              onChange={(e) => router.push(`/pharma/parties/${e.target.value}/ledger`)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-bold text-slate-800 focus:border-[#044d73] focus:outline-none"
            >
              {partiesList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.partyType})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => loadLedger()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-lg bg-[#044d73] hover:bg-[#033f60] text-white px-4 py-2 text-xs font-semibold shadow-sm transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Ledger
          </button>
        </div>
      </div>

      {/* Date Filter Bar (Hidden when Printing) */}
      <div className="print:hidden flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-500 font-medium flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-[#044d73]" /> Filter Period:
          </span>
          <button
            type="button"
            onClick={() => handleQuickPreset("today")}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-100 font-medium transition-colors"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset("thisMonth")}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-100 font-medium transition-colors"
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset("thisYear")}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-100 font-medium transition-colors"
          >
            This FY
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset("last30")}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-100 font-medium transition-colors"
          >
            Last 30 Days
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset("last90")}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-100 font-medium transition-colors"
          >
            Last 90 Days
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset("all")}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-100 font-medium transition-colors"
          >
            All Time
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
            <label className="text-slate-400 font-medium">From:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs text-slate-800 font-semibold focus:outline-none bg-transparent cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
            <label className="text-slate-400 font-medium">To:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs text-slate-800 font-semibold focus:outline-none bg-transparent cursor-pointer"
            />
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
              className="rounded-lg bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1 text-xs font-semibold transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {loading && !ledger ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-sm text-slate-400">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-[#044d73] mb-2" />
          Loading party ledger statement...
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl text-center text-sm">
          {error}
        </div>
      ) : ledger ? (
        /* The Printable Sheet Layout matching user's photo */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 sm:p-10 font-sans print:border-none print:shadow-none print:p-0 print:m-0 text-slate-900">
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
                <tr className="bg-slate-50/50 font-bold border-b border-slate-200">
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
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-sans italic">
                      No transactions recorded in this period.
                    </td>
                  </tr>
                ) : (
                  ledger.entries.map((item, idx) => (
                    <tr
                      key={`${item.id}-${idx}`}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
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
                  ))
                )}
              </tbody>

              {/* Bottom Summary Table matching the exact photo */}
              <tfoot className="border-t-2 border-slate-300 font-mono text-xs">
                {/* Total Row */}
                <tr className="border-b border-slate-200 font-bold bg-slate-50/50">
                  <td colSpan={5} className="py-2.5 px-3 font-sans text-right uppercase">
                    Total
                  </td>
                  <td className="py-2.5 px-2 text-right font-bold text-slate-900 whitespace-nowrap">
                    {formatCurrency(ledger.summary.totalDebit)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-bold text-slate-900 whitespace-nowrap">
                    {formatCurrency(ledger.summary.totalCredit)}
                  </td>
                  <td className="py-2.5 px-2"></td>
                </tr>

                {/* Net Closing Balance Row */}
                <tr className="border-b border-slate-200 font-bold">
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
                    {formatCurrency(ledger.summary.closingBalance)} {ledger.summary.closingBalanceType === "Debit Balance" ? "Dr" : "Cr"}
                  </td>
                </tr>

                {/* Grand Total Row */}
                <tr className="border-y-2 border-slate-400 font-extrabold bg-slate-100/60 text-slate-950">
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
