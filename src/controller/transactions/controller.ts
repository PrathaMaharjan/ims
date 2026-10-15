import { db } from "@/db";
import {
  batches,
  parties,
  payments,
  products,
  purchaseReturns,
  purchases,
  saleItems,
  saleReturns,
  sales,
} from "@/db/schema";
import { sql, type SQL } from "drizzle-orm";
import type { ListTransactionsQuery, TransactionKind } from "@/lib/validation/transactions";

export interface TransactionRow {
  id: string;
  kind: TransactionKind;
  date: string; // YYYY-MM-DD
  voucherNo: string;
  partyId: string | null;
  partyName: string | null;
  amount: number;
  paid: number | null; // only for SALE / PURCHASE
  due: number | null; // only for SALE / PURCHASE
  status: string | null; // payment status for invoices, PENDING/COMPLETED for returns
  method: string | null;
  details: string | null;
}

export interface TransactionsSummary {
  totalSales: number;
  totalPurchases: number;
  totalSaleReturns: number;
  totalPurchaseReturns: number;
  paymentsReceived: number;
  paymentsPaid: number;
  receivable: number; // unpaid part of the sales invoices in this result
  payable: number; // unpaid part of the purchase invoices in this result
}

export interface ListTransactionsResult {
  transactions: TransactionRow[];
  summary: TransactionsSummary;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// Every branch returns the same columns so they can be stacked with UNION ALL.
// Table names are not aliased on purpose: the `${table.column}` references
// render as "table"."column" and must match the FROM clause.
function buildUnion(organizationId: string): SQL {
  const salesBranch = sql`
    SELECT
      ${sales.id}::text AS id,
      'SALE' AS kind,
      to_char(${sales.saleDate}, 'YYYY-MM-DD') AS tx_date,
      ${sales.createdAt} AS created_at,
      'SAL-' || lpad(${sales.invoiceNumber}::text, 4, '0') AS voucher_no,
      ${sales.partyId}::text AS party_id,
      ${parties.name} AS party_name,
      ${sales.grandTotal} AS amount,
      CASE WHEN ${sales.paymentStatus} = 'PAID' THEN ${sales.grandTotal}
           ELSE COALESCE((SELECT SUM(pay.amount) FROM ${payments} pay WHERE pay.sale_id = ${sales.id}), 0)
      END AS paid,
      ${sales.paymentStatus}::text AS status,
      ${sales.paymentType}::text AS method,
      NULL::text AS details
    FROM ${sales}
    LEFT JOIN ${parties} ON ${parties.id} = ${sales.partyId}
    WHERE ${sales.organizationId} = ${organizationId}`;

  const purchasesBranch = sql`
    SELECT
      ${purchases.id}::text AS id,
      'PURCHASE' AS kind,
      to_char(${purchases.purchaseDate}, 'YYYY-MM-DD') AS tx_date,
      ${purchases.createdAt} AS created_at,
      COALESCE(NULLIF(${purchases.supplierInvoiceNumber}, ''), 'PUR-' || left(${purchases.id}::text, 6)) AS voucher_no,
      ${purchases.partyId}::text AS party_id,
      ${parties.name} AS party_name,
      ${purchases.grandTotal} AS amount,
      CASE WHEN ${purchases.paymentStatus} = 'PAID' THEN ${purchases.grandTotal}
           ELSE COALESCE((SELECT SUM(pay.amount) FROM ${payments} pay WHERE pay.purchase_id = ${purchases.id}), 0)
      END AS paid,
      ${purchases.paymentStatus}::text AS status,
      ${purchases.paymentType}::text AS method,
      NULL::text AS details
    FROM ${purchases}
    LEFT JOIN ${parties} ON ${parties.id} = ${purchases.partyId}
    WHERE ${purchases.organizationId} = ${organizationId}`;

  const purchaseReturnsBranch = sql`
    SELECT
      ${purchaseReturns.id}::text AS id,
      'PURCHASE_RETURN' AS kind,
      to_char(${purchaseReturns.returnDate}, 'YYYY-MM-DD') AS tx_date,
      ${purchaseReturns.createdAt} AS created_at,
      'PRT-' || upper(left(${purchaseReturns.id}::text, 6)) AS voucher_no,
      ${purchaseReturns.partyId}::text AS party_id,
      ${parties.name} AS party_name,
      CASE WHEN COALESCE(${purchaseReturns.resolutionAmount}, 0) > 0 THEN ${purchaseReturns.resolutionAmount}
           ELSE ${purchaseReturns.quantity} * ${batches.purchasePrice}
      END AS amount,
      NULL::numeric AS paid,
      ${purchaseReturns.status}::text AS status,
      NULL::text AS method,
      ${products.name} || ' (Batch: ' || ${batches.batchNumber} || ', Qty: ' || ${purchaseReturns.quantity} || ')' AS details
    FROM ${purchaseReturns}
    INNER JOIN ${batches} ON ${batches.id} = ${purchaseReturns.batchId}
    INNER JOIN ${products} ON ${products.id} = ${batches.productId}
    LEFT JOIN ${parties} ON ${parties.id} = ${purchaseReturns.partyId}
    WHERE ${purchaseReturns.organizationId} = ${organizationId}`;

  const saleReturnsBranch = sql`
    SELECT
      ${saleReturns.id}::text AS id,
      'SALE_RETURN' AS kind,
      to_char(${saleReturns.returnDate}, 'YYYY-MM-DD') AS tx_date,
      ${saleReturns.createdAt} AS created_at,
      'SR-' || ${sales.invoiceNumber}::text AS voucher_no,
      ${sales.partyId}::text AS party_id,
      ${parties.name} AS party_name,
      ${saleReturns.quantity} * ${saleItems.salePrice} AS amount,
      NULL::numeric AS paid,
      ${saleReturns.status}::text AS status,
      NULL::text AS method,
      ${products.name} || ' (Batch: ' || ${batches.batchNumber} || ', Qty: ' || ${saleReturns.quantity} || ')' AS details
    FROM ${saleReturns}
    INNER JOIN ${sales} ON ${sales.id} = ${saleReturns.saleId}
    INNER JOIN ${saleItems} ON ${saleItems.id} = ${saleReturns.saleItemId}
    INNER JOIN ${batches} ON ${batches.id} = ${saleItems.batchId}
    INNER JOIN ${products} ON ${products.id} = ${saleItems.productId}
    LEFT JOIN ${parties} ON ${parties.id} = ${sales.partyId}
    WHERE ${saleReturns.organizationId} = ${organizationId}`;

  const paymentsBranch = sql`
    SELECT
      ${payments.id}::text AS id,
      CASE WHEN ${payments.direction} = 'RECEIVED_FROM_CUSTOMER' THEN 'PAYMENT_RECEIVED' ELSE 'PAYMENT_PAID' END AS kind,
      to_char(${payments.paymentDate}, 'YYYY-MM-DD') AS tx_date,
      ${payments.createdAt} AS created_at,
      COALESCE(
        NULLIF(${payments.referenceNumber}, ''),
        CASE WHEN ${payments.direction} = 'RECEIVED_FROM_CUSTOMER' THEN 'RCT-' ELSE 'PMT-' END
          || upper(left(${payments.id}::text, 6))
      ) AS voucher_no,
      ${parties.id}::text AS party_id,
      ${parties.name} AS party_name,
      ${payments.amount} AS amount,
      NULL::numeric AS paid,
      NULL::text AS status,
      ${payments.method} AS method,
      ${payments.notes} AS details
    FROM ${payments}
    LEFT JOIN ${sales} ON ${sales.id} = ${payments.saleId}
    LEFT JOIN ${purchases} ON ${purchases.id} = ${payments.purchaseId}
    LEFT JOIN ${parties}
      ON ${parties.id} = COALESCE(${payments.partyId}, ${sales.partyId}, ${purchases.partyId})
    WHERE ${payments.organizationId} = ${organizationId}`;

  return sql`
    ${salesBranch}
    UNION ALL ${purchasesBranch}
    UNION ALL ${purchaseReturnsBranch}
    UNION ALL ${saleReturnsBranch}
    UNION ALL ${paymentsBranch}`;
}

function buildFilters(query: ListTransactionsQuery): SQL {
  const conditions: SQL[] = [];

  if (query.type === "PAYMENT") {
    conditions.push(sql`t.kind IN ('PAYMENT_RECEIVED', 'PAYMENT_PAID')`);
  } else if (query.type !== "ALL") {
    conditions.push(sql`t.kind = ${query.type}`);
  }
  if (query.startDate) conditions.push(sql`t.tx_date >= ${query.startDate}`);
  if (query.endDate) conditions.push(sql`t.tx_date <= ${query.endDate}`);
  if (query.partyId) conditions.push(sql`t.party_id = ${query.partyId}`);
  if (query.search) {
    const like = `%${query.search.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(sql`(t.voucher_no ILIKE ${like} OR t.party_name ILIKE ${like})`);
  }

  return conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
}

export async function listTransactions(
  organizationId: string,
  query: ListTransactionsQuery,
): Promise<ListTransactionsResult> {
  const { page, limit } = query;
  const offset = (page - 1) * limit;

  const union = buildUnion(organizationId);
  const where = buildFilters(query);

  const [rowsResult, summaryResult] = await Promise.all([
    db.execute(sql`
      WITH t AS (${union})
      SELECT t.id, t.kind, t.tx_date, t.voucher_no, t.party_id, t.party_name,
             t.amount, t.paid, t.status, t.method, t.details
      FROM t
      ${where}
      ORDER BY t.tx_date DESC, t.created_at DESC, t.id DESC
      LIMIT ${limit} OFFSET ${offset}`),
    // Pending returns have not touched the party's account yet, so they are
    // listed but left out of the totals (same rule as the party ledger).
    db.execute(sql`
      WITH t AS (${union})
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(t.amount) FILTER (WHERE t.kind = 'SALE'), 0) AS total_sales,
        COALESCE(SUM(t.amount) FILTER (WHERE t.kind = 'PURCHASE'), 0) AS total_purchases,
        COALESCE(SUM(t.amount) FILTER (WHERE t.kind = 'SALE_RETURN' AND t.status = 'COMPLETED'), 0) AS total_sale_returns,
        COALESCE(SUM(t.amount) FILTER (WHERE t.kind = 'PURCHASE_RETURN' AND t.status = 'COMPLETED'), 0) AS total_purchase_returns,
        COALESCE(SUM(t.amount) FILTER (WHERE t.kind = 'PAYMENT_RECEIVED'), 0) AS payments_received,
        COALESCE(SUM(t.amount) FILTER (WHERE t.kind = 'PAYMENT_PAID'), 0) AS payments_paid,
        COALESCE(SUM(t.amount - t.paid) FILTER (WHERE t.kind = 'SALE'), 0) AS receivable,
        COALESCE(SUM(t.amount - t.paid) FILTER (WHERE t.kind = 'PURCHASE'), 0) AS payable
      FROM t
      ${where}`),
  ]);

  const transactions: TransactionRow[] = rowsResult.rows.map((r) => {
    const amount = Number(r.amount ?? 0);
    const paid = r.paid === null || r.paid === undefined ? null : Number(r.paid);
    return {
      id: String(r.id),
      kind: r.kind as TransactionKind,
      date: String(r.tx_date),
      voucherNo: String(r.voucher_no),
      partyId: r.party_id ? String(r.party_id) : null,
      partyName: r.party_name ? String(r.party_name) : null,
      amount,
      paid,
      due: paid === null ? null : Math.max(amount - paid, 0),
      status: r.status ? String(r.status) : null,
      method: r.method ? String(r.method) : null,
      details: r.details ? String(r.details) : null,
    };
  });

  const s = summaryResult.rows[0] ?? {};
  const total = Number(s.total ?? 0);

  return {
    transactions,
    summary: {
      totalSales: Number(s.total_sales ?? 0),
      totalPurchases: Number(s.total_purchases ?? 0),
      totalSaleReturns: Number(s.total_sale_returns ?? 0),
      totalPurchaseReturns: Number(s.total_purchase_returns ?? 0),
      paymentsReceived: Number(s.payments_received ?? 0),
      paymentsPaid: Number(s.payments_paid ?? 0),
      receivable: Number(s.receivable ?? 0),
      payable: Number(s.payable ?? 0),
    },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
