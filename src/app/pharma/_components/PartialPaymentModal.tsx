"use client";

import React, { useState, useEffect } from "react";
import { X, Receipt, AlertCircle, CheckCircle2, History, CreditCard } from "lucide-react";

export interface PaymentRecordItem {
  id: string;
  amount: string | number;
  paymentDate: string;
  method?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
  createdAt?: string;
}

interface PartialPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber: string;
  partyName?: string;
  totalAmount: number;
  alreadyPaid?: number;
  initialAmount?: number;
  existingPayments?: PaymentRecordItem[];
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
  alreadyPaid = 0,
  initialAmount,
  existingPayments = [],
  direction = "CUSTOMER",
  onConfirm,
}: PartialPaymentModalProps) {
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<string>("CASH");
  const [paymentDate, setPaymentDate] = useState<string>("");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const paidSoFar = Math.max(0, alreadyPaid);
  const currentDue = Math.max(0, totalAmount - paidSoFar);

  useEffect(() => {
    if (isOpen) {
      const defaultAmt = initialAmount !== undefined && initialAmount > 0
        ? initialAmount
        : currentDue > 0
        ? currentDue
        : totalAmount;

      setAmount(defaultAmt > 0 ? defaultAmt.toFixed(2) : "");
      setMethod("CASH");
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setReferenceNumber("");
      setNotes("");
      setShowHistory(false);
      setError(null);
      setLoading(false);
    }
  }, [isOpen, initialAmount, currentDue, totalAmount]);

  if (!isOpen) return null;

  const numAmount = parseFloat(amount) || 0;
  const isSettlingRemaining = currentDue > 0 && Math.abs(numAmount - currentDue) <= 0.01;
  const isOverpaid = numAmount > currentDue + 0.01;
  const remainingAfter = Math.max(0, currentDue - numAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) {
      setError("Please enter a valid payment amount greater than zero.");
      return;
    }
    if (isOverpaid) {
      setError(`Amount cannot exceed the remaining balance of Rs. ${currentDue.toFixed(2)}.`);
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
      console.error("Failed to record payment:", err);
      setError(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex items-center justify-between bg-[#044d73] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-white">
                {paidSoFar > 0 ? "Pay Remaining / Installment" : "Record Payment"}
              </h2>
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
          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Financial Summary Cards */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total Bill</p>
                <p className="text-sm sm:text-base font-bold text-slate-800 mt-1 font-mono">
                  Rs. {totalAmount.toFixed(2)}
                </p>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">
                  {paidSoFar > 0 ? "Already Paid" : "Paid So Far"}
                </p>
                <p className="text-sm sm:text-base font-bold text-emerald-800 mt-1 font-mono">
                  Rs. {paidSoFar.toFixed(2)}
                </p>
              </div>

              <div className="bg-amber-50/70 border border-amber-200/70 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider">Balance Due</p>
                <p className="text-sm sm:text-base font-bold text-amber-900 mt-1 font-mono">
                  Rs. {currentDue.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Dynamic settlement projection pill */}
            <div className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <span className="text-slate-600 font-medium">
                Paying now: <span className="font-bold text-slate-800 font-mono">Rs. {numAmount.toFixed(2)}</span>
              </span>
              <span className="text-slate-600 font-medium">
                Remaining after:{" "}
                {remainingAfter <= 0.01 && numAmount > 0 ? (
                  <span className="font-bold text-emerald-700 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Fully Settled
                  </span>
                ) : (
                  <span className="font-bold text-amber-700 font-mono">Rs. {remainingAfter.toFixed(2)}</span>
                )}
              </span>
            </div>

            {/* Past Payments Toggle / List */}
            {existingPayments && existingPayments.length > 0 && (
              <div className="rounded-xl border border-slate-200/80 overflow-hidden bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100/60 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-[#044d73]" />
                    Previous Payments ({existingPayments.length})
                  </span>
                  <span className="text-[#044d73] text-[11px]">
                    {showHistory ? "Hide" : "Show details"}
                  </span>
                </button>
                {showHistory && (
                  <div className="px-3.5 pb-2.5 space-y-1.5 border-t border-slate-200/60 pt-2 text-xs">
                    {existingPayments.map((p, idx) => (
                      <div
                        key={p.id || idx}
                        className="flex items-center justify-between text-[11px] bg-white p-2 rounded-lg border border-slate-100"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-700">#{idx + 1}</span>
                          <span className="text-slate-500">{p.paymentDate}</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.2 font-medium text-slate-600">
                            {p.method?.replace("_", " ") || "CASH"}
                          </span>
                          {p.referenceNumber && (
                            <span className="text-slate-400">Ref: {p.referenceNumber}</span>
                          )}
                        </div>
                        <span className="font-bold text-emerald-700 font-mono">
                          Rs. {Number(p.amount).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Amount Input with Quick Action */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-700">
                  {direction === "CUSTOMER" ? "Amount Received (Rs.)" : "Amount Paid (Rs.)"}
                  <span className="text-red-500 ml-0.5">*</span>
                </label>
                {currentDue > 0 && Math.abs(numAmount - currentDue) > 0.01 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAmount(currentDue.toFixed(2));
                      if (error) setError(null);
                    }}
                    className="text-[11px] font-semibold text-[#044d73] hover:text-[#033f60] bg-[#044d73]/10 hover:bg-[#044d73]/20 px-2 py-0.5 rounded-md transition-colors"
                  >
                    Pay Full Due (Rs. {currentDue.toFixed(2)})
                  </button>
                )}
              </div>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={currentDue > 0 ? currentDue : totalAmount}
                autoFocus
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (error) setError(null);
                }}
                className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 font-mono transition-colors focus:outline-none focus:ring-2 ${
                  isOverpaid
                    ? "border-red-300 focus:border-red-500 focus:ring-red-100 bg-red-50/20"
                    : "border-slate-200 focus:border-[#044d73] focus:ring-[#044d73]/20"
                }`}
              />
              <p className="text-[11px] text-slate-500">
                Max payable for this bill:{" "}
                <span className="font-semibold text-slate-700 font-mono">
                  Rs. {currentDue.toFixed(2)}
                </span>
              </p>
            </div>

            {/* Payment Method & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  Payment Method
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-[#044d73] focus:outline-none focus:ring-2 focus:ring-[#044d73]/20"
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
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-[#044d73] focus:outline-none focus:ring-2 focus:ring-[#044d73]/20"
                />
              </div>
            </div>

            {/* Reference Number & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  Reference / Transaction ID
                </label>
                <input
                  type="text"
                  placeholder="Cheque # / Txn ID (Optional)"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-2 focus:ring-[#044d73]/20"
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
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-2 focus:ring-[#044d73]/20"
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex shrink-0 gap-3 border-t border-slate-100 bg-slate-50/50 p-4 sm:p-5 px-6">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || numAmount <= 0 || isOverpaid}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 ${
                isSettlingRemaining
                  ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                  : "bg-[#044d73] hover:bg-[#033f60] shadow-[#044d73]/20"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              {loading
                ? "Processing..."
                : isSettlingRemaining
                ? `Pay Remaining & Mark Paid (Rs. ${numAmount.toFixed(2)})`
                : `Save Payment (Rs. ${numAmount > 0 ? numAmount.toFixed(2) : "0.00"})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
