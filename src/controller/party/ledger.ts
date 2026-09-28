import { db } from "@/db";
import { parties, purchases, sales, payments, organizations } from "@/db/schema";
import { formatBsDate, getFiscalYear } from "@/lib/nepali-date";
import { and, eq } from "drizzle-orm";

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
  type: "Sale" | "Purc" | "Jrnl" | "Rcpt" | "Pymt";
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
    })
    .from(purchases)
    .where(and(eq(purchases.organizationId, organizationId), eq(purchases.partyId, partyId)));

  // 5. Fetch Payments for this party
  const partyPayments = await db
    .select({
      id: payments.id,
      direction: payments.direction,
      amount: payments.amount,
      paymentDate: payments.paymentDate,
      method: payments.method,
      referenceNumber: payments.referenceNumber,
      notes: payments.notes,
    })
    .from(payments)
    .where(and(eq(payments.organizationId, organizationId), eq(payments.partyId, partyId)));

  // 6. Build Raw Transactions
  const rawList: RawTransaction[] = [];

  for (const s of partySales) {
    const rawDateStr = toStandardISODate(s.saleDate);
    rawList.push({
      id: s.id,
      rawDate: rawDateStr,
      type: "Sale",
      vchNo: s.invoiceNumber ? `SAL-${String(s.invoiceNumber).padStart(4, "0")}` : `INV-${s.id.slice(0, 6)}`,
      particulars: "Cr Sales",
      debit: Number(s.grandTotal || 0),
      credit: 0,
    });
  }

  for (const p of partyPurchases) {
    const rawDateStr = toStandardISODate(p.purchaseDate);
    rawList.push({
      id: p.id,
      rawDate: rawDateStr,
      type: "Purc",
      vchNo: p.supplierInvoiceNumber || `PUR-${p.id.slice(0, 6)}`,
      particulars: "Dr Purchase",
      debit: 0,
      credit: Number(p.grandTotal || 0),
    });
  }

  for (const pay of partyPayments) {
    const rawDateStr = toStandardISODate(pay.paymentDate);
    const methodStr = pay.method ? pay.method.toUpperCase() : "CASH/BANK";
    const refStr = pay.referenceNumber ? ` (${pay.referenceNumber})` : "";
    const noteStr = pay.notes ? ` · ${pay.notes}` : "";

    if (pay.direction === "RECEIVED_FROM_CUSTOMER") {
      // Money received from party (credits party's debt)
      rawList.push({
        id: pay.id,
        rawDate: rawDateStr,
        type: "Jrnl",
        vchNo: pay.referenceNumber || `RCT-${pay.id.slice(0, 6)}`,
        particulars: `Dr ${methodStr}${refStr}${noteStr}`,
        debit: 0,
        credit: Number(pay.amount || 0),
      });
    } else {
      // Money paid to party (debits party's payable)
      rawList.push({
        id: pay.id,
        rawDate: rawDateStr,
        type: "Jrnl",
        vchNo: pay.referenceNumber || `PMT-${pay.id.slice(0, 6)}`,
        particulars: `Cr ${methodStr}${refStr}${noteStr}`,
        debit: Number(pay.amount || 0),
        credit: 0,
      });
    }
  }

  // Sort chronologically
  rawList.sort((a, b) => (a.rawDate < b.rawDate ? -1 : a.rawDate > b.rawDate ? 1 : 0));

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
