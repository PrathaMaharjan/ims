"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api-client";
import type { LedgerEntry } from "@/controller/party/ledger";
import type { LedgerEntryDetail } from "@/controller/party/ledger-entry";
import { DotsLoader } from "@/app/pharma/_components/ui/dots-loader";

const money = (n: number) =>
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const TITLES: Record<LedgerEntryDetail["kind"], string> = {
  purchase: "Purchase Invoice",
  sale: "Sale Invoice",
  payment: "Payment Voucher",
  purchaseReturn: "Purchase Return",
  saleReturn: "Sale Return",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-800 break-words">{value || "—"}</p>
    </div>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-6 ${strong ? "font-bold text-slate-900 border-t border-slate-200 pt-1.5 mt-1" : "text-slate-600"}`}>
      <span>{label}</span>
      <span className="font-mono">{money(value)}</span>
    </div>
  );
}

function InvoiceBody({ d }: { d: Extract<LedgerEntryDetail, { kind: "purchase" | "sale" }> }) {
  const t = d.totals;
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Field label="Invoice No" value={d.invoiceNo} />
        <Field label="Date" value={d.date} />
        <Field label="Payment Type" value={d.paymentType.replace("_", " ")} />
        <Field label="Status" value={d.paymentStatus} />
      </div>

      <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr className="text-left">
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Batch</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="px-3 py-2 text-center">VAT</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {d.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center italic text-slate-400">
                  No items
                </td>
              </tr>
            ) : (
              d.items.map((i, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-1.5 font-medium text-slate-800">{i.product}</td>
                  <td className="px-3 py-1.5 text-slate-600">{i.batchNumber || "—"}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-semibold text-slate-900">{i.quantity}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-semibold text-slate-900">{money(i.rate)}</td>
                  <td className="px-3 py-1.5 text-center text-slate-600">{i.vatApplicable ? "Yes" : "No"}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-950">{money(i.lineTotal)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex justify-end">
        <div className="w-full sm:w-72 space-y-1 text-xs">
          <TotalRow label="Subtotal" value={t.subtotal} />
          {t.discount > 0 && <TotalRow label="Discount" value={t.discount} />}
          {t.freight > 0 && <TotalRow label="Freight" value={t.freight} />}
          {t.vat > 0 && <TotalRow label="VAT" value={t.vat} />}
          {t.vatRefund > 0 && <TotalRow label="VAT Refund" value={t.vatRefund} />}
          {t.roundOff !== 0 && <TotalRow label="Round Off" value={t.roundOff} />}
          <TotalRow label="Grand Total" value={t.grandTotal} strong />
          <TotalRow label="Paid" value={t.paid} />
          <TotalRow label="Due" value={t.due} />
        </div>
      </div>

      {d.payments.length > 0 && (
        <div className="mt-5">
          <p className="mb-1.5 text-xs font-semibold text-slate-700">Payments</p>
          <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 text-xs">
            {d.payments.map((p, idx) => (
              <div key={idx} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="text-slate-600">
                  {p.date} · {p.method}
                  {p.reference ? ` (${p.reference})` : ""}
                </span>
                <span className="font-mono font-semibold text-slate-800">{money(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {d.note && <p className="mt-4 text-xs text-slate-500">Note: {d.note}</p>}
    </>
  );
}

function Body({ d }: { d: LedgerEntryDetail }) {
  switch (d.kind) {
    case "purchase":
    case "sale":
      return <InvoiceBody d={d} />;
    case "payment":
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Amount" value={`Rs. ${money(d.amount)}`} />
          <Field label="Date" value={d.date} />
          <Field label="Method" value={d.method} />
          <Field label="Direction" value={d.direction === "PAID_TO_SUPPLIER" ? "Paid to supplier" : "Received from customer"} />
          <Field label="Reference" value={d.reference} />
          <Field label="Against" value={d.against} />
          <div className="col-span-2 sm:col-span-3">
            <Field label="Notes" value={d.notes} />
          </div>
        </div>
      );
    case "purchaseReturn":
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Product" value={d.product} />
          <Field label="Batch" value={d.batchNumber} />
          <Field label="Quantity" value={d.quantity} />
          <Field label="Amount" value={`Rs. ${money(d.amount)}`} />
          <Field label="Date" value={d.date} />
          <Field label="Status" value={d.status} />
          <Field label="Resolution" value={d.resolutionType} />
          <div className="col-span-2">
            <Field label="Reason" value={d.reason} />
          </div>
        </div>
      );
    case "saleReturn":
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Product" value={d.product} />
          <Field label="Batch" value={d.batchNumber} />
          <Field label="Quantity" value={d.quantity} />
          <Field label="Amount" value={`Rs. ${money(d.amount)}`} />
          <Field label="Date" value={d.date} />
          <Field label="Status" value={d.status} />
          <Field label="Sale Invoice" value={d.invoiceNo} />
          <Field label="Restocked" value={d.restocked ? "Yes" : "No"} />
          <div className="col-span-2 sm:col-span-3">
            <Field label="Reason" value={d.reason} />
          </div>
        </div>
      );
  }
}

// Read-only pop-up showing the record behind one ledger row.
export function LedgerEntryModal({
  partyId,
  entry,
  onClose,
}: {
  partyId: string;
  entry: LedgerEntry;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<LedgerEntryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError(null);
    api
      .get(`/api/parties/${partyId}/ledger/entry`, {
        params: { refType: entry.refType, refId: entry.refId },
      })
      .then((res) => {
        if (!cancelled) setDetail(res.data);
      })
      .catch((err) => {
        console.error("Failed to load ledger entry:", err);
        if (!cancelled) setError(err?.response?.data?.error || "Failed to load entry details.");
      });
    return () => {
      cancelled = true;
    };
  }, [partyId, entry.refType, entry.refId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="print:hidden fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-full w-full max-w-3xl flex-col rounded-xl bg-white text-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {detail ? TITLES[detail.kind] : "Entry Details"}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {entry.vchNo} · {entry.englishDate} · {entry.particulars}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm font-medium text-red-700">
              {error}
            </p>
          ) : detail ? (
            <Body d={detail} />
          ) : (
            <div className="py-10 text-center">
              <DotsLoader text="Loading entry..." size="md" />
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
