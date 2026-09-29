import { getCriticalWatchlist } from "@/controller/dashboard/controller";
import { getAuth } from "@/lib/auth/require-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
 
    const daysParam = req.nextUrl.searchParams.get("withinDays");
    const withinDays = daysParam ? parseInt(daysParam, 10) : undefined;
    const items = await getCriticalWatchlist(auth.organizationId, withinDays);
    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/dashboard/watchlist failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}