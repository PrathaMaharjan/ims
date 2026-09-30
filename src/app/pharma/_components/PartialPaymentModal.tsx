"use client";

import React, { useState, useEffect } from "react";
import { X, Receipt, AlertCircle } from "lucide-react";

interface PartialPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber: string;
  partyName?: string;
  totalAmount: number;
  direction?: "CUSTOMER" | "SUPPLIER";
  onConfirm: (data: {
    amount: number;
    method: string;
    paymentDate: string;
    referenceNumber?: string;
    notes?: string;
  }) => Promise<void>;
}

export function PartialPaymentModal({
  isOpen,
  onClose,
  invoiceNumber,
  partyName,
  totalAmount,
  direction = "CUSTOMER",
  onConfirm,
}: PartialPaymentModalProps) {
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<string>("CASH");
  const [paymentDate, setPaymentDate] = useState<string>("");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setMethod("CASH");
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setReferenceNumber("");
      setNotes("");
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const numAmount = parseFloat(amount) || 0;
  const remaining = Math.max(0, totalAmount - numAmount);
  const isOverpaid = numAmount > totalAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) {
      setError("Please enter a valid partial payment amount.");
      return;
    }
    if (numAmount > totalAmount) {
      setError(`Amount cannot exceed the total bill of Rs. ${totalAmount.toFixed(2)}.`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onConfirm({
        amount: numAmount,
        method,
        paymentDate: paymentDate || new Date().toISOString().slice(0, 10),
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      console.error("Failed to record partial payment:", err);
      setError(err instanceof Error ? err.message : "Failed to record partial payment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-slate-100 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - matching app style */}
        <div className="relative flex items-center justify-between bg-[#044d73] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-white">Record Partial Payment</h2>
              <p className="text-xs text-white/80">
                {invoiceNumber} {partyName ? `· ${partyName}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {/* Summary Row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Bill</p>
                <p className="text-sm sm:text-base font-bold text-slate-800 mt-1 font-mono">
                  Rs. {totalAmount.toFixed(2)}
                </p>
              </div>
              <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-lg p-3">
                <p className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider">
                  {direction === "CUSTOMER" ? "Paying" : "Paid"}
                </p>
                <p className="text-sm sm:text-base font-bold text-emerald-800 mt-1 font-mono">
                  Rs. {numAmount > 0 ? numAmount.toFixed(2) : "0.00"}
                </p>
              </div>
              <div className="bg-amber-50/70 border border-amber-200/70 rounded-lg p-3">
                <p className="text-[11px] font-medium text-amber-700 uppercase tracking-wider">Remaining</p>
                <p className="text-sm sm:text-base font-bold text-amber-900 mt-1 font-mono">
                  Rs. {remaining.toFixed(2)}
                </p>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Amount Input */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                {direction === "CUSTOMER" ? "Amount Received (Rs.)" : "Amount Paid (Rs.)"}
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={totalAmount}
                autoFocus
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (error) setError(null);
                }}
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 font-mono transition-colors focus:outline-none focus:ring-1 ${
                  isOverpaid
                    ? "border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50/20"
                    : "border-slate-200 focus:border-[#044d73] focus:ring-[#044d73]"
                }`}
              />
            </div>

            {/* Payment Method & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  Payment Method
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="MOBILE_PAYMENT">Mobile Payment (Fonepay/eSewa)</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                />
              </div>
            </div>

            {/* Reference Number & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  Reference / Transaction ID
                </label>
                <input
                  type="text"
                  placeholder="Cheque # / Txn ID (Optional)"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional note"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                />
              </div>
            </div>
          </div>

          {/* Modal Footer - matching other modals */}
          <div className="flex shrink-0 gap-3 border-t border-slate-100 bg-white p-4 sm:p-5 px-6">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || numAmount <= 0 || isOverpaid}
              className="flex-1 rounded-lg bg-[#044d73] hover:bg-[#033f60] py-2.5 text-sm font-medium text-white shadow-sm transition-colors disabled:opacity-40"
            >
              {loading ? "Saving..." : "Save Partial Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
