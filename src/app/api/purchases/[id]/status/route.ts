import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/require-auth";
import { updatePurchasePaymentStatusSchema } from "@/lib/validation/purchases";
import { updatePurchasePaymentStatus } from "@/controller/purchase/controller";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = updatePurchasePaymentStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const purchase = await updatePurchasePaymentStatus(
      auth.organizationId,
      id,
      parsed.data,
      auth.userId,
    );
    return NextResponse.json({ purchase });
  } catch (error) {
    console.error("PATCH /purchases/[id]/payment-status failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update payment status";
    const status = message === "Purchase not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
