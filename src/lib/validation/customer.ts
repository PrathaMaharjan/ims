import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(1).max(255),
  phone: z.string().max(30).optional(),
  address: z.string().optional(),
  email: z.string().email().optional(),
  status: z.boolean().default(true),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;
