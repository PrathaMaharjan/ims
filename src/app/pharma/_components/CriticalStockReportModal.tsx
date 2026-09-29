"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Printer,
  FileDown,
  X,
  AlertTriangle,
  PackageX,
  Boxes,
  Clock,
  Building2,
  FileSpreadsheet,
} from "lucide-react";
import { api } from "@/lib/api-client";

export interface WatchlistItem {
  status: "EXPIRED" | "NEAR_EXPIRY" | "LOW_STOCK";
  name: string;
  manufacturer: string | null;
  unit?: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  supplierName?: string | null;
  daysLeft?: number | null;
  quantityAvailable: number;
  quantityReceived: number | null;
}

interface OrganizationInfo {
  businessName: string;
  panVatNumber?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

type FilterType = "ALL" | "EXPIRY" | "LOW_STOCK";

export function CriticalStockReportModal({
  items,
  onClose,
}: {
  items: WatchlistItem[];
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [org, setOrg] = useState<OrganizationInfo>({
    businessName: "PHARMACY MANAGEMENT SYSTEM",
  });

  useEffect(() => {
    setMounted(true);
    api
      .get("/api/organization")
      .then((res) => {
        if (res.data?.organization) {
          setOrg(res.data.organization);
        }
      })
      .catch((err) => console.error("Failed to load org for report:", err));
  }, []);

  const counts = useMemo(() => {
    let expired = 0;
    let nearExpiry = 0;
    let lowStock = 0;
    for (const item of items) {
      if (item.status === "EXPIRED") expired++;
      else if (item.status === "NEAR_EXPIRY") nearExpiry++;
      else if (item.status === "LOW_STOCK") lowStock++;
    }
    return {
      all: items.length,
      expired,
      nearExpiry,
      expiryCombined: expired + nearExpiry,
      lowStock,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    if (filter === "EXPIRY") {
      return items.filter(
        (it) => it.status === "EXPIRED" || it.status === "NEAR_EXPIRY",
      );
    }
    if (filter === "LOW_STOCK") {
      return items.filter((it) => it.status === "LOW_STOCK");
    }
    return items;
  }, [items, filter]);

  const handlePrint = () => {
    const originalTitle = document.title;
    const filterLabel =
      filter === "ALL"
        ? "All-Critical-Items"
        : filter === "EXPIRY"
          ? "Expiry-Watchlist"
          : "Low-Stock-Watchlist";
    const dateStr = new Date().toISOString().slice(0, 10);
    document.title = `${org.businessName.replace(/\s+/g, "_")}_${filterLabel}_${dateStr}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  const handleExportCsv = () => {
    const headers = [
      "S.N.",
      "Product Name",
      "Brand / Manufacturer",
      "Alert Status",
      "Batch Number",
      "Expiry Date",
      "Days Remaining",
      "Available Stock",
      "Unit",
      "Threshold / Received",
      "Supplier",
    ];

    const rows = filteredItems.map((it, idx) => [
      idx + 1,
      `"${(it.name || "").replace(/"/g, '""')}"`,
      `"${(it.manufacturer || "").replace(/"/g, '""')}"`,
      it.status === "EXPIRED"
        ? "Expired"
        : it.status === "NEAR_EXPIRY"
          ? "Near Expiry"
          : "Low Stock",
      `"${(it.batchNumber || "—").replace(/"/g, '""')}"`,
      it.expiryDate || "—",
      it.daysLeft !== undefined && it.daysLeft !== null
        ? it.daysLeft < 0
          ? `Expired (${Math.abs(it.daysLeft)}d ago)`
          : `${it.daysLeft} days`
        : "—",
      it.quantityAvailable,
      it.unit || "—",
      it.quantityReceived ?? "—",
      `"${(it.supplierName || "—").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Critical_Stock_${filter.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!mounted) return null;

  const nowFormatted = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return createPortal(
    <div
      id="critical-stock-report-root"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:static print:bg-white print:overflow-visible"
      onClick={onClose}
    >
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
          }
          /* Hide everything in the page except this modal portal */
          body > *:not(#critical-stock-report-root) {
            display: none !important;
          }
          #critical-stock-report-root {
            display: block !important;
            position: static !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          #critical-stock-report-root * {
            visibility: visible !important;
          }
          .print-hidden-important {
            display: none !important;
          }
          .print-border-solid {
            border: 1px solid #1e293b !important;
          }
          .print-break-avoid {
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div
        className="bg-white border border-slate-300 w-full max-w-5xl max-h-[96vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden print:max-h-none print:shadow-none print:border-none print:w-full print:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar (Hidden when Printing) */}
        <div className="print-hidden-important flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-[#044d73] text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white">
              <AlertTriangle className="h-4 w-4 text-amber-300" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-snug">
                Critical Stock & Expiry Audit Report
              </h3>
              <p className="text-[11px] text-white/75">
                Downloadable PDF / Excel Sheet for physical verification & supplier return
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              type="button"
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              title="Download CSV for Microsoft Excel"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">Export Excel / CSV</span>
            </button>
            <button
              onClick={handlePrint}
              type="button"
              className="flex items-center gap-1.5 rounded-lg bg-white text-[#044d73] hover:bg-slate-100 px-3.5 py-1.5 text-xs font-bold shadow-sm transition-colors cursor-pointer"
              title="Print document or Save as PDF"
            >
              <Printer className="h-4 w-4" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              type="button"
              className="rounded-lg p-1.5 text-white/80 hover:bg-white/15 hover:text-white transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filter Navigation Bar (Hidden when Printing) */}
        <div className="print-hidden-important flex items-center justify-between px-6 py-2.5 bg-slate-50 border-b border-slate-200 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium mr-1">Include:</span>
            <button
              type="button"
              onClick={() => setFilter("ALL")}
              className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                filter === "ALL"
                  ? "bg-[#044d73] text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              All Items ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => setFilter("EXPIRY")}
              className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                filter === "EXPIRY"
                  ? "bg-rose-700 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              Near Expiry & Expired ({counts.expiryCombined})
            </button>
            <button
              type="button"
              onClick={() => setFilter("LOW_STOCK")}
              className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                filter === "LOW_STOCK"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              Low Stock Only ({counts.lowStock})
            </button>
          </div>

          <div className="text-[11px] text-slate-500">
            Showing <strong className="text-slate-800">{filteredItems.length}</strong> items
          </div>
        </div>

        {/* Printable Sheet Viewport */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 font-sans text-slate-900 bg-white print:p-0 print:overflow-visible text-[12px] leading-relaxed">
          {/* Pharmacy Business Header */}
          <div className="text-center border-b-2 border-slate-800 pb-3 mb-4">
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wide text-slate-950">
              {org.businessName}
            </h1>
            {org.address && (
              <p className="text-xs text-slate-700 font-medium mt-0.5">{org.address}</p>
            )}
            <div className="flex items-center justify-center gap-4 text-[11px] text-slate-600 mt-1">
              {org.panVatNumber && (
                <span>
                  <strong>PAN / VAT:</strong> {org.panVatNumber}
                </span>
              )}
              {org.phone && (
                <span>
                  <strong>Tel:</strong> {org.phone}
                </span>
              )}
              {org.email && (
                <span>
                  <strong>Email:</strong> {org.email}
                </span>
              )}
            </div>
            <div className="mt-2.5 inline-block bg-slate-100 text-slate-800 font-extrabold text-xs uppercase px-3 py-1 rounded border border-slate-300 tracking-wider">
              Critical Stock & Expiry Audit Report
            </div>
          </div>

          {/* Report Meta Info & Summary Metric Grid */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs mb-4 text-slate-600 border-b border-slate-100 pb-3">
            <div>
              <span>
                <strong>Generated On:</strong> {nowFormatted}
              </span>
              <span className="mx-2">•</span>
              <span>
                <strong>Scope:</strong>{" "}
                {filter === "ALL"
                  ? "All Monitored Critical Items"
                  : filter === "EXPIRY"
                    ? "Batches Near Expiry or Expired"
                    : "Products at or below Min Stock Level"}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              Total Listed: <strong>{filteredItems.length}</strong>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-4 gap-2.5 mb-5 print-break-avoid">
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Total Listed
              </span>
              <span className="text-base font-black text-slate-800">
                {filteredItems.length}
              </span>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-2 text-center">
              <span className="text-[10px] uppercase font-bold text-rose-700 block">
                Expired Batches
              </span>
              <span className="text-base font-black text-rose-700">
                {counts.expired}
              </span>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2 text-center">
              <span className="text-[10px] uppercase font-bold text-amber-700 block">
                Near Expiry Batches
              </span>
              <span className="text-base font-black text-amber-700">
                {counts.nearExpiry}
              </span>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-2 text-center">
              <span className="text-[10px] uppercase font-bold text-blue-700 block">
                Low Stock Items
              </span>
              <span className="text-base font-black text-blue-700">
                {counts.lowStock}
              </span>
            </div>
          </div>

          {/* Critical Items Table */}
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-500 text-xs">
              No items found matching the selected filter.
            </div>
          ) : (
            <div className="border border-slate-300 rounded-lg overflow-hidden shadow-2xs mb-8">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-300">
                    <th className="py-2 px-2.5 text-center w-10 border-r border-slate-200">#</th>
                    <th className="py-2 px-3 border-r border-slate-200">Medicine / Product</th>
                    <th className="py-2 px-2.5 border-r border-slate-200">Brand / Mfg</th>
                    <th className="py-2 px-2.5 text-center border-r border-slate-200">Status</th>
                    <th className="py-2 px-2.5 border-r border-slate-200">Batch No</th>
                    <th className="py-2 px-2.5 border-r border-slate-200">Expiry Date</th>
                    <th className="py-2 px-2.5 text-right border-r border-slate-200">Available</th>
                    <th className="py-2 px-2.5 text-right border-r border-slate-200">Threshold/Recv</th>
                    <th className="py-2 px-2.5">Supplier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredItems.map((item, idx) => {
                    const isExpired = item.status === "EXPIRED";
                    const isNear = item.status === "NEAR_EXPIRY";
                    const isLow = item.status === "LOW_STOCK";

                    return (
                      <tr
                        key={`${item.name}-${item.batchNumber ?? idx}`}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          idx % 2 === 1 ? "bg-slate-50/40" : "bg-white"
                        }`}
                      >
                        <td className="py-2 px-2.5 text-center text-slate-500 border-r border-slate-200 font-medium">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 font-bold text-slate-900">
                          {item.name}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-200 text-slate-600">
                          {item.manufacturer || "—"}
                        </td>
                        <td className="py-2 px-2.5 text-center border-r border-slate-200">
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${
                              isExpired
                                ? "bg-red-50 text-red-700 border-red-200"
                                : isNear
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            {isExpired
                              ? "Expired"
                              : isNear
                                ? "Near Expiry"
                                : "Low Stock"}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-200 font-mono text-slate-700">
                          {item.batchNumber ? (
                            item.batchNumber
                          ) : (
                            <span className="text-slate-400 italic">All Batches</span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-200 text-slate-700">
                          {item.expiryDate ? (
                            <div>
                              <span>{item.expiryDate}</span>
                              {item.daysLeft !== undefined && item.daysLeft !== null && (
                                <span
                                  className={`block text-[10px] ${
                                    item.daysLeft < 0
                                      ? "text-red-600 font-bold"
                                      : item.daysLeft <= 15
                                        ? "text-amber-700 font-semibold"
                                        : "text-slate-500"
                                  }`}
                                >
                                  {item.daysLeft < 0
                                    ? `Expired ${Math.abs(item.daysLeft)}d ago`
                                    : `${item.daysLeft}d left`}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 text-right border-r border-slate-200 font-bold text-slate-900">
                          {item.quantityAvailable}{" "}
                          <span className="text-[10px] font-normal text-slate-500">
                            {item.unit || ""}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-right border-r border-slate-200 text-slate-600">
                          {item.quantityReceived !== null
                            ? `${item.quantityReceived} ${item.unit || ""}`
                            : "—"}
                        </td>
                        <td className="py-2 px-2.5 text-slate-700 truncate max-w-[140px]">
                          {item.supplierName || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Audit Verification / Sign-off Footer */}
          <div className="pt-6 border-t border-slate-200 flex justify-between items-end text-xs text-slate-600 print-break-avoid">
            <div>
              <p className="font-semibold text-slate-800">Physical Stock Verification Note:</p>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-md">
                Verified against pharmacy shelves. Near-expiry items flagged for supplier exchange
                or early disposal in accordance with DDA / Pharmacy regulations.
              </p>
            </div>
            <div className="flex gap-12 text-center">
              <div>
                <div className="w-36 border-b border-slate-400 mb-1.5 h-10"></div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 block">
                  Verified By (Staff)
                </span>
              </div>
              <div>
                <div className="w-36 border-b border-slate-400 mb-1.5 h-10"></div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 block">
                  Authorized Pharmacist
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
