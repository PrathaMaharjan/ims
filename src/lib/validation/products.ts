import z from "zod";

export const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  aliasName: z.string().max(255).optional(),
  manufacturer: z.string().max(255).optional(),
  categoryId: z.string().uuid().optional(),
  hsnCode: z.string().max(20).optional(),
  unit: z.string().max(30).optional(), // defaults to "Pcs" at the DB level if omitted
  alternativeUnit: z.string().max(30).optional(),
  lowStockThreshold: z.number().int().nonnegative().optional(),
  description: z.string().optional(),
});

export const updateProductSchema = createProductSchema.partial();

// Per-field update — exactly one recognized field at a time
export const updateProductFieldSchema = z.object({
  field: z.enum([
    "name",
    "aliasName",
    "manufacturer",
    "categoryId",
    "hsnCode",
    "unit",
    "alternativeUnit",
    "lowStockThreshold",
    "description",
    "isActive",
  ]),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type UpdateProductFieldInput = z.infer<typeof updateProductFieldSchema>;

