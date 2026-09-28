import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/require-auth";
import { dashboardSummaryQuerySchema } from "@/lib/validation/dashboard";
import { getRevenueTrend, resolveDashboardRange } from "@/controller/dashboard/controller";

// GET /api/dashboard/revenue-trend?mode=monthly|yearly&startMonth&endMonth&startYear&endYear
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parsed = dashboardSummaryQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const range = await resolveDashboardRange(auth.organizationId, parsed.data);
    const points = await getRevenueTrend(auth.organizationId, range);

    return NextResponse.json({ range, points });
  } catch (err) {
    console.error("GET /api/dashboard/revenue-trend failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}