import { z } from "zod";

export const updateOrganizationSchema = z.object({
  businessName: z.string().min(1).max(255).optional(),
  panVatNumber: z.string().max(50).optional(),
  vatRegistered: z.boolean().optional(),
  address: z.string().optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  logoDataUri: z.string().min(1).optional(), 
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;