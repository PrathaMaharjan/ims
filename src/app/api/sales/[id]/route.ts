import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sales } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuth } from "@/lib/auth/require-auth";
import { updateSaleSchema } from "@/lib/validation/sales";
import { deleteSale, updateSale } from "@/controller/sales/controller";


export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const sale = await db.query.sales.findFirst({
      where: and(eq(sales.id, id), eq(sales.organizationId, auth.organizationId)),
      with: {
        items: { with: { batch: true } },
        customer: true,
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    return NextResponse.json({ sale });
  } catch (error) {
    console.error("GET /sales/[id] failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
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
    const parsed = updateSaleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await updateSale(auth.organizationId, id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("PATCH /sales/[id] failed:", error);
    const message = error instanceof Error ? error.message : "Failed to update sale";
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
    await deleteSale(auth.organizationId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /sales/[id] failed:", error);
    const message = error instanceof Error ? error.message : "Failed to delete sale";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}