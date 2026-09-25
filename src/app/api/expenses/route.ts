import { createExpense, listExpenses } from "@/controller/expenses/controller";
import { getAuth } from "@/lib/auth/require-auth";
import { createExpenseSchema, listExpensesQuerySchema } from "@/lib/validation/expense-categories";
import { NextRequest, NextResponse } from "next/server";

// post reuest to create expenses
export async function POST(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const created = await createExpense(auth.organizationId, auth.userId, parsed.data);
    return NextResponse.json({ expense: created }, { status: 201 });
  } catch (error) {
    console.error("POST /expenses failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = listExpensesQuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams)
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await listExpenses(auth.organizationId, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /expenses failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}