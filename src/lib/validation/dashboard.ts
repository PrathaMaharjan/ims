import z from "zod";

const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
 
export const dashboardSummaryQuerySchema = z
  .object({
    mode: z.enum(["monthly", "yearly"]),
    startMonth: z.string().regex(monthRegex, "startMonth must be YYYY-MM").optional(),
    endMonth: z.string().regex(monthRegex, "endMonth must be YYYY-MM").optional(),
    startYear: z.coerce.number().int().min(2000).max(2100).optional(),
    endYear: z.coerce.number().int().min(2000).max(2100).optional(),
  })
  .refine((v) => Boolean(v.startMonth) === Boolean(v.endMonth), {
    message: "startMonth and endMonth must be provided together",
    path: ["endMonth"],
  })
  .refine((v) => Boolean(v.startYear) === Boolean(v.endYear), {
    message: "startYear and endYear must be provided together",
    path: ["endYear"],
  });
 
export type DashboardSummaryQuery = z.infer<typeof dashboardSummaryQuerySchema>;