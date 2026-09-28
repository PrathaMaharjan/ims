import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/require-auth";
import {
  getExpiringBatches,
  getExpirySummary,
} from "@/controller/batches/controller";
import { expiryBatchesQuerySchema } from "@/lib/validation/expires";


export async function GET(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = expiryBatchesQuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const query = parsed.data;

    const [summary, list] = await Promise.all([
      getExpirySummary(auth.organizationId, query.withinDays),
      getExpiringBatches(auth.organizationId, query),
    ]);

    return NextResponse.json({ summary, ...list });
  } catch (error) {
    console.error("GET /analytics/batches/expiry failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}