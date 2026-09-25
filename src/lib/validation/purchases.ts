import z from "zod";
import { batchDetailsSchema } from "./batches";

const purchaseItemInputSchema = z.object({
  productId: z.string().uuid(),
  purchaseRate: z.number().nonnegative(),
  vatApplicable: z.boolean().default(true),
  batch: batchDetailsSchema,
});

export const createPurchaseSchema = z.object({
  supplierId: z.string().uuid(),
  supplierInvoiceNumber: z.string().max(100).optional(),
  purchaseDate: z.string(),
  purcType: z.enum(["VAT_EXEMPT", "VAT_ITEM_WISE", "VAT_TAX_INCL"]),
paymentType: z
    .enum(["CASH", "CREDIT", "BANK_TRANSFER", "CHEQUE", "MOBILE_PAYMENT"])
    .default("CASH"),
  roundingDirection: z.enum(["UP", "DOWN"]).default("DOWN"),
  discount: z.number().nonnegative().default(0),
  freightCharges: z.number().nonnegative().default(0),
  vatRefund: z.number().nonnegative().default(0),
  vatRate: z.number().nonnegative().max(100).default(13),
  items: z.array(purchaseItemInputSchema).min(1),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type PurchaseItemInput = z.infer<typeof purchaseItemInputSchema>;

export const listPurchasesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListPurchasesQuery = z.infer<typeof listPurchasesQuerySchema>;

const updatePurchaseItemInputSchema = purchaseItemInputSchema.extend({
  purchaseItemId: z.string().uuid().optional(),
});

export const updatePurchaseSchema = z.object({
  supplierId: z.string().uuid(),
  supplierInvoiceNumber: z.string().max(100).optional(),
  purchaseDate: z.string(),
  purcType: z.enum(["VAT_EXEMPT", "VAT_ITEM_WISE", "VAT_TAX_INCL"]),
 paymentType: z
    .enum(["CASH", "CREDIT", "BANK_TRANSFER", "CHEQUE", "MOBILE_PAYMENT"])
    .default("CASH"),
  roundingDirection: z.enum(["UP", "DOWN"]).default("DOWN"),
  discount: z.number().nonnegative().default(0),
  freightCharges: z.number().nonnegative().default(0),
  vatRefund: z.number().nonnegative().default(0),
  vatRate: z.number().nonnegative().max(100).default(13),
  items: z.array(updatePurchaseItemInputSchema).min(1),
});


export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;
export type UpdatePurchaseItemInput = z.infer<
  typeof updatePurchaseItemInputSchema
>;
