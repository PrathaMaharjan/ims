import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/require-auth";
import { dashboardSummaryQuerySchema } from "@/lib/validation/dashboard";
import { getRevenueByCategory, getRevenueByPayment, resolveDashboardRange } from "@/controller/dashboard/controller";
import { z } from "zod";

const querySchema = dashboardSummaryQuerySchema.and(
  z.object({ by: z.enum(["category", "payment"]).default("category") }),
);

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
 
    const { searchParams } = new URL(req.url);
 
    // `by` is parsed separately — dashboardSummaryQuerySchema has .refine() on it,
    // so it's a ZodEffects and can't be reliably intersected with another object.
    const by = searchParams.get("by") === "payment" ? "payment" : "category";
 
    const parsed = dashboardSummaryQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
 
    const range = await resolveDashboardRange(auth.organizationId, parsed.data);
 
    const slices =
      by === "payment"
        ? await getRevenueByPayment(auth.organizationId, range)
        : await getRevenueByCategory(auth.organizationId, range);
 
    return NextResponse.json({ range, by, slices });
  } catch (err) {
    console.error("GET /api/dashboard/revenue-breakdown failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}