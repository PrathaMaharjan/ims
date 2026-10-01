import { getRevenueVsExpensesMonthly, getRevenueVsExpensesYearly } from "@/controller/analytics/controller";
import { getAuth } from "@/lib/auth/require-auth";
import { revenueVsExpensesQuerySchema } from "@/lib/validation/analytics";
import { getCached, setCached } from "@/lib/cache";
import { NextRequest, NextResponse } from "next/server";

// ?mode=monthly&startMonth=2026-01&endMonth=2026-09 -> one row per month, "January".."September"
// ?mode=yearly&startYear=2026&endYear=2027 -> one row per year, "2026","2027"
export async function GET(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = revenueVsExpensesQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
    }

    const query = parsed.data;
    // const cacheKey =
    //   query.mode === "monthly"
    //     ? `analytics:revenue-vs-expenses:${auth.organizationId}:monthly:${query.startMonth}:${query.endMonth}`
    //     : `analytics:revenue-vs-expenses:${auth.organizationId}:yearly:${query.startYear}:${query.endYear}`;

    // const cached = await getCached(cacheKey);
    // if (cached) return NextResponse.json(cached);

    const result =
      query.mode === "monthly"
        ? await getRevenueVsExpensesMonthly(auth.organizationId, query.startMonth!, query.endMonth!)
        : await getRevenueVsExpensesYearly(auth.organizationId, query.startYear!, query.endYear!);

    // await setCached(cacheKey, result, 60 * 5);

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /analytics/revenue-vs-expenses failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}