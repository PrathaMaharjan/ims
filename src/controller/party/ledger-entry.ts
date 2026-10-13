import { db } from "@/db";
import {
  purchases,
  purchaseItems,
  sales,
  saleItems,
  payments,
  purchaseReturns,
  saleReturns,
  batches,
  products,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { LedgerRefType, toStandardISODate } from "./ledger";

export interface InvoicePaymentLine {
  date: string;
  amount: number;
  method: string;
  reference: string | null;
  notes: string | null;
}

interface InvoiceTotals {
  subtotal: number;
  discount: number;
  freight: number;
  vat: number;
  vatRefund: number;
  roundOff: number;
  grandTotal: number;
  paid: number;
  due: number;
}

export interface InvoiceItemLine {
  product: string;
  batchNumber: string | null;
  quantity: number;
  rate: number;
  vatApplicable: boolean;
  lineTotal: number;
}

export type LedgerEntryDetail =
  | {
      kind: "purchase";
      invoiceNo: string;
      date: string;
      paymentType: string;
      paymentStatus: string;
      note: string | null;
      items: InvoiceItemLine[];
      totals: InvoiceTotals;
      payments: InvoicePaymentLine[];
    }
  | {
      kind: "sale";
      invoiceNo: string;
      date: string;
      paymentType: string;
      paymentStatus: string;
      note: string | null;
      items: InvoiceItemLine[];
      totals: InvoiceTotals;
      payments: InvoicePaymentLine[];
    }
  | {
      kind: "payment";
      direction: "PAID_TO_SUPPLIER" | "RECEIVED_FROM_CUSTOMER";
      amount: number;
      date: string;
      method: string;
      reference: string | null;
      notes: string | null;
      against: string | null;
    }
  | {
      kind: "purchaseReturn";
      product: string;
      batchNumber: string;
      quantity: number;
      amount: number;
      reason: string | null;
      resolutionType: string | null;
      status: string;
      date: string;
    }
  | {
      kind: "saleReturn";
      product: string;
      batchNumber: string;
      quantity: number;
      amount: number;
      reason: string | null;
      restocked: boolean;
      status: string;
      date: string;
      invoiceNo: string;
    };

const num = (v: unknown) => Number(v || 0);

// Same "settled on the spot" rule the ledger uses, so the pop-up agrees with it.
function resolvePaid(
  grandTotal: number,
  lines: InvoicePaymentLine[],
  paymentType: string | null,
  paymentStatus: string | null,
) {
  if (lines.length > 0) {
    return lines.reduce((acc, l) => acc + l.amount, 0);
  }
  const paidOnSpot =
    paymentStatus === "PAID" ||
    (paymentType !== "CREDIT" &&
      paymentStatus !== "PARTIAL" &&
      paymentStatus !== "UNPAID");
  return paidOnSpot ? grandTotal : 0;
}

function toPaymentLines(
  rows: {
    paymentDate: string;
    amount: string;
    method: string | null;
    referenceNumber: string | null;
    notes: string | null;
  }[],
): InvoicePaymentLine[] {
  return rows.map((r) => ({
    date: toStandardISODate(r.paymentDate),
    amount: num(r.amount),
    method: r.method ? r.method.replace("_", " ").toUpperCase() : "CASH/BANK",
    reference: r.referenceNumber,
    notes: r.notes,
  }));
}

export async function getLedgerEntryDetail(
  organizationId: string,
  partyId: string,
  refType: LedgerRefType,
  refId: string,
): Promise<LedgerEntryDetail> {
  switch (refType) {
    case "purchase": {
      const purchase = await db.query.purchases.findFirst({
        where: and(
          eq(purchases.id, refId),
          eq(purchases.organizationId, organizationId),
          eq(purchases.partyId, partyId),
        ),
        with: { payments: true },
      });
      if (!purchase) throw new Error("Entry not found");

      const items = await db
        .select({
          product: products.name,
          batchNumber: purchaseItems.batchNumber,
          quantity: purchaseItems.quantity,
          rate: purchaseItems.purchaseRate,
          vatApplicable: purchaseItems.vatApplicable,
          lineTotal: purchaseItems.lineTotal,
        })
        .from(purchaseItems)
        .innerJoin(products, eq(purchaseItems.productId, products.id))
        .where(eq(purchaseItems.purchaseId, purchase.id));

      const lines = toPaymentLines(purchase.payments);
      const grandTotal = num(purchase.grandTotal);
      const paid = resolvePaid(
        grandTotal,
        lines,
        purchase.paymentType,
        purchase.paymentStatus,
      );

      return {
        kind: "purchase",
        invoiceNo:
          purchase.supplierInvoiceNumber || `PUR-${purchase.id.slice(0, 6)}`,
        date: toStandardISODate(purchase.purchaseDate),
        paymentType: purchase.paymentType,
        paymentStatus: purchase.paymentStatus,
        note: purchase.note,
        items: items.map((i) => ({
          ...i,
          rate: num(i.rate),
          lineTotal: num(i.lineTotal),
        })),
        totals: {
          subtotal: num(purchase.subtotal),
          discount: num(purchase.discount),
          freight: num(purchase.freightCharges),
          vat: num(purchase.vatAmount),
          vatRefund: num(purchase.vatRefund),
          roundOff: num(purchase.roundOff),
          grandTotal,
          paid,
          due: Math.max(0, grandTotal - paid),
        },
        payments: lines,
      };
    }

    case "sale": {
      const sale = await db.query.sales.findFirst({
        where: and(
          eq(sales.id, refId),
          eq(sales.organizationId, organizationId),
          eq(sales.partyId, partyId),
        ),
        with: { payments: true },
      });
      if (!sale) throw new Error("Entry not found");

      const items = await db
        .select({
          product: products.name,
          batchNumber: batches.batchNumber,
          quantity: saleItems.quantity,
          rate: saleItems.salePrice,
          vatApplicable: saleItems.vatApplicable,
          lineTotal: saleItems.lineTotal,
        })
        .from(saleItems)
        .innerJoin(products, eq(saleItems.productId, products.id))
        .innerJoin(batches, eq(saleItems.batchId, batches.id))
        .where(eq(saleItems.saleId, sale.id));

      const lines = toPaymentLines(sale.payments);
      const grandTotal = num(sale.grandTotal);
      const paid = resolvePaid(
        grandTotal,
        lines,
        sale.paymentType,
        sale.paymentStatus,
      );

      return {
        kind: "sale",
        invoiceNo: `SAL-${String(sale.invoiceNumber).padStart(4, "0")}`,
        date: toStandardISODate(sale.saleDate),
        paymentType: sale.paymentType,
        paymentStatus: sale.paymentStatus,
        note: sale.prescriptionNote,
        items: items.map((i) => ({
          ...i,
          rate: num(i.rate),
          lineTotal: num(i.lineTotal),
        })),
        totals: {
          subtotal: num(sale.subtotal),
          discount: num(sale.discount),
          freight: num(sale.freightCharges),
          vat: num(sale.vatAmount),
          vatRefund: num(sale.vatRefund),
          roundOff: num(sale.roundOff),
          grandTotal,
          paid,
          due: Math.max(0, grandTotal - paid),
        },
        payments: lines,
      };
    }

    case "payment": {
      const pay = await db.query.payments.findFirst({
        where: and(
          eq(payments.id, refId),
          eq(payments.organizationId, organizationId),
        ),
        with: { purchase: true, sale: true },
      });
      if (!pay) throw new Error("Entry not found");

      // A payment belongs to this party directly, or through its invoice.
      const belongsToParty =
        pay.partyId === partyId ||
        pay.purchase?.partyId === partyId ||
        pay.sale?.partyId === partyId;
      if (!belongsToParty) throw new Error("Entry not found");

      const against = pay.purchase
        ? `Purchase ${pay.purchase.supplierInvoiceNumber || `PUR-${pay.purchase.id.slice(0, 6)}`}`
        : pay.sale
          ? `Sale SAL-${String(pay.sale.invoiceNumber).padStart(4, "0")}`
          : null;

      return {
        kind: "payment",
        direction: pay.direction,
        amount: num(pay.amount),
        date: toStandardISODate(pay.paymentDate),
        method: pay.method ? pay.method.replace("_", " ").toUpperCase() : "CASH/BANK",
        reference: pay.referenceNumber,
        notes: pay.notes,
        against,
      };
    }

    case "purchaseReturn": {
      const [ret] = await db
        .select({
          quantity: purchaseReturns.quantity,
          resolutionType: purchaseReturns.resolutionType,
          resolutionAmount: purchaseReturns.resolutionAmount,
          reason: purchaseReturns.reason,
          status: purchaseReturns.status,
          returnDate: purchaseReturns.returnDate,
          batchNumber: batches.batchNumber,
          purchasePrice: batches.purchasePrice,
          product: products.name,
        })
        .from(purchaseReturns)
        .innerJoin(batches, eq(purchaseReturns.batchId, batches.id))
        .innerJoin(products, eq(batches.productId, products.id))
        .where(
          and(
            eq(purchaseReturns.id, refId),
            eq(purchaseReturns.organizationId, organizationId),
            eq(purchaseReturns.partyId, partyId),
          ),
        );
      if (!ret) throw new Error("Entry not found");

      const resAmount = num(ret.resolutionAmount);
      return {
        kind: "purchaseReturn",
        product: ret.product,
        batchNumber: ret.batchNumber,
        quantity: ret.quantity,
        amount: resAmount > 0 ? resAmount : ret.quantity * num(ret.purchasePrice),
        reason: ret.reason,
        resolutionType: ret.resolutionType,
        status: ret.status,
        date: toStandardISODate(ret.returnDate),
      };
    }

    case "saleReturn": {
      const [ret] = await db
        .select({
          quantity: saleReturns.quantity,
          reason: saleReturns.reason,
          restocked: saleReturns.restocked,
          status: saleReturns.status,
          returnDate: saleReturns.returnDate,
          invoiceNumber: sales.invoiceNumber,
          salePrice: saleItems.salePrice,
          batchNumber: batches.batchNumber,
          product: products.name,
        })
        .from(saleReturns)
        .innerJoin(sales, eq(saleReturns.saleId, sales.id))
        .innerJoin(saleItems, eq(saleReturns.saleItemId, saleItems.id))
        .innerJoin(batches, eq(saleItems.batchId, batches.id))
        .innerJoin(products, eq(saleItems.productId, products.id))
        .where(
          and(
            eq(saleReturns.id, refId),
            eq(saleReturns.organizationId, organizationId),
            eq(sales.partyId, partyId),
          ),
        );
      if (!ret) throw new Error("Entry not found");

      return {
        kind: "saleReturn",
        product: ret.product,
        batchNumber: ret.batchNumber,
        quantity: ret.quantity,
        amount: ret.quantity * num(ret.salePrice),
        reason: ret.reason,
        restocked: ret.restocked,
        status: ret.status,
        date: toStandardISODate(ret.returnDate),
        invoiceNo: `SAL-${String(ret.invoiceNumber).padStart(4, "0")}`,
      };
    }
  }
}
