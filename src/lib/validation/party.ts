import { z } from "zod";

export const partyTypeSchema = z.enum(["SUPPLIER", "CUSTOMER", "BOTH"]);

export const createPartySchema = z.object({
  name: z.string().min(1).max(255),
  partyType: partyTypeSchema.default("BOTH"),
  contactPerson: z.string().max(255).optional(),
  panVatNumber: z.string().max(50).optional(),
  address: z.string().optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  paymentTerms: z.string().max(255).optional(),
  status: z.boolean().default(true),
  notes: z.string().optional(),
});

export const updatePartySchema = createPartySchema.partial();

// `type` narrows the list to parties usable in that role — SUPPLIER returns
// SUPPLIER + BOTH, CUSTOMER returns CUSTOMER + BOTH. Omit it to list everyone.
export const listPartiesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  type: z.enum(["SUPPLIER", "CUSTOMER"]).optional(),
});

export const partyStatsQuerySchema = z.object({
  type: z.enum(["SUPPLIER", "CUSTOMER"]).optional(),
});

export type PartyType = z.infer<typeof partyTypeSchema>;
export type CreatePartyInput = z.infer<typeof createPartySchema>;
export type UpdatePartyInput = z.infer<typeof updatePartySchema>;
export type ListPartiesQuery = z.infer<typeof listPartiesQuerySchema>;
export type PartyStatsQuery = z.infer<typeof partyStatsQuerySchema>;
