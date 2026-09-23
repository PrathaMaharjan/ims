import { createProduct, listProducts } from "@/controller/Product/controller";
import { getAuth } from "@/lib/auth/require-auth";
import { createProductSchema } from "@/lib/validation/products";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await listProducts(auth.organizationId);
    return NextResponse.json({ products: result });
  } catch (error) {
    console.error("GET /products failed:", error);
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
    const parsed = createProductSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const created = await createProduct(auth.organizationId, parsed.data);
    return NextResponse.json({ product: created }, { status: 201 });
  } catch (error) {
    console.error("POST /products failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}