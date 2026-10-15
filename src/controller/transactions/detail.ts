import { db } from "@/db";
import {
  batches,
  parties,
  products,
  purchaseReturns,
  saleItems,
  saleReturns,
  sales,
  purchases,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { toStandardISODate } from "@/controller/party/ledger";
import type { TransactionKind } from "@/lib/validation/transactions";

export interface DetailParty {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  panVatNumber: string | null;
}

export interface DetailItem {
  productName: string;
  batchNumber: string | null;
  expiryDate: string | null;
  quantity: number;
  rate: number;
  mrp: number | null; // purchases only
  lineTotal: number;
  // Product info, used to build the printable tax invoice.
  vatApplicable: boolean;
  aliasName: string | null;
  hsnCode: string | null;
  manufacturer: string | null;
  unit: string;
}

export interface DetailPayment {
  id: string;
  amount: number;
  date: string;
  method: string | null;
  referenceNumber: string | null;
  notes: string | null;
}

export interface DetailTotals {
  subtotal: number;
  discount: number;
  freightCharges: number;
  vatAmount: number;
  vatRefund: number;
  roundOff: number;
  grandTotal: number;
  paid: number;
  due: number;
}

export interface TransactionDetail {
  kind: TransactionKind;
  id: string;
  party: DetailParty | null;
  paymentType: string | null; // invoices only
  supplierInvoiceNumber: string | null; // purchases only
  note: string | null;
  items: DetailItem[]; // invoices only
  payments: DetailPayment[]; // invoices only
  totals: DetailTotals | null; // invoices only
  // Label/value pairs shown for returns and payments.
  fields: { label: string; value: string }[];
}

const num = (v: unknown) => Number(v ?? 0);

function toParty(
  p: { id: string; name: string; phone: string | null; address: string | null; panVatNumber: string | null } | null | undefined,
): DetailParty | null {
  return p
    ? { id: p.id, name: p.name, phone: p.phone, address: p.address, panVatNumber: p.panVatNumber }
    : null;
}

function nice(v: string | null | undefined) {
  return v ? v.replace(/_/g, " ").toLowerCase().replace(/^\w|\s\w/g, (c) => c.toUpperCase()) : "";
}

function mapPayments(
  rows: { id: string; amount: string; paymentDate: string | Date; method: string | null; referenceNumber: string | null; notes: string | null }[],
): DetailPayment[] {
  return rows.map((p) => ({
    id: p.id,
    amount: num(p.amount),
    date: toStandardISODate(p.paymentDate),
    method: p.method,
    referenceNumber: p.referenceNumber,
    notes: p.notes,
  }));
}

function invoiceTotals(
  inv: {
    subtotal: string;
    discount: string;
    freightCharges: string;
    vatAmount: string;
    vatRefund: string;
    roundOff: string;
    grandTotal: string;
    paymentStatus: string;
  },
  payments: DetailPayment[],
): DetailTotals {
  const grandTotal = num(inv.grandTotal);
  const paid =
    inv.paymentStatus === "PAID" ? grandTotal : payments.reduce((sum, p) => sum + p.amount, 0);
  return {
    subtotal: num(inv.subtotal),
    discount: num(inv.discount),
    freightCharges: num(inv.freightCharges),
    vatAmount: num(inv.vatAmount),
    vatRefund: num(inv.vatRefund),
    roundOff: num(inv.roundOff),
    grandTotal,
    paid,
    due: Math.max(grandTotal - paid, 0),
  };
}

export async function getTransactionDetail(
  organizationId: string,
  kind: TransactionKind,
  id: string,
): Promise<TransactionDetail | null> {
  switch (kind) {
    case "SALE": {
      const sale = await db.query.sales.findFirst({
        where: and(eq(sales.id, id), eq(sales.organizationId, organizationId)),
        with: {
          party: true,
          payments: true,
          items: { with: { product: true, batch: true } },
        },
      });
      if (!sale) return null;
      const payments = mapPayments(sale.payments);
      return {
        kind,
        id,
        party: toParty(sale.party),
        paymentType: sale.paymentType,
        supplierInvoiceNumber: null,
        note: sale.prescriptionNote,
        items: sale.items.map((i) => ({
          productName: i.product?.name ?? "—",
          batchNumber: i.batch?.batchNumber ?? null,
          expiryDate: i.batch?.expiryDate ? toStandardISODate(i.batch.expiryDate) : null,
          quantity: i.quantity,
          rate: num(i.salePrice),
          mrp: null,
          lineTotal: num(i.lineTotal),
          vatApplicable: i.vatApplicable,
          aliasName: i.product?.aliasName ?? null,
          hsnCode: i.product?.hsnCode ?? null,
          manufacturer: i.product?.manufacturer ?? null,
          unit: i.product?.unit ?? "Pcs",
        })),
        payments,
        totals: invoiceTotals(sale, payments),
        fields: [],
      };
    }

    case "PURCHASE": {
      const purchase = await db.query.purchases.findFirst({
        where: and(eq(purchases.id, id), eq(purchases.organizationId, organizationId)),
        with: {
          party: true,
          payments: true,
          items: { with: { product: true } },
        },
      });
      if (!purchase) return null;
      const payments = mapPayments(purchase.payments);
      return {
        kind,
        id,
        party: toParty(purchase.party),
        paymentType: purchase.paymentType,
        supplierInvoiceNumber: purchase.supplierInvoiceNumber,
        note: purchase.note,
        items: purchase.items.map((i) => ({
          productName: i.product?.name ?? "—",
          batchNumber: i.batchNumber,
          expiryDate: i.expiryDate ? toStandardISODate(i.expiryDate) : null,
          quantity: i.quantity,
          rate: num(i.purchaseRate),
          mrp: num(i.mrp),
          lineTotal: num(i.lineTotal),
          vatApplicable: i.vatApplicable,
          aliasName: i.product?.aliasName ?? null,
          hsnCode: i.product?.hsnCode ?? null,
          manufacturer: i.product?.manufacturer ?? null,
          unit: i.product?.unit ?? "Pcs",
        })),
        payments,
        totals: invoiceTotals(purchase, payments),
        fields: [],
      };
    }

    case "PURCHASE_RETURN": {
      const [r] = await db
        .select({
          quantity: purchaseReturns.quantity,
          reason: purchaseReturns.reason,
          status: purchaseReturns.status,
          returnDate: purchaseReturns.returnDate,
          resolutionType: purchaseReturns.resolutionType,
          resolutionAmount: purchaseReturns.resolutionAmount,
          batchNumber: batches.batchNumber,
          purchasePrice: batches.purchasePrice,
          productName: products.name,
          party: parties,
        })
        .from(purchaseReturns)
        .innerJoin(batches, eq(batches.id, purchaseReturns.batchId))
        .innerJoin(products, eq(products.id, batches.productId))
        .leftJoin(parties, eq(parties.id, purchaseReturns.partyId))
        .where(and(eq(purchaseReturns.id, id), eq(purchaseReturns.organizationId, organizationId)));
      if (!r) return null;
      const amount = num(r.resolutionAmount) > 0 ? num(r.resolutionAmount) : r.quantity * num(r.purchasePrice);
      return {
        kind,
        id,
        party: toParty(r.party),
        paymentType: null,
        supplierInvoiceNumber: null,
        note: null,
        items: [],
        payments: [],
        totals: null,
        fields: [
          { label: "Return Date", value: toStandardISODate(r.returnDate) },
          { label: "Status", value: nice(r.status) },
          { label: "Product", value: r.productName },
          { label: "Batch", value: r.batchNumber },
          { label: "Quantity", value: String(r.quantity) },
          { label: "Return Value", value: amount.toFixed(2) },
          { label: "Resolution", value: r.resolutionType ? nice(r.resolutionType) : "Not resolved yet" },
          { label: "Reason", value: r.reason || "—" },
        ],
      };
    }

    case "SALE_RETURN": {
      const [r] = await db
        .select({
          quantity: saleReturns.quantity,
          reason: saleReturns.reason,
          status: saleReturns.status,
          restocked: saleReturns.restocked,
          returnDate: saleReturns.returnDate,
          invoiceNumber: sales.invoiceNumber,
          salePrice: saleItems.salePrice,
          batchNumber: batches.batchNumber,
          productName: products.name,
          party: parties,
        })
        .from(saleReturns)
        .innerJoin(sales, eq(sales.id, saleReturns.saleId))
        .innerJoin(saleItems, eq(saleItems.id, saleReturns.saleItemId))
        .innerJoin(batches, eq(batches.id, saleItems.batchId))
        .innerJoin(products, eq(products.id, saleItems.productId))
        .leftJoin(parties, eq(parties.id, sales.partyId))
        .where(and(eq(saleReturns.id, id), eq(saleReturns.organizationId, organizationId)));
      if (!r) return null;
      return {
        kind,
        id,
        party: toParty(r.party),
        paymentType: null,
        supplierInvoiceNumber: null,
        note: null,
        items: [],
        payments: [],
        totals: null,
        fields: [
          { label: "Return Date", value: toStandardISODate(r.returnDate) },
          { label: "Status", value: nice(r.status) },
          { label: "Original Invoice", value: `SAL-${String(r.invoiceNumber).padStart(4, "0")}` },
          { label: "Product", value: r.productName },
          { label: "Batch", value: r.batchNumber },
          { label: "Quantity", value: String(r.quantity) },
          { label: "Return Value", value: (r.quantity * num(r.salePrice)).toFixed(2) },
          { label: "Added Back to Stock", value: r.restocked ? "Yes" : "No" },
          { label: "Reason", value: r.reason || "—" },
        ],
      };
    }

    case "PAYMENT_RECEIVED":
    case "PAYMENT_PAID": {
      const pay = await db.query.payments.findFirst({
        where: (t, { and, eq }) => and(eq(t.id, id), eq(t.organizationId, organizationId)),
        with: {
          party: true,
          sale: { with: { party: true } },
          purchase: { with: { party: true } },
        },
      });
      if (!pay) return null;
      const linked = pay.sale
        ? `Sale SAL-${String(pay.sale.invoiceNumber).padStart(4, "0")}`
        : pay.purchase
          ? `Purchase ${pay.purchase.supplierInvoiceNumber || `PUR-${pay.purchase.id.slice(0, 6)}`}`
          : "Not linked to an invoice";
      return {
        kind,
        id,
        party: toParty(pay.party ?? pay.sale?.party ?? pay.purchase?.party),
        paymentType: null,
        supplierInvoiceNumber: null,
        note: null,
        items: [],
        payments: [],
        totals: null,
        fields: [
          { label: "Payment Date", value: toStandardISODate(pay.paymentDate) },
          { label: "Direction", value: pay.direction === "RECEIVED_FROM_CUSTOMER" ? "Received from customer" : "Paid to supplier" },
          { label: "Amount", value: num(pay.amount).toFixed(2) },
          { label: "Method", value: nice(pay.method) || "—" },
          { label: "Reference No.", value: pay.referenceNumber || "—" },
          { label: "Against", value: linked },
          { label: "Notes", value: pay.notes || "—" },
        ],
      };
    }
  }
}
