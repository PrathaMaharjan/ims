"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { formatBsDate } from "@/lib/nepali-date";
import { numberToWords } from "@/lib/number-to-words";
import { api } from "@/lib/api-client";

export interface InvoiceItem {
  sn: number;
  itemCode?: string;
  hsNo?: string;
  name: string;
  company?: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  batchNumber?: string;
  expiryDate?: string;
}

export interface TaxInvoiceData {
  type: "SALE" | "PURCHASE";
  invoiceNumber: string;
  date: string; // YYYY-MM-DD
  partyName: string;
  partyAddress?: string;
  partyPan?: string;
  partyPhone?: string;
  paymentType: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  freightCharges?: number;
  vatRefund?: number;
  taxableAmount?: number;
  nonTaxableAmount?: number;
  vatAmount: number;
  roundOff?: number;
  grandTotal: number;
}

interface OrganizationInfo {
  businessName: string;
  panVatNumber?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export function TaxInvoiceModal({
  data,
  onClose,
}: {
  data: TaxInvoiceData;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
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
      .catch((err) => console.error("Failed to load org for invoice:", err));
  }, []);

  const cleanDate = (data.date || "").split("T")[0].split(" ")[0];
  const nepaliDateStr = cleanDate ? formatBsDate(new Date(cleanDate)) : "";

