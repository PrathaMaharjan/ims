import { createExpenseCategory, listExpenseCategories } from "@/controller/expenses/category";
import { getAuth } from "@/lib/auth/require-auth";
import { createExpenseCategorySchema } from "@/lib/validation/expense-categories";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await listExpenseCategories(auth.organizationId);
    return NextResponse.json({ expenseCategories: result });
  } catch (error) {
    console.error("GET /expense-categories failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createExpenseCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const created = await createExpenseCategory(auth.organizationId, parsed.data.name);
    return NextResponse.json({ expenseCategory: created }, { status: 201 });
  } catch (error) {
    console.error("POST /expense-categories failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}