import { AnalyticsRangeParams } from "@/lib/validation/analytics";


export interface ResolvedRange {
  startDate?: string; // undefined only for grouping "all" (no filter)
  endDate?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Last calendar day of the given month (1-12) in the given year, as YYYY-MM-DD.
// Using `new Date(year, month, 0)` rolls back one day from the 1st of the
// *next* month, which lands on the last day of `month` — handles Feb/leap years for free.
function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Turns the picker's params into a plain SQL date range.
export function resolveDateRange(params: AnalyticsRangeParams): ResolvedRange {
  switch (params.grouping) {
    case "all":
      return {};
    case "month":
      return { startDate: `${params.year}-01-01`, endDate: `${params.year}-12-31` };
    case "year":
      // e.g. startYear=2024, startMonth=6, endYear=2025, endMonth=10
      // -> 2024-06-01 .. 2025-10-31. A boundary year's row (2024 or 2025)
      // only ever sums rows inside this window, so it naturally comes out
      // partial without any extra logic in the breakdown query.
      return {
        startDate: `${params.startYear}-${pad(params.startMonth)}-01`,
        endDate: lastDayOfMonth(params.endYear, params.endMonth),
      };
  }
}