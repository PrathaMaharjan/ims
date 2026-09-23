import { createSupplier, listSuppliers } from "@/controller/supplier/controller";
import { getAuth } from "@/lib/auth/require-auth";
import { getCached, setCached } from "@/lib/cache";
import { createSupplierSchema } from "@/lib/validation/schema";
import { listSuppliersQuerySchema } from "@/lib/validation/supplier";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = listSuppliersQuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams)
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { page, limit, search } = parsed.data;
    const cacheKey = `suppliers:list:${auth.organizationId}:page=${page}:limit=${limit}:search=${search ?? ""}`;

    const cached = await getCached(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const result = await listSuppliers(auth.organizationId, parsed.data);
    await setCached(cacheKey, result, 60 * 5);

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /suppliers failed:", error);
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
    const parsed = createSupplierSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const created = await createSupplier(auth.organizationId, parsed.data);
    return NextResponse.json({ supplier: created }, { status: 201 });
  } catch (error) {
    console.error("POST /suppliers failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}