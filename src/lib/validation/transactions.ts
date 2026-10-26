import z from "zod";

export const transactionKinds = [
  "SALE",
  "PURCHASE",
  "SALE_RETURN",
  "PURCHASE_RETURN",
  "PAYMENT_RECEIVED",
  "PAYMENT_PAID",
] as const;

export type TransactionKind = (typeof transactionKinds)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // ALL = everything, PAYMENT = both payment directions
  type: z.enum(["ALL", "PAYMENT", ...transactionKinds]).default("ALL"),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  partyId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
});

export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;

export const updatePaymentTransactionSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0").optional(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
  method: z.string().trim().max(50).optional(),
  referenceNumber: z.string().trim().max(100).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export type UpdatePaymentTransactionInput = z.infer<typeof updatePaymentTransactionSchema>;
