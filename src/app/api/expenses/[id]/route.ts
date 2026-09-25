import { deleteExpense, getExpenseById, updateExpense } from "@/controller/expenses/controller";
import { getAuth } from "@/lib/auth/require-auth";
import { updateExpenseSchema } from "@/lib/validation/expense-categories";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const expense = await getExpenseById(auth.organizationId, id);
    return NextResponse.json({ expense });
  } catch (error) {
    console.error("GET /expenses/[id] failed:", error);
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }
}

// update
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = updateExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await updateExpense(auth.organizationId, id, parsed.data);
    return NextResponse.json({ expense: updated });
  } catch (error) {
    console.error("PATCH /expenses/[id] failed:", error);
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }
}
// delete
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await deleteExpense(auth.organizationId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /expenses/[id] failed:", error);
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }
}