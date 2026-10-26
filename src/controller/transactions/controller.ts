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
import { sql, type SQL, and, eq } from "drizzle-orm";
import type {
  ListTransactionsQuery,
  TransactionKind,
  UpdatePaymentTransactionInput,
} from "@/lib/validation/transactions";
import { deleteSale } from "@/controller/sales/controller";
import { deletePurchase } from "@/controller/purchase/controller";
import { invalidateCache } from "@/lib/cache";

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

export async function deleteTransaction(
  organizationId: string,
  kind: TransactionKind,
  id: string,
): Promise<{ success: true }> {
  switch (kind) {
    case "SALE": {
      await deleteSale(organizationId, id);
      return { success: true };
    }

    case "PURCHASE": {
      await deletePurchase(organizationId, id);
      return { success: true };
    }

    case "PAYMENT_RECEIVED":
    case "PAYMENT_PAID": {
      const payment = await db.query.payments.findFirst({
        where: and(eq(payments.id, id), eq(payments.organizationId, organizationId)),
      });
      if (!payment) {
        throw new Error("Payment transaction not found");
      }

      await db.delete(payments).where(eq(payments.id, id));

      // If attached to a sale, recalculate sale status
      if (payment.saleId) {
        const remPayments = await db
          .select({ amount: payments.amount })
          .from(payments)
          .where(and(eq(payments.organizationId, organizationId), eq(payments.saleId, payment.saleId)));
        const totalPaid = remPayments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);

        const sale = await db.query.sales.findFirst({
          where: and(eq(sales.id, payment.saleId), eq(sales.organizationId, organizationId)),
          columns: { id: true, grandTotal: true },
        });
        if (sale) {
          const grandTotal = parseFloat(sale.grandTotal) || 0;
          let newStatus: "PAID" | "PARTIAL" | "UNPAID" = "UNPAID";
          if (totalPaid >= grandTotal - 0.009) newStatus = "PAID";
          else if (totalPaid > 0) newStatus = "PARTIAL";

          await db.update(sales).set({ paymentStatus: newStatus }).where(eq(sales.id, payment.saleId));
        }
      }

      // If attached to a purchase, recalculate purchase status
      if (payment.purchaseId) {
        const remPayments = await db
          .select({ amount: payments.amount })
          .from(payments)
          .where(and(eq(payments.organizationId, organizationId), eq(payments.purchaseId, payment.purchaseId)));
        const totalPaid = remPayments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);

        const purchase = await db.query.purchases.findFirst({
          where: and(eq(purchases.id, payment.purchaseId), eq(purchases.organizationId, organizationId)),
          columns: { id: true, grandTotal: true },
        });
        if (purchase) {
          const grandTotal = parseFloat(purchase.grandTotal) || 0;
          let newStatus: "PAID" | "PARTIAL" | "UNPAID" = "UNPAID";
          if (totalPaid >= grandTotal - 0.009) newStatus = "PAID";
          else if (totalPaid > 0) newStatus = "PARTIAL";

          await db.update(purchases).set({ paymentStatus: newStatus }).where(eq(purchases.id, payment.purchaseId));
        }
      }

      return { success: true };
    }

    case "SALE_RETURN": {
      const ret = await db.query.saleReturns.findFirst({
        where: and(eq(saleReturns.id, id), eq(saleReturns.organizationId, organizationId)),
      });
      if (!ret) throw new Error("Sale return not found");

      if (ret.restocked) {
        const saleItem = await db.query.saleItems.findFirst({
          where: eq(saleItems.id, ret.saleItemId),
        });

        if (saleItem) {
          await db
            .update(batches)
            .set({
              quantityAvailable: sql`${batches.quantityAvailable} - ${ret.quantity}`,
              updatedAt: new Date(),
            })
            .where(eq(batches.id, saleItem.batchId));

          await db
            .update(products)
            .set({
              stockQuantity: sql`${products.stockQuantity} - ${ret.quantity}`,
              updatedAt: new Date(),
            })
            .where(eq(products.id, saleItem.productId));

          await invalidateCache(`products:list:${organizationId}`);
          await invalidateCache(`products:one:${organizationId}:${saleItem.productId}`);
        }
      }

      await db.delete(saleReturns).where(eq(saleReturns.id, id));
      return { success: true };
    }

    case "PURCHASE_RETURN": {
      const ret = await db.query.purchaseReturns.findFirst({
        where: and(eq(purchaseReturns.id, id), eq(purchaseReturns.organizationId, organizationId)),
      });
      if (!ret) throw new Error("Purchase return not found");

      const batch = await db.query.batches.findFirst({
        where: eq(batches.id, ret.batchId),
        columns: { id: true, productId: true },
      });

      if (batch) {
        await db
          .update(batches)
          .set({
            quantityAvailable: sql`${batches.quantityAvailable} + ${ret.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(batches.id, ret.batchId));

        await db
          .update(products)
          .set({
            stockQuantity: sql`${products.stockQuantity} + ${ret.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(products.id, batch.productId));

        await invalidateCache(`products:list:${organizationId}`);
        await invalidateCache(`products:one:${organizationId}:${batch.productId}`);
      }

      await db.delete(purchaseReturns).where(eq(purchaseReturns.id, id));
      return { success: true };
    }

    default:
      throw new Error(`Unsupported transaction kind for deletion: ${kind}`);
  }
}

export async function updateTransaction(
  organizationId: string,
  kind: TransactionKind,
  id: string,
  input: UpdatePaymentTransactionInput,
): Promise<{ success: true }> {
  if (kind !== "PAYMENT_RECEIVED" && kind !== "PAYMENT_PAID") {
    throw new Error(`Direct update through this endpoint is only supported for payments. Please use the dedicated editor.`);
  }

  const payment = await db.query.payments.findFirst({
    where: and(eq(payments.id, id), eq(payments.organizationId, organizationId)),
  });
  if (!payment) throw new Error("Payment transaction not found");

  const updates: Record<string, unknown> = {};
  if (input.amount !== undefined) updates.amount = input.amount.toFixed(2);
  if (input.paymentDate !== undefined) updates.paymentDate = input.paymentDate;
  if (input.method !== undefined) updates.method = input.method;
  if (input.referenceNumber !== undefined) updates.referenceNumber = input.referenceNumber;
  if (input.notes !== undefined) updates.notes = input.notes;

  if (Object.keys(updates).length > 0) {
    await db.update(payments).set(updates).where(eq(payments.id, id));
  }

  // Recalculate parent sale or purchase payment status
  if (input.amount !== undefined) {
    if (payment.saleId) {
      const allPayments = await db
        .select({ amount: payments.amount })
        .from(payments)
        .where(and(eq(payments.organizationId, organizationId), eq(payments.saleId, payment.saleId)));
      const totalPaid = allPayments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
      const sale = await db.query.sales.findFirst({
        where: and(eq(sales.id, payment.saleId), eq(sales.organizationId, organizationId)),
        columns: { id: true, grandTotal: true },
      });
      if (sale) {
        const grandTotal = parseFloat(sale.grandTotal) || 0;
        let newStatus: "PAID" | "PARTIAL" | "UNPAID" = "UNPAID";
        if (totalPaid >= grandTotal - 0.009) newStatus = "PAID";
        else if (totalPaid > 0) newStatus = "PARTIAL";

        await db.update(sales).set({ paymentStatus: newStatus }).where(eq(sales.id, payment.saleId));
      }
    }

    if (payment.purchaseId) {
      const allPayments = await db
        .select({ amount: payments.amount })
        .from(payments)
        .where(and(eq(payments.organizationId, organizationId), eq(payments.purchaseId, payment.purchaseId)));
      const totalPaid = allPayments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
      const purchase = await db.query.purchases.findFirst({
        where: and(eq(purchases.id, payment.purchaseId), eq(purchases.organizationId, organizationId)),
        columns: { id: true, grandTotal: true },
      });
      if (purchase) {
        const grandTotal = parseFloat(purchase.grandTotal) || 0;
        let newStatus: "PAID" | "PARTIAL" | "UNPAID" = "UNPAID";
        if (totalPaid >= grandTotal - 0.009) newStatus = "PAID";
        else if (totalPaid > 0) newStatus = "PARTIAL";

        await db.update(purchases).set({ paymentStatus: newStatus }).where(eq(purchases.id, payment.purchaseId));
      }
    }
  }

  return { success: true };
}
