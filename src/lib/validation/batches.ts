import { z } from "zod";

// Mirrors exactly what one purchase-item's batch panel collects.
// Never used to create a batch directly — only consumed by createPurchase.
export const batchDetailsSchema = z.object({
  batchNumber: z.string().min(1).max(100),
  quantity: z.number().int().positive(),
  expiryDate: z.string().min(1), // required — matches batches.expiryDate NOT NULL
  manufacturingDate: z.string().optional(),
  mrp: z.number().nonnegative().optional(),
  salePrice: z.number().nonnegative().optional(),
  supplierId: z.string().uuid().optional(), // per-line override; falls back to the purchase's supplierId if omitted
});

export type BatchDetailsInput = z.infer<typeof batchDetailsSchema>;