import { deleteExpenseCategory, getExpenseCategoryById, updateExpenseCategory } from "@/controller/expenses/category";
import { getAuth } from "@/lib/auth/require-auth";
import { updateExpenseCategorySchema } from "@/lib/validation/expense-categories";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = updateExpenseCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await updateExpenseCategory(auth.organizationId, id, parsed.data.name);
    return NextResponse.json({ expenseCategory: updated });
  } catch (error) {
    console.error("PATCH /expense-categories/[id] failed:", error);
    return NextResponse.json({ error: "Expense category not found" }, { status: 404 });
  }
}

// get expense category by id
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const category = await getExpenseCategoryById(auth.organizationId, id);
    return NextResponse.json({ expenseCategory: category });
  } catch (error) {
    console.error("GET /expense-categories/[id] failed:", error);
    return NextResponse.json({ error: "Expense category not found" }, { status: 404 });
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
    await deleteExpenseCategory(auth.organizationId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /expense-categories/[id] failed:", error);
    return NextResponse.json({ error: "Expense category not found" }, { status: 404 });
  }
}