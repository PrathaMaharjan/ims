import { getBreakdownMonthly, getBreakdownYearly } from "@/controller/analytics/controller";
import { getAuth } from "@/lib/auth/require-auth";
import { breakdownQuerySchema } from "@/lib/validation/analytics";
import { getCached, setCached } from "@/lib/cache";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = breakdownQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
    }

    const query = parsed.data;
    // const cacheKey =
    //   query.mode === "monthly"
    //     ? `analytics:breakdown:${auth.organizationId}:monthly:${query.startMonth}:${query.endMonth}`
    //     : `analytics:breakdown:${auth.organizationId}:yearly:${query.startYear}:${query.endYear}`;

    // const cached = await getCached(cacheKey);
    // if (cached) return NextResponse.json(cached);

    const result =
      query.mode === "monthly"
        ? await getBreakdownMonthly(auth.organizationId, query.startMonth!, query.endMonth!)
        : await getBreakdownYearly(auth.organizationId, query.startYear!, query.endYear!);

    // await setCached(cacheKey, result, 60 * 5);

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /analytics/breakdown failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}