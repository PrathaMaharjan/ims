import { z } from "zod";

// Mirrors exactly what one purchase-item's batch panel collects.
// Never used to create a batch directly — only consumed by createPurchase.
export const batchDetailsSchema = z.object({
  batchNumber: z.string().min(1).max(100),
  quantity: z.number().int().positive(),
  expiryDate: z.string().min(1), // required — matches batches.expiryDate NOT NULL
  manufacturingDate: z.string().optional(),
  note: z.string().max(1000).optional(),
  mrp: z.number().nonnegative().optional(),
  salePrice: z.number().nonnegative().optional(),
  partyId: z.string().uuid().optional(), // per-line override; falls back to the purchase's partyId if omitted
});

export type BatchDetailsInput = z.infer<typeof batchDetailsSchema>;

// Edit of an existing batch from the batches screen. Every field optional —
// only what's sent gets changed.
export const updateBatchSchema = z.object({
  batchNumber: z.string().trim().min(1).max(100).optional(),
  expiryDate: z.string().min(1).optional(),
  quantityAvailable: z.number().int().nonnegative().optional(),
  purchasePrice: z.number().nonnegative().optional(),
  mrp: z.number().nonnegative().optional(),
  salePrice: z.number().nonnegative().nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
});

export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
