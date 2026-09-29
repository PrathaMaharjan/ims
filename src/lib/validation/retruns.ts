import { z } from "zod";

export const createPurchaseReturnSchema = z.object({
  batchId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  reason: z.string().max(255).optional(),
  returnDate: z.string().optional(),
});

export const completePurchaseReturnSchema = z.discriminatedUnion("resolutionType", [
  z.object({
    resolutionType: z.literal("QUANTITY"),
    resolvedBatchId: z.string().uuid(),
    // Expiry of the replacement stock — becomes the batch's new expiry date
    expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  }),
  z.object({
    resolutionType: z.literal("MONEY"),
    resolutionAmount: z.coerce.number().positive(),
  }),
]);

export const listPurchaseReturnsQuerySchema = z.object({
  status: z.enum(["PENDING", "COMPLETED"]).optional(),
  partyId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreatePurchaseReturnInput = z.infer<typeof createPurchaseReturnSchema>;
export type CompletePurchaseReturnInput = z.infer<typeof completePurchaseReturnSchema>;
export type ListPurchaseReturnsQuery = z.infer<typeof listPurchaseReturnsQuerySchema>;