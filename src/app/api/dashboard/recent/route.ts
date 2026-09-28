import { getRecentTransactions } from "@/controller/dashboard/controller";
import { getAuth } from "@/lib/auth/require-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
 
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit")) || 10;
 
    const items = await getRecentTransactions(auth.organizationId, limit);
    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/dashboard/recent-transactions failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}