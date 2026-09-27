import { z } from "zod";

const saleItemInputSchema = z.object({
  productId: z.string().uuid(),
  batchId: z.string().uuid(),
  quantity: z.number().int().positive(),
  salePrice: z.number().nonnegative(),
  vatApplicable: z.boolean().default(true),
});

export const createSaleSchema = z.object({
  customerId: z.string().uuid().optional(),
  saleDate: z.string().optional(),
  vatRate: z.number().nonnegative().max(100).default(13),
  discount: z.number().nonnegative().default(0),
  roundingDirection: z.enum(["UP", "DOWN"]).default("DOWN"),
  paymentType: z
    .enum(["CASH", "CREDIT", "BANK_TRANSFER", "CHEQUE", "MOBILE_PAYMENT"])
    .default("CASH"),
  prescriptionNote: z.string().max(1000).optional(),
  items: z.array(saleItemInputSchema).min(1),
});

export const updateSaleSchema = z.object({
  customerId: z.string().uuid().optional(),
  saleDate: z.string().optional(),
  vatRate: z.number().nonnegative().max(100).default(13),
  discount: z.number().nonnegative().default(0),
   paymentType: z
    .enum(["CASH", "CREDIT", "BANK_TRANSFER", "CHEQUE", "MOBILE_PAYMENT"])
    .default("CASH"),
  roundingDirection: z.enum(["UP", "DOWN"]).default("DOWN"),
  prescriptionNote: z.string().max(1000).optional(),
  items: z.array(saleItemInputSchema).min(1),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type SaleItemInput = z.infer<typeof saleItemInputSchema>;
export type updateSaleInput = z.infer<typeof updateSaleSchema>;
export const listSalesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListSalesQuery = z.infer<typeof listSalesQuerySchema>;
