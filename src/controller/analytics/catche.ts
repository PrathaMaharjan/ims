import { AnalyticsRangeParams } from "@/lib/validation/analytics";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// One cache key format shared by all four endpoints, keyed on org + the
// exact range shape (a year for monthly, a month-to-month span for yearly).
export function buildAnalyticsCacheKey(prefix: string, organizationId: string, params: AnalyticsRangeParams): string {
  switch (params.grouping) {
    case "all":
      return `analytics:${prefix}:${organizationId}:all`;
    case "month":
      return `analytics:${prefix}:${organizationId}:month:${params.year}`;
    case "year":
      return `analytics:${prefix}:${organizationId}:year:${params.startYear}${pad(params.startMonth)}-${params.endYear}${pad(params.endMonth)}`;
  }
}