import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/require-auth";
import { listTransactionsQuerySchema } from "@/lib/validation/transactions";
import { listTransactions } from "@/controller/transactions/controller";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = listTransactionsQuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await listTransactions(auth.organizationId, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /transactions failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
