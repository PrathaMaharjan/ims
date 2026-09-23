import { deleteCategory, updateCategory } from "@/controller/Product/catgeory/controller";
import { getAuth } from "@/lib/auth/require-auth";
import { updateCategorySchema } from "@/lib/validation/categories";
import { NextRequest, NextResponse } from "next/server";


export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateCategorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const updated = await updateCategory(auth.organizationId, id, parsed.data.name);
    return NextResponse.json({ category: updated });
  } catch {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await deleteCategory(auth.organizationId, id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
}