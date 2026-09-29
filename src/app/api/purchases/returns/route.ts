import { createPurchaseReturn, listPurchaseReturns, PurchaseReturnError } from "@/controller/purchasesRetrun/controller";
import { getAuth } from "@/lib/auth/require-auth";
import { createPurchaseReturnSchema, listPurchaseReturnsQuerySchema } from "@/lib/validation/retruns";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = createPurchaseReturnSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const row = await createPurchaseReturn(auth.organizationId, parsed.data);
    return NextResponse.json({ purchaseReturn: row }, { status: 201 });
  } catch (err) {
    if (err instanceof PurchaseReturnError) {
      return NextResponse.json({ error: err.message, reason: err.reason }, { status: 400 });
    }
    console.error("POST /api/purchase-returns failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const parsed = listPurchaseReturnsQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const items = await listPurchaseReturns(auth.organizationId, parsed.data);
    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/purchase-returns failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}