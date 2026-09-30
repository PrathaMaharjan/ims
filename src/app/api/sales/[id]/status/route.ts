import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/require-auth";
import { updateSalePaymentStatusSchema } from "@/lib/validation/sales";
import { updateSalePaymentStatus } from "@/controller/sales/controller";

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
    const parsed = updateSalePaymentStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const sale = await updateSalePaymentStatus(
      auth.organizationId,
      id,
      parsed.data,
      auth.userId,
    );
    return NextResponse.json({ sale });
  } catch (error) {
    console.error("PATCH /sales/[id]/status failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update payment status";
    const status = message === "Sale not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
