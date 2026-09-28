import z from "zod";

export const expiryBatchesQuerySchema = z.object({
  status: z.enum(["all", "expired", "near", "ok"]).default("all"),
  withinDays: z.coerce.number().int().min(1).max(365).default(90),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
 
export type ExpiryBatchesQuery = z.infer<typeof expiryBatchesQuerySchema>;
 