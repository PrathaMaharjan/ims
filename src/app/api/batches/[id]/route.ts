import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/require-auth";
import { listBatchesForProduct, updateBatch } from "@/controller/batches/controller";
import { updateBatchSchema } from "@/lib/validation/batches";

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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = updateBatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const batch = await updateBatch(auth.organizationId, id, parsed.data);

    return NextResponse.json({ batch });
  } catch (error) {
    console.error("PATCH /batches/[id] failed:", error);
    const message = error instanceof Error ? error.message : "Something went wrong";
    const status = message === "Batch not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}