  const formatRs = (val: number | undefined) => {
    return Number(val || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `${data.type === "SALE" ? "Tax-Invoice" : "Purchase-Voucher"}-${data.invoiceNumber}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  const isSale = data.type === "SALE";
  const titleLabel = isSale ? "<< TAX INVOICE >>" : "<< PURCHASE VOUCHER >>";
  const partyLabel = isSale ? "Customer's Name" : "Supplier's Name";
  const partyAddrLabel = isSale ? "Customer's Address" : "Supplier's Address";
  const partyPanLabel = isSale ? "Buyer's PAN No." : "Seller's PAN No.";

  const taxable = data.taxableAmount ?? (data.vatAmount > 0 ? Math.max(0, data.subtotal - data.discount) : 0);
  const nonTaxable = data.nonTaxableAmount ?? (data.vatAmount === 0 ? Math.max(0, data.subtotal - data.discount) : 0);

  if (!mounted) return null;

  return createPortal(
    <div
      id="tax-invoice-print-root"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:static print:bg-white print:overflow-visible"
      onClick={onClose}
    >
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
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
          body > *:not(#tax-invoice-print-root) {
            display: none !important;
          }
          #tax-invoice-print-root {
            display: block !important;
            position: static !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          #tax-invoice-print-root * {
            visibility: visible !important;
          }
          .print-hidden-important {
            display: none !important;
          }
        }
      `}</style>
      <div
        className="bg-white border border-slate-300 w-full max-w-4xl max-h-[96vh] flex flex-col rounded-xl shadow-2xl overflow-hidden print:max-h-none print:shadow-none print:border-none print:w-full print:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Controls (Hidden when Printing) */}
        <div className="print-hidden-important flex items-center justify-between px-5 py-3 bg-[#044d73] text-white shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">
              {isSale ? "Tax Invoice Preview" : "Purchase Voucher Preview"} — #{data.invoiceNumber}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="flex items-center gap-1.5 rounded-lg bg-white text-[#044d73] hover:bg-slate-100 px-3.5 py-1.5 text-xs font-bold shadow-sm transition-colors"
            >
              <Printer className="h-4 w-4" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              onClick={onClose}
              type="button"
              className="rounded-lg p-1 text-white/80 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* The Printable Invoice Sheet matching user photo */}
        <div
          id="printable-tax-invoice"
          className="flex-1 overflow-y-auto p-6 sm:p-8 font-sans text-slate-950 bg-white print:p-0 print:overflow-visible text-[11px] leading-tight"
        >
          {/* Header Row: PAN and Copy Label */}
          <div className="flex items-center justify-between text-xs font-bold mb-1">
            <span>PAN : {org.panVatNumber || "—"}</span>

          </div>

          {/* Business Header */}
          <div className="text-center space-y-0.5 border-b border-slate-950 pb-2 mb-2">
            <p className="font-bold text-xs tracking-wider">{titleLabel}</p>
            <h1 className="text-lg sm:text-xl font-extrabold uppercase tracking-wide">
              {org.businessName}
            </h1>
            {org.address && <p className="text-xs text-slate-700">{org.address}</p>}
            <p className="text-[10px] text-slate-600">
              {org.phone && <span>Tel. : {org.phone} </span>}
              {org.email && <span>email : {org.email}</span>}
            </p>
          </div>

          {/* Party and Invoice Metadata Grid */}
          <div className="border border-slate-950 p-2.5 mb-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="space-y-0.5">
              <div className="flex">
                <span className="w-32 shrink-0 font-medium text-slate-600">{partyLabel}</span>
                <span className="font-bold uppercase">: {data.partyName}</span>
              </div>
              <div className="flex">
                <span className="w-32 shrink-0 font-medium text-slate-600">{partyAddrLabel}</span>
                <span>: {data.partyAddress || "—"}</span>
              </div>
              <div className="flex">
                <span className="w-32 shrink-0 font-medium text-slate-600">{partyPanLabel}</span>
                <span className="font-mono">: {data.partyPan || "—"}</span>
              </div>
              <div className="flex">
                <span className="w-32 shrink-0 font-medium text-slate-600">Mobile No.</span>
                <span className="font-mono">: {data.partyPhone || "—"}</span>
              </div>
              <div className="flex">
                <span className="w-32 shrink-0 font-medium text-slate-600">Mode of Payment</span>
                <span className="font-bold uppercase">: {data.paymentType}</span>
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="flex">
                <span className="w-32 shrink-0 font-medium text-slate-600">Invoice No.</span>
                <span className="font-bold font-mono">: {data.invoiceNumber}</span>
              </div>
              <div className="flex">
                <span className="w-32 shrink-0 font-medium text-slate-600">Challan No.</span>
                <span>: </span>
              </div>
              <div className="flex">
                <span className="w-32 shrink-0 font-medium text-slate-600">Challan Miti</span>
                <span>: </span>
              </div>
              <div className="flex">
                <span className="w-32 shrink-0 font-medium text-slate-600">Invoice Date</span>
                <span className="font-bold font-mono">: {nepaliDateStr} ({cleanDate})</span>
              </div>
              <div className="flex">
                <span className="w-32 shrink-0 font-medium text-slate-600">Transaction Date</span>
                <span className="font-mono">: {nepaliDateStr}</span>
              </div>
            </div>
          </div>

          {/* Items Table with long continuous columns */}
          <div className="border border-slate-950 min-h-[320px] sm:min-h-[360px] print:min-h-[340px] flex flex-col mb-2">
            <table className="w-full h-full flex-1 text-left border-collapse text-[10px] sm:text-[11px]">
              <thead>
                <tr className="border-b border-slate-950 font-bold bg-slate-50 text-slate-900">
                  <th className="py-1.5 px-2 w-8 text-center border-r border-slate-950">S.N.</th>
                  <th className="py-1.5 px-2 w-20 border-r border-slate-950">Item Code</th>
                  <th className="py-1.5 px-2 w-16 border-r border-slate-950">HS No</th>
                  <th className="py-1.5 px-3 border-r border-slate-950">Description</th>
                  <th className="py-1.5 px-2 w-24 border-r border-slate-950">Company</th>
                  <th className="py-1.5 px-2 w-16 text-right border-r border-slate-950">Quantity</th>
                  <th className="py-1.5 px-2 w-12 text-center border-r border-slate-950">Unit</th>
                  <th className="py-1.5 px-2 w-20 text-right border-r border-slate-950">Rate</th>
                  <th className="py-1.5 px-2 w-24 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.items.map((it, idx) => (
                  <tr key={idx} className="align-top">
                    <td className="py-1.5 px-2 text-center border-r border-slate-950 text-slate-600">
                      {it.sn}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-950 font-mono text-[10px]">
                      {it.itemCode || "—"}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-950 font-mono text-[10px]">
                      {it.hsNo || "—"}
                    </td>
                    <td className="py-1.5 px-3 border-r border-slate-950">
                      <div className="font-semibold text-slate-950">{it.name}</div>
                      {(it.batchNumber || it.expiryDate) && (
                        <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                          {it.batchNumber && <span>B: {it.batchNumber} </span>}
                          {it.expiryDate && <span>Exp: {it.expiryDate}</span>}
                        </div>
                      )}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-950 text-slate-700">
                      {it.company || "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right border-r border-slate-950 font-mono font-semibold">
                      {it.quantity.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-2 text-center border-r border-slate-950 text-slate-600">
                      {it.unit}
                    </td>
                    <td className="py-1.5 px-2 text-right border-r border-slate-950 font-mono">
                      {formatRs(it.rate)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold">
                      {formatRs(it.amount)}
                    </td>
                  </tr>
                ))}
                {/* Spacer row to stretch the vertical columns all the way down */}
                <tr className="h-full">
                  <td className="border-r border-slate-950 p-0">&nbsp;</td>
                  <td className="border-r border-slate-950 p-0">&nbsp;</td>
                  <td className="border-r border-slate-950 p-0">&nbsp;</td>
                  <td className="border-r border-slate-950 p-0">&nbsp;</td>
                  <td className="border-r border-slate-950 p-0">&nbsp;</td>
                  <td className="border-r border-slate-950 p-0">&nbsp;</td>
                  <td className="border-r border-slate-950 p-0">&nbsp;</td>
                  <td className="border-r border-slate-950 p-0">&nbsp;</td>
                  <td className="p-0">&nbsp;</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Bottom Totals & Calculations Grid */}
          <div className="border border-slate-950 grid grid-cols-1 sm:grid-cols-12 mb-3 text-xs">
            {/* Left box: Amount in words & Bank info */}
            <div className="sm:col-span-7 p-2.5 border-b sm:border-b-0 sm:border-r border-slate-950 flex flex-col justify-between space-y-3">
              <div>
                <span className="font-bold text-slate-700 block mb-1">Amount In Words:</span>
                <p className="font-bold text-slate-950 italic text-[11px] leading-snug">
                  {numberToWords(data.grandTotal)}
                </p>
              </div>

              <div className="text-[10px] text-slate-600 space-y-0.5 pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-700 block">Bank Account Details:</span>
                <p>ACCOUNT NAME: {org.businessName.toUpperCase()}</p>
                {org.panVatNumber && <p>PAN / VAT: {org.panVatNumber}</p>}
              </div>
            </div>

            {/* Right box: Tax Calculations */}
            <div className="sm:col-span-5 p-2.5 space-y-1 font-mono text-xs">
              <div className="flex justify-between">
                <span className="font-sans text-slate-700">Total Amount</span>
                <span className="font-semibold">{formatRs(data.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-700">Discount</span>
                <span>{formatRs(data.discount)}</span>
              </div>
              {data.freightCharges !== undefined && (
                <div className="flex justify-between">
                  <span className="font-sans text-slate-700">Freight Charges</span>
                  <span>{formatRs(data.freightCharges)}</span>
                </div>
              )}
              {data.vatRefund !== undefined && Number(data.vatRefund) > 0 && (
                <div className="flex justify-between">
                  <span className="font-sans text-slate-700">VAT Refund</span>
                  <span>- {formatRs(data.vatRefund)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-sans text-slate-700">Non-Taxable Amount</span>
                <span>{formatRs(nonTaxable)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-700">Taxable Amount</span>
                <span>{formatRs(taxable)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-700">13% VAT</span>
                <span>{formatRs(data.vatAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-700">Round Off (+/-)</span>
                <span>{formatRs(data.roundOff || 0)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-950 pt-1.5 font-bold text-sm text-slate-950">
                <span className="font-sans uppercase">GRAND AMOUNT</span>
                <span className="underline underline-offset-2">{formatRs(data.grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Footer Signatures matching photo */}
          <div className="flex justify-between items-end pt-10 text-[11px] text-center text-slate-800">
            <div className="w-24 sm:w-28 border-t border-slate-900 pt-1">Delivered By</div>
            <div className="w-24 sm:w-28 border-t border-slate-900 pt-1">Received By</div>
            <div className="w-24 sm:w-28 border-t border-slate-900 pt-1">Checked By</div>
            <div className="w-24 sm:w-28 border-t border-slate-900 pt-1">Prepared By
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
