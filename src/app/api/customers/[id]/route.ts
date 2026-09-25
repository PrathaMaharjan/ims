import { deleteCustomer, getCustomerById, updateCustomer } from "@/controller/customer/controller";
import { getAuth } from "@/lib/auth/require-auth";
import { updateCustomerSchema } from "@/lib/validation/customer";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const customer = await getCustomerById(auth.organizationId, id);
    return NextResponse.json({ customer });
  } catch (error) {
    console.error("GET /customers/[id] failed:", error);
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
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
    const parsed = updateCustomerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await updateCustomer(auth.organizationId, id, parsed.data);
    return NextResponse.json({ customer: updated });
  } catch (error) {
    console.error("PATCH /customers/[id] failed:", error);
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await deleteCustomer(auth.organizationId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /customers/[id] failed:", error);
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }
}