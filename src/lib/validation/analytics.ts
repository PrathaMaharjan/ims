import z from "zod";

export type AnalyticsGrouping = "month" | "year" | "all";
 
// What each grouping needs from the picker:
// - month: a single year -> breakdown returns Jan..Dec of that year
// - year:  a start month/year and end month/year (e.g. Jun 2024 -> Oct 2025)
//          -> breakdown returns one row per calendar year touched by the
//          span, with boundary years summing only the months inside it
// - all:   nothing -> one all-time row
export type AnalyticsRangeParams =
  | { grouping: "month"; year: number }
  | { grouping: "year"; startYear: number; startMonth: number; endYear: number; endMonth: number }
  | { grouping: "all" };




// Monthly picker sends `year` (e.g. 2026) -> UI shows Jan..Dec of that year.
// Yearly picker sends `startYear`+`startMonth` and `endYear`+`endMonth`
// (e.g. 2024-06 -> 2025-10) -> one row per calendar year touched by the
// span, boundary years partial.
// "all" sends none of these -> all-time, single row.
export const analyticsQuerySchema = z
  .object({
    grouping: z.enum(["month", "year", "all"]).default("month"),
    year: z.coerce.number().int().min(1900).max(2999).optional(),
    startYear: z.coerce.number().int().min(1900).max(2999).optional(),
    startMonth: z.coerce.number().int().min(1).max(12).optional(),
    endYear: z.coerce.number().int().min(1900).max(2999).optional(),
    endMonth: z.coerce.number().int().min(1).max(12).optional(),
  })
  .refine((data) => data.grouping !== "month" || data.year !== undefined, {
    message: "year is required when grouping is 'month'",
    path: ["year"],
  })
  .refine(
    (data) =>
      data.grouping !== "year" ||
      (data.startYear !== undefined && data.startMonth !== undefined && data.endYear !== undefined && data.endMonth !== undefined),
    {
      message: "startYear, startMonth, endYear and endMonth are required when grouping is 'year'",
      path: ["startYear"],
    }
  )
  .refine(
    (data) => {
      if (data.grouping !== "year") return true;
      if (data.startYear === undefined || data.startMonth === undefined || data.endYear === undefined || data.endMonth === undefined)
        return true; // caught by the previous refine
      return data.startYear * 12 + data.startMonth <= data.endYear * 12 + data.endMonth;
    },
    { message: "start (year, month) must be on or before end (year, month)", path: ["startYear"] }
  );

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

// Narrows the validated flat query into the discriminated union the controllers expect.
export function toRangeParams(query: AnalyticsQuery): AnalyticsRangeParams {
  if (query.grouping === "month") return { grouping: "month", year: query.year! };
  if (query.grouping === "year") {
    return {
      grouping: "year",
      startYear: query.startYear!,
      startMonth: query.startMonth!,
      endYear: query.endYear!,
      endMonth: query.endMonth!,
    };
  }
  return { grouping: "all" };
}



const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected YYYY-MM");

export const summaryCardsQuerySchema = z
  .object({
    mode: z.enum(["monthly", "yearly"]),
    startMonth: yearMonth.optional(),
    endMonth: yearMonth.optional(),
    startYear: z.coerce.number().int().min(1900).max(2999).optional(),
    endYear: z.coerce.number().int().min(1900).max(2999).optional(),
  })
  .refine((data) => data.mode !== "monthly" || (data.startMonth && data.endMonth), {
    message: "startMonth and endMonth are required when mode is 'monthly'",
    path: ["startMonth"],
  })
  .refine((data) => data.mode !== "yearly" || (data.startYear !== undefined && data.endYear !== undefined), {
    message: "startYear and endYear are required when mode is 'yearly'",
    path: ["startYear"],
  });


export const revenueVsExpensesQuerySchema = z
  .object({
    mode: z.enum(["monthly", "yearly"]),
    startMonth: yearMonth.optional(),
    endMonth: yearMonth.optional(),
    startYear: z.coerce.number().int().min(1900).max(2999).optional(),
    endYear: z.coerce.number().int().min(1900).max(2999).optional(),
  })
  .refine((data) => data.mode !== "monthly" || (data.startMonth && data.endMonth), {
    message: "startMonth and endMonth are required when mode is 'monthly'",
    path: ["startMonth"],
  })
  .refine((data) => data.mode !== "yearly" || (data.startYear !== undefined && data.endYear !== undefined), {
    message: "startYear and endYear are required when mode is 'yearly'",
    path: ["startYear"],
  });

export type RevenueVsExpensesQuery = z.infer<typeof revenueVsExpensesQuerySchema>;



export const expenseSplitQuerySchema = z
  .object({
    mode: z.enum(["monthly", "yearly"]),
    startMonth: yearMonth.optional(),
    endMonth: yearMonth.optional(),
    startYear: z.coerce.number().int().min(1900).max(2999).optional(),
    endYear: z.coerce.number().int().min(1900).max(2999).optional(),
  })
  .refine((data) => data.mode !== "monthly" || (data.startMonth && data.endMonth), {
    message: "startMonth and endMonth are required when mode is 'monthly'",
    path: ["startMonth"],
  })
  .refine((data) => data.mode !== "yearly" || (data.startYear !== undefined && data.endYear !== undefined), {
    message: "startYear and endYear are required when mode is 'yearly'",
    path: ["startYear"],
  });

export type ExpenseSplitQuery = z.infer<typeof expenseSplitQuerySchema>;


export const breakdownQuerySchema = z
  .object({
    mode: z.enum(["monthly", "yearly"]),
    startMonth: yearMonth.optional(),
    endMonth: yearMonth.optional(),
    startYear: z.coerce.number().int().min(1900).max(2999).optional(),
    endYear: z.coerce.number().int().min(1900).max(2999).optional(),
  })
  .refine((data) => data.mode !== "monthly" || (data.startMonth && data.endMonth), {
    message: "startMonth and endMonth are required when mode is 'monthly'",
    path: ["startMonth"],
  })
  .refine((data) => data.mode !== "yearly" || (data.startYear !== undefined && data.endYear !== undefined), {
    message: "startYear and endYear are required when mode is 'yearly'",
    path: ["startYear"],
  });

export type BreakdownQuery = z.infer<typeof breakdownQuerySchema>;


export const getAllQuerySchema = z
  .object({
    mode: z.enum(["monthly", "yearly"]),
    startMonth: yearMonth.optional(),
    endMonth: yearMonth.optional(),
    startYear: z.coerce.number().int().min(1900).max(2999).optional(),
    endYear: z.coerce.number().int().min(1900).max(2999).optional(),
  })
  .refine((data) => data.mode !== "monthly" || (data.startMonth && data.endMonth), {
    message: "startMonth and endMonth are required when mode is 'monthly'",
    path: ["startMonth"],
  })
  .refine((data) => data.mode !== "yearly" || (data.startYear !== undefined && data.endYear !== undefined), {
    message: "startYear and endYear are required when mode is 'yearly'",
    path: ["startYear"],
  });

export type GetAllQuery = z.infer<typeof getAllQuerySchema>;