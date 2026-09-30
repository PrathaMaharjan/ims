import { db } from "@/db";
import {
  parties,
  purchases,
  sales,
  saleItems,
  payments,
  organizations,
  purchaseReturns,
  saleReturns,
  batches,
  products,
} from "@/db/schema";
import { formatBsDate, getFiscalYear } from "@/lib/nepali-date";
import { and, eq, inArray, or } from "drizzle-orm";

export interface LedgerEntry {
  id: string;
  nepaliDate: string;
  englishDate: string;
  rawDate: string;
  type: "Sale" | "Purc" | "SlRt" | "PurRt" | "Jrnl" | "Rcpt" | "Pymt";
  vchNo: string;
  particulars: string;
  debit: number;
  credit: number;
  balance: number;
  balanceType: "Dr" | "Cr";
}

export interface PartyLedgerResult {
  party: {
    id: string;
    name: string;
    partyType: string;
    panVatNumber: string | null;
    phone: string | null;
    address: string | null;
    email: string | null;
  };
  organization: {
    id: string;
    businessName: string;
    panVatNumber: string | null;
    address: string | null;
    phone: string | null;
    fiscalYear: string;
  };
  dateRange: {
    startDate: string | null;
    endDate: string | null;
    startBsDate: string | null;
    endBsDate: string | null;
  };
  openingBalance: {
    amount: number;
    type: "Dr" | "Cr";
  };
  entries: LedgerEntry[];
  summary: {
    totalDebit: number;
    totalCredit: number;
    closingBalance: number;
    closingBalanceType: "Debit Balance" | "Credit Balance";
    grandTotal: number;
  };
}

interface RawTransaction {
  id: string;
  rawDate: string; // YYYY-MM-DD
  createdAt: Date;
  type: "Sale" | "Purc" | "SlRt" | "PurRt" | "Jrnl" | "Rcpt" | "Pymt";
  vchNo: string;
  particulars: string;
  debit: number;
  credit: number;
}

function toStandardISODate(val: unknown): string {
  if (!val) return "";
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return str.slice(0, 10);
}

export async function getPartyLedger(
  organizationId: string,
  partyId: string,
  startDate?: string,
  endDate?: string,
): Promise<PartyLedgerResult> {
  // 1. Fetch Party
  const party = await db.query.parties.findFirst({
    where: and(eq(parties.id, partyId), eq(parties.organizationId, organizationId)),
    columns: {
      id: true,
      name: true,
      partyType: true,
      panVatNumber: true,
      phone: true,
      address: true,
      email: true,
    },
  });

  if (!party) {
    throw new Error("Party not found");
  }

  // 2. Fetch Organization
  const [org] = await db
    .select({
      id: organizations.id,
      businessName: organizations.businessName,
      panVatNumber: organizations.panVatNumber,
      address: organizations.address,
      phone: organizations.phone,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId));

  const fiscalYear = getFiscalYear(new Date());

  // 3. Fetch Sales for this party
  const partySales = await db
    .select({
      id: sales.id,
      invoiceNumber: sales.invoiceNumber,
      grandTotal: sales.grandTotal,
      saleDate: sales.saleDate,
      paymentType: sales.paymentType,
      paymentStatus: sales.paymentStatus,
      createdAt: sales.createdAt,
    })
    .from(sales)
    .where(and(eq(sales.organizationId, organizationId), eq(sales.partyId, partyId)));

  // 4. Fetch Purchases for this party
  const partyPurchases = await db
    .select({
      id: purchases.id,
      supplierInvoiceNumber: purchases.supplierInvoiceNumber,
      grandTotal: purchases.grandTotal,
      purchaseDate: purchases.purchaseDate,
      paymentType: purchases.paymentType,
      paymentStatus: purchases.paymentStatus,
      createdAt: purchases.createdAt,
    })
    .from(purchases)
    .where(and(eq(purchases.organizationId, organizationId), eq(purchases.partyId, partyId)));

  const saleIds = partySales.map((s) => s.id);
  const purchaseIds = partyPurchases.map((p) => p.id);

  // 5. Fetch Payments for this party (both direct party payments and linked invoice payments)
  const paymentConditions = [eq(payments.partyId, partyId)];
  if (saleIds.length > 0) {
    paymentConditions.push(inArray(payments.saleId, saleIds));
  }
  if (purchaseIds.length > 0) {
    paymentConditions.push(inArray(payments.purchaseId, purchaseIds));
  }

  const partyPayments = await db
    .select({
      id: payments.id,
      direction: payments.direction,
      amount: payments.amount,
      paymentDate: payments.paymentDate,
      method: payments.method,
      referenceNumber: payments.referenceNumber,
      notes: payments.notes,
      saleId: payments.saleId,
      purchaseId: payments.purchaseId,
      partyId: payments.partyId,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .where(
      and(
        eq(payments.organizationId, organizationId),
        or(...paymentConditions),
      ),
    );

  // 6. Fetch Completed Purchase Returns for this party
  const partyPurchaseReturns = await db
    .select({
      id: purchaseReturns.id,
      quantity: purchaseReturns.quantity,
      resolutionType: purchaseReturns.resolutionType,
      resolutionAmount: purchaseReturns.resolutionAmount,
      reason: purchaseReturns.reason,
      returnDate: purchaseReturns.returnDate,
      batchNumber: batches.batchNumber,
      purchasePrice: batches.purchasePrice,
      productName: products.name,
      createdAt: purchaseReturns.createdAt,
    })
    .from(purchaseReturns)
    .innerJoin(batches, eq(purchaseReturns.batchId, batches.id))
    .innerJoin(products, eq(batches.productId, products.id))
    .where(
      and(
        eq(purchaseReturns.organizationId, organizationId),
        eq(purchaseReturns.partyId, partyId),
        eq(purchaseReturns.status, "COMPLETED"),
      ),
    );

  // 7. Fetch Completed Sale Returns for this party
  const partySaleReturns = await db
    .select({
      id: saleReturns.id,
      quantity: saleReturns.quantity,
      returnDate: saleReturns.returnDate,
      reason: saleReturns.reason,
      saleInvoiceNumber: sales.invoiceNumber,
      salePrice: saleItems.salePrice,
      batchNumber: batches.batchNumber,
      productName: products.name,
      createdAt: saleReturns.createdAt,
    })
    .from(saleReturns)
    .innerJoin(sales, eq(saleReturns.saleId, sales.id))
    .innerJoin(saleItems, eq(saleReturns.saleItemId, saleItems.id))
    .innerJoin(batches, eq(saleItems.batchId, batches.id))
    .innerJoin(products, eq(saleItems.productId, products.id))
    .where(
      and(
        eq(saleReturns.organizationId, organizationId),
        eq(sales.partyId, partyId),
        eq(saleReturns.status, "COMPLETED"),
      ),
    );

  // 8. Build Raw Transactions List
  const rawList: RawTransaction[] = [];

  // A. Sales entries
  for (const s of partySales) {
    const rawDateStr = toStandardISODate(s.saleDate);
    const saleTotal = Number(s.grandTotal || 0);
    const created = s.createdAt ? new Date(s.createdAt) : new Date(rawDateStr);

    // Debit customer account for the sale invoice
    rawList.push({
      id: s.id,
      rawDate: rawDateStr,
      createdAt: created,
      type: "Sale",
      vchNo: s.invoiceNumber ? `SAL-${String(s.invoiceNumber).padStart(4, "0")}` : `INV-${s.id.slice(0, 6)}`,
      particulars: "Cr Sales",
      debit: saleTotal,
      credit: 0,
    });

    // Check if this sale was settled on the spot (cash/card/transfer/etc.)
    const explicitPayments = partyPayments.filter((pay) => pay.saleId === s.id);
    const isPaidOnSpot =
      explicitPayments.length === 0 &&
      (s.paymentStatus === "PAID" || (s.paymentType !== "CREDIT" && s.paymentStatus !== "PARTIAL" && s.paymentStatus !== "UNPAID"));

    if (isPaidOnSpot && saleTotal > 0) {
      // Immediate payment receipt clears the customer balance (placed right after the invoice)
      const methodLabel = s.paymentType ? s.paymentType.replace("_", " ") : "CASH";
      rawList.push({
        id: `rcpt-${s.id}`,
        rawDate: rawDateStr,
        createdAt: new Date(created.getTime() + 100),
        type: "Rcpt",
        vchNo: s.invoiceNumber ? `RCT-${String(s.invoiceNumber).padStart(4, "0")}` : `RCT-${s.id.slice(0, 6)}`,
        particulars: `Dr ${methodLabel} (Settlement)`,
        debit: 0,
        credit: saleTotal,
      });
    }
  }

  // B. Purchases entries
  for (const p of partyPurchases) {
    const rawDateStr = toStandardISODate(p.purchaseDate);
    const purchaseTotal = Number(p.grandTotal || 0);
    const created = p.createdAt ? new Date(p.createdAt) : new Date(rawDateStr);

    // Credit supplier account for the purchase bill
    rawList.push({
      id: p.id,
      rawDate: rawDateStr,
      createdAt: created,
      type: "Purc",
      vchNo: p.supplierInvoiceNumber || `PUR-${p.id.slice(0, 6)}`,
      particulars: "Dr Purchase",
      debit: 0,
      credit: purchaseTotal,
    });

    // Check if this purchase was settled on the spot (cash/card/transfer/etc.)
    const explicitPayments = partyPayments.filter((pay) => pay.purchaseId === p.id);
    const isPaidOnSpot =
      explicitPayments.length === 0 &&
      (p.paymentStatus === "PAID" || (p.paymentType !== "CREDIT" && p.paymentStatus !== "PARTIAL" && p.paymentStatus !== "UNPAID"));

    if (isPaidOnSpot && purchaseTotal > 0) {
      // Immediate payment voucher clears the supplier balance (placed right after the bill)
      const methodLabel = p.paymentType ? p.paymentType.replace("_", " ") : "CASH";
      rawList.push({
        id: `pmt-${p.id}`,
        rawDate: rawDateStr,
        createdAt: new Date(created.getTime() + 100),
        type: "Pymt",
        vchNo: `PMT-${p.supplierInvoiceNumber || p.id.slice(0, 6)}`,
        particulars: `Cr ${methodLabel} (Settlement)`,
        debit: purchaseTotal,
        credit: 0,
      });
    }
  }

  // C. Explicit Payment Vouchers from payments table
  for (const pay of partyPayments) {
    const rawDateStr = toStandardISODate(pay.paymentDate);
    const methodStr = pay.method ? pay.method.replace("_", " ").toUpperCase() : "CASH/BANK";
    const refStr = pay.referenceNumber ? ` (${pay.referenceNumber})` : "";
    const noteStr = pay.notes ? ` · ${pay.notes}` : "";
    const created = pay.createdAt ? new Date(pay.createdAt) : new Date(rawDateStr);

    if (pay.direction === "RECEIVED_FROM_CUSTOMER") {
      // Money received from customer (credits customer's receivable balance)
      rawList.push({
        id: pay.id,
        rawDate: rawDateStr,
        createdAt: created,
        type: "Rcpt",
        vchNo: pay.referenceNumber || `RCT-${pay.id.slice(0, 6).toUpperCase()}`,
        particulars: `Dr ${methodStr}${refStr}${noteStr}`,
        debit: 0,
        credit: Number(pay.amount || 0),
      });
    } else {
      // Money paid to supplier (debits supplier's payable balance)
      rawList.push({
        id: pay.id,
        rawDate: rawDateStr,
        createdAt: created,
        type: "Pymt",
        vchNo: pay.referenceNumber || `PMT-${pay.id.slice(0, 6).toUpperCase()}`,
        particulars: `Cr ${methodStr}${refStr}${noteStr}`,
        debit: Number(pay.amount || 0),
        credit: 0,
      });
    }
  }

  // D. Purchase Returns (PurRt) — debits supplier's account (reduces payable)
  for (const ret of partyPurchaseReturns) {
    const rawDateStr = toStandardISODate(ret.returnDate);
    const resAmount = Number(ret.resolutionAmount || 0);
    const calculatedAmount = Number(ret.quantity || 0) * Number(ret.purchasePrice || 0);
    const amount = resAmount > 0 ? resAmount : calculatedAmount;

    if (amount <= 0) continue;

    const batchPart = ret.batchNumber ? `Batch: ${ret.batchNumber}` : "";
    const qtyPart = ret.quantity ? `Qty: ${ret.quantity}` : "";
    const details = [batchPart, qtyPart].filter(Boolean).join(", ");
    const particulars = details
      ? `Pur Return: ${ret.productName} (${details})`
      : `Pur Return: ${ret.productName}`;
    const created = ret.createdAt ? new Date(ret.createdAt) : new Date(rawDateStr);

    rawList.push({
      id: ret.id,
      rawDate: rawDateStr,
      createdAt: created,
      type: "PurRt",
      vchNo: `PRT-${ret.id.slice(0, 6).toUpperCase()}`,
      particulars,
      debit: amount,
      credit: 0,
    });
  }

  // E. Sale Returns (SlRt) — credits customer's account (reduces receivable)
  for (const sr of partySaleReturns) {
    const rawDateStr = toStandardISODate(sr.returnDate);
    const amount = Number(sr.quantity || 0) * Number(sr.salePrice || 0);

    if (amount <= 0) continue;

    const batchPart = sr.batchNumber ? `Batch: ${sr.batchNumber}` : "";
    const qtyPart = sr.quantity ? `Qty: ${sr.quantity}` : "";
    const details = [batchPart, qtyPart].filter(Boolean).join(", ");
    const particulars = details
      ? `Sale Return: ${sr.productName} (${details})`
      : `Sale Return: ${sr.productName}`;
    const created = sr.createdAt ? new Date(sr.createdAt) : new Date(rawDateStr);

    rawList.push({
      id: sr.id,
      rawDate: rawDateStr,
      createdAt: created,
      type: "SlRt",
      vchNo: sr.saleInvoiceNumber ? `SR-${sr.saleInvoiceNumber}` : `SR-${sr.id.slice(0, 6).toUpperCase()}`,
      particulars,
      debit: 0,
      credit: amount,
    });
  }

  // Sort chronologically exactly as data came in:
  // 1. By transaction date (rawDate)
  // 2. By creation timestamp (createdAt) - preserves the exact sequence of entry
  // 3. Invoices precede their spot settlements if timestamps are identical
  rawList.sort((a, b) => {
    if (a.rawDate !== b.rawDate) {
      return a.rawDate < b.rawDate ? -1 : 1;
    }
    const timeA = a.createdAt.getTime();
    const timeB = b.createdAt.getTime();
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    const isInvA = a.type === "Sale" || a.type === "Purc" ? 1 : 2;
    const isInvB = b.type === "Sale" || b.type === "Purc" ? 1 : 2;
    return isInvA - isInvB;
  });

  // 7. Calculate Opening Balance (prior to startDate) & Active Entries
  let openingDebit = 0;
  let openingCredit = 0;
  const activeRawList: RawTransaction[] = [];

  const startFilter = startDate && startDate.trim() !== "" ? startDate.trim() : null;
  const endFilter = endDate && endDate.trim() !== "" ? endDate.trim() : null;

  for (const item of rawList) {
    if (startFilter && item.rawDate < startFilter) {
      openingDebit += item.debit;
      openingCredit += item.credit;
    } else if (endFilter && item.rawDate > endFilter) {
      // after end date, exclude from current statement
      continue;
    } else {
      activeRawList.push(item);
    }
  }

  const openingAmount = openingDebit - openingCredit;
  const openingType: "Dr" | "Cr" = openingAmount >= 0 ? "Dr" : "Cr";

  // 8. Compute Running Balance for active entries
  let currentBalance = openingAmount;
  const entries: LedgerEntry[] = activeRawList.map((item) => {
    currentBalance = currentBalance + item.debit - item.credit;
    const balanceType: "Dr" | "Cr" = currentBalance >= 0 ? "Dr" : "Cr";

    const d = new Date(item.rawDate + "T00:00:00");
    const engFormatted = isNaN(d.getTime()) ? item.rawDate : `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    const nepaliDateStr = isNaN(d.getTime()) ? item.rawDate : formatBsDate(d);

    return {
      id: item.id,
      nepaliDate: nepaliDateStr,
      englishDate: engFormatted,
      rawDate: item.rawDate,
      type: item.type,
      vchNo: item.vchNo,
      particulars: item.particulars,
      debit: item.debit,
      credit: item.credit,
      balance: Math.abs(currentBalance),
      balanceType,
    };
  });

  // 9. Summary Calculations
  const periodDebits = activeRawList.reduce((acc, curr) => acc + curr.debit, 0);
  const periodCredits = activeRawList.reduce((acc, curr) => acc + curr.credit, 0);

  // If opening balance > 0 (Dr), it adds to the Debit side total
  // If opening balance < 0 (Cr), it adds to the Credit side total
  const totalDebit = periodDebits + (openingAmount > 0 ? openingAmount : 0);
  const totalCredit = periodCredits + (openingAmount < 0 ? Math.abs(openingAmount) : 0);

  const closingBalance = currentBalance;
  const closingBalanceType = closingBalance >= 0 ? "Debit Balance" : "Credit Balance";
  const grandTotal = Math.max(totalDebit, totalCredit);

  return {
    party: {
      id: party.id,
      name: party.name,
      partyType: party.partyType,
      panVatNumber: party.panVatNumber,
      phone: party.phone,
      address: party.address,
      email: party.email,
    },
    organization: {
      id: org?.id ?? organizationId,
      businessName: org?.businessName ?? "Pharmacy",
      panVatNumber: org?.panVatNumber ?? null,
      address: org?.address ?? null,
      phone: org?.phone ?? null,
      fiscalYear,
    },
    dateRange: {
      startDate: startFilter,
      endDate: endFilter,
      startBsDate: startFilter ? formatBsDate(new Date(startFilter + "T00:00:00")) : null,
      endBsDate: endFilter ? formatBsDate(new Date(endFilter + "T00:00:00")) : null,
    },
    openingBalance: {
      amount: Math.abs(openingAmount),
      type: openingType,
    },
    entries,
    summary: {
      totalDebit: Number(totalDebit.toFixed(2)),
      totalCredit: Number(totalCredit.toFixed(2)),
      closingBalance: Number(Math.abs(closingBalance).toFixed(2)),
      closingBalanceType,
      grandTotal: Number(grandTotal.toFixed(2)),
    },
  };
}
