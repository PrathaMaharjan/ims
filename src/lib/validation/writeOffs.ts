import { z } from "zod";

export const createWriteOffSchema = z.object({
  batchId: z.string().uuid(),
  // Ignored — a write-off always removes the batch's whole remaining stock
  quantity: z.coerce.number().int().positive().optional(),
  reason: z.string().max(255).optional(),
});

export const listWriteOffsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateWriteOffInput = z.infer<typeof createWriteOffSchema>;
export type ListWriteOffsQuery = z.infer<typeof listWriteOffsQuerySchema>;