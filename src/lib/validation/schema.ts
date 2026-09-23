import { z } from "zod";

export const createSupplierSchema = z.object({
  name: z.string().min(1).max(255),
  contactPerson: z.string().max(255).optional(),
  panVatNumber: z.string().max(50).optional(),
  address: z.string().optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  paymentTerms: z.string().max(255).optional(),
  status: z.boolean().default(true),
  notes: z.string().optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export const listSuppliersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type ListSuppliersQuery = z.infer<typeof listSuppliersQuerySchema>;