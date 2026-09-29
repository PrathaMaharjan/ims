import { completePurchaseReturn, PurchaseReturnError } from "@/controller/purchasesRetrun/controller";
import { getAuth } from "@/lib/auth/require-auth";
import { completePurchaseReturnSchema } from "@/lib/validation/retruns";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params; 
    console.log(id)

    const body = await req.json();
    const parsed = completePurchaseReturnSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const updated = await completePurchaseReturn(auth.organizationId, id, parsed.data);
    return NextResponse.json({ purchaseReturn: updated });
  } catch (err) {
    if (err instanceof PurchaseReturnError) {
      return NextResponse.json({ error: err.message, reason: err.reason }, { status: 400 });
    }
    console.error("PATCH /api/purchase-returns/[id] failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}