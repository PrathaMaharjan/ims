import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/cache";
import { getAuth } from "@/lib/auth/require-auth";
import { summaryCardsQuerySchema } from "@/lib/validation/analytics";
import { getSummaryCardsMonthly, getSummaryCardsYearly } from "@/controller/analytics/controller";

// ?mode=monthly&startMonth=2026-01&endMonth=2026-09 -> { revenue, totalExpense, netProfit } for that range
// ?mode=yearly&startYear=2026&endYear=2027 -> same shape, for that year span
export async function GET(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = summaryCardsQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
    }

    const query = parsed.data;
    const cacheKey =
      query.mode === "monthly"
        ? `analytics:stats:${auth.organizationId}:monthly:${query.startMonth}:${query.endMonth}`
        : `analytics:stats:${auth.organizationId}:yearly:${query.startYear}:${query.endYear}`;

    const cached = await getCached(cacheKey);
    if (cached) return NextResponse.json(cached);

    const result =
      query.mode === "monthly"
        ? await getSummaryCardsMonthly(auth.organizationId, query.startMonth!, query.endMonth!)
        : await getSummaryCardsYearly(auth.organizationId, query.startYear!, query.endYear!);

    await setCached(cacheKey, result, 60 * 5);

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /analytics/stats failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}