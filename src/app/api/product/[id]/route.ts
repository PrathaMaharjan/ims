import { deleteProduct, getProductById, updateProduct } from "@/controller/Product/controller";
import { getAuth } from "@/lib/auth/require-auth";
import { updateProductSchema } from "@/lib/validation/products";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const product = await getProductById(auth.organizationId, id);

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error("GET /products/[id] failed:", error);
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
    const parsed = updateProductSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await updateProduct(auth.organizationId, id, parsed.data);
    return NextResponse.json({ product: updated });
  } catch (error) {
    console.error("PATCH /products/[id] failed:", error);
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await deleteProduct(auth.organizationId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /products/[id] failed:", error);
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
}