import { getPartyStats } from "@/controller/party/controller";
import { getAuth } from "@/lib/auth/require-auth";
import { partyStatsQuerySchema } from "@/lib/validation/party";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = partyStatsQuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams)
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const stats = await getPartyStats(auth.organizationId, parsed.data);
    return NextResponse.json({ stats });
  } catch (error) {
    console.error("GET /parties/stats failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
