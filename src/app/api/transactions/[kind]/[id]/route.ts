import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/require-auth";
import {
  transactionKinds,
  type TransactionKind,
  updatePaymentTransactionSchema,
} from "@/lib/validation/transactions";
import { getTransactionDetail } from "@/controller/transactions/detail";
import { deleteTransaction, updateTransaction } from "@/controller/transactions/controller";

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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!auth.isOwner) {
      return NextResponse.json(
        { error: "Forbidden: Read-only accounts cannot delete transactions" },
        { status: 403 },
      );
    }

    const { kind, id } = await params;
    if (!(transactionKinds as readonly string[]).includes(kind) || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid transaction" }, { status: 400 });
    }

    await deleteTransaction(auth.organizationId, kind as TransactionKind, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /transactions/[kind]/[id] failed:", error);
    const message = error instanceof Error ? error.message : "Failed to delete transaction";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!auth.isOwner) {
      return NextResponse.json(
        { error: "Forbidden: Read-only accounts cannot edit transactions" },
        { status: 403 },
      );
    }

    const { kind, id } = await params;
    if (!(transactionKinds as readonly string[]).includes(kind) || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid transaction" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = updatePaymentTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await updateTransaction(
      auth.organizationId,
      kind as TransactionKind,
      id,
      parsed.data,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("PATCH /transactions/[kind]/[id] failed:", error);
    const message = error instanceof Error ? error.message : "Failed to update transaction";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
