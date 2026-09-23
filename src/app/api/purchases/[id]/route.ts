import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { purchases } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuth } from "@/lib/auth/require-auth";
import { updatePurchaseSchema } from "@/lib/validation/purchases";
import { deletePurchase, updatePurchase } from "@/controller/purchase/controller";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const purchase = await db.query.purchases.findFirst({
      where: and(
        eq(purchases.id, id),
        eq(purchases.organizationId, auth.organizationId),
      ),
      with: {
        items: { with: { batch: true } }, // nested relational fetch, one query
        supplier: true,
      },
    });

    if (!purchase) {
      return NextResponse.json(
        { error: "Purchase not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ purchase });
  } catch (error) {
    console.error("GET /purchases/[id] failed:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = updatePurchaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await updatePurchase(auth.organizationId, id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("PATCH /purchases/[id] failed:", error);
    const message = error instanceof Error ? error.message : "Failed to update purchase";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await deletePurchase(auth.organizationId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /purchases/[id] failed:", error);
    const message = error instanceof Error ? error.message : "Failed to delete purchase";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}