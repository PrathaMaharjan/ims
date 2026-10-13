import { getLedgerEntryDetail } from "@/controller/party/ledger-entry";
import { LedgerRefType } from "@/controller/party/ledger";
import { getAuth } from "@/lib/auth/require-auth";
import { NextRequest, NextResponse } from "next/server";

const REF_TYPES: LedgerRefType[] = [
  "purchase",
  "sale",
  "payment",
  "purchaseReturn",
  "saleReturn",
];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const url = new URL(req.url);
    const refType = url.searchParams.get("refType") as LedgerRefType | null;
    const refId = url.searchParams.get("refId");

    if (!refType || !REF_TYPES.includes(refType) || !refId) {
      return NextResponse.json({ error: "Invalid entry reference" }, { status: 400 });
    }

    const detail = await getLedgerEntryDetail(auth.organizationId, id, refType, refId);
    return NextResponse.json(detail);
  } catch (error) {
    console.error("GET /parties/[id]/ledger/entry failed:", error);
    const message = error instanceof Error ? error.message : "Something went wrong";
    const status = message === "Entry not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
