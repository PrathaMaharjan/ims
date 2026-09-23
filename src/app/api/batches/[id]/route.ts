import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/require-auth";
import { listBatchesForProduct } from "@/controller/batches/controller";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const result = await listBatchesForProduct(auth.organizationId, id);

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /products/[id]/batches failed:", error);
    const message = error instanceof Error ? error.message : "Something went wrong";
    const status = message === "Product not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}