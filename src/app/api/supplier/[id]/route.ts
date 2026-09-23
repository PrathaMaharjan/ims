import { deleteSupplier, getSupplierById, updateSupplier } from "@/controller/supplier/controller";
import { getAuth } from "@/lib/auth/require-auth";
import { updateSupplierSchema } from "@/lib/validation/schema";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supplier = await getSupplierById(auth.organizationId, id);

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    return NextResponse.json({ supplier });
  } catch (error) {
    console.error("GET /suppliers/[id] failed:", error);
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
    const parsed = updateSupplierSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await updateSupplier(auth.organizationId, id, parsed.data);
    return NextResponse.json({ supplier: updated });
  } catch (error) {
    console.error("PATCH /suppliers/[id] failed:", error);
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await deleteSupplier(auth.organizationId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /suppliers/[id] failed:", error);
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }
}