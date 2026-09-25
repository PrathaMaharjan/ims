import { z } from "zod";

export const createExpenseCategorySchema = z.object({
  name: z.string().min(1).max(150),
});

export const updateExpenseCategorySchema = z.object({
  name: z.string().min(1).max(150),
});

export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>;
export type UpdateExpenseCategoryInput = z.infer<typeof updateExpenseCategorySchema>;

export const createExpenseSchema = z.object({
  categoryId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
  note: z.string().max(1000).optional(),
  amount: z.number().positive(),
  expenseDate: z.string(), 
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const listExpensesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    categoryId: z.string().uuid().optional(),
    date: z.string().optional(), 
    startDate: z.string().optional(), 
    endDate: z.string().optional(), 
  })
  .refine((data) => !(data.date && (data.startDate || data.endDate)), {
    message: "Use either `date` alone or `startDate`/`endDate`, not both",
  })
  .refine((data) => !(data.startDate && !data.endDate) && !(data.endDate && !data.startDate), {
    message: "startDate and endDate must be provided together",
  });

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;