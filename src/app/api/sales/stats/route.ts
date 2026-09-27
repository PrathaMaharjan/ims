import { getSaleStats } from "@/controller/sales/controller";
import { getAuth } from "@/lib/auth/require-auth";
import { NextRequest, NextResponse } from "next/server";


export async function GET(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const stats = await getSaleStats(auth.organizationId);
    return NextResponse.json({ stats });
  } catch (error) {
    console.error("GET /sales/stats failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}