import { pgEnum } from "drizzle-orm/pg-core";

export const batchStatusEnum = pgEnum("batch_status", [
  "ACTIVE",
  "NEAR_EXPIRY",
  "EXPIRED",
  "RECALLED",
  "QUARANTINED",
  "DEPLETED",
]);

export const purcTypeEnum = pgEnum("purc_type", [
  "VAT_EXEMPT",
  "VAT_ITEM_WISE",
  "VAT_TAX_INCL",
]);

export const purchaseReturnStatusEnum = pgEnum("purchase_return_status", [
  "PENDING",
  "COMPLETED",
]);

export const saleReturnStatusEnum = pgEnum("sale_return_status", [
  "PENDING",
  "COMPLETED",
]);

export const paymentDirectionEnum = pgEnum("payment_direction", [
  "PAID_TO_SUPPLIER",
  "RECEIVED_FROM_CUSTOMER",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "UNPAID",
  "PARTIAL",
  "PAID",
]);

export const purchasePaymentTypeEnum = pgEnum("purchase_payment_type", [
  "CASH",
  "CREDIT",
  "BANK_TRANSFER",
  "CHEQUE",
  "MOBILE_PAYMENT",
]);

export const roundingDirectionEnum = pgEnum("rounding_direction", ["UP", "DOWN"]);