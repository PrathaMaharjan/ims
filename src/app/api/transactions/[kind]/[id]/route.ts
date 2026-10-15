import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/require-auth";
import { transactionKinds, type TransactionKind } from "@/lib/validation/transactions";
import { getTransactionDetail } from "@/controller/transactions/detail";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { kind, id } = await params;
    if (!(transactionKinds as readonly string[]).includes(kind) || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid transaction" }, { status: 400 });
    }

    const detail = await getTransactionDetail(auth.organizationId, kind as TransactionKind, id);
    if (!detail) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ detail });
  } catch (error) {
    console.error("GET /transactions/[kind]/[id] failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
