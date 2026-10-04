import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/require-auth";
import { dashboardSummaryQuerySchema } from "@/lib/validation/dashboard";
import {
  resolveDashboardRange,
  getDashboardStats,
  getInventoryStatus,
} from "@/controller/dashboard/controller";

// GET /api/dashboard/summary?mode=monthly|yearly&startMonth&endMonth&startYear&endYear
//
// Deliberately uncached: `inventoryStatus` depends on CURRENT_DATE and
// changes on every sale, purchase and return, same reasoning as
// /api/batches/expiry.
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

    // Resolved once here (not inside getDashboardStats) so the org lookup
    // for the yearly default only happens a single time per request.
    const range = await resolveDashboardRange(auth.organizationId, parsed.data);

    const [stats, inventoryStatus] = await Promise.all([
      getDashboardStats(auth.organizationId, range),
      getInventoryStatus(auth.organizationId),
    ]);

    return NextResponse.json({ range, stats, inventoryStatus });
  } catch (err) {
    console.error("GET /api/dashboard/summary failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}