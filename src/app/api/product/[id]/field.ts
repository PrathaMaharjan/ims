import { updateProductField } from "@/controller/Product/controller";
import { getAuth } from "@/lib/auth/require-auth";
import { updateProductFieldSchema } from "@/lib/validation/products";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = updateProductFieldSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { field, value } = parsed.data;
    const updated = await updateProductField(auth.organizationId, id, field, value);
    return NextResponse.json({ product: updated });
  } catch (error) {
    console.error("PATCH /products/[id]/field failed:", error);
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
}