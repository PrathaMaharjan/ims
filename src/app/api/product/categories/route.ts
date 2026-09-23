import { createCategory, listCategories } from "@/controller/Product/catgeory/controller";
import { getAuth } from "@/lib/auth/require-auth";
import { createCategorySchema } from "@/lib/validation/categories";
import { NextRequest, NextResponse } from "next/server";


export async function GET(req: NextRequest) {
  const auth = getAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await listCategories(auth.organizationId);
  return NextResponse.json({ categories: result });
}

export async function POST(req: NextRequest) {
  const auth = getAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createCategorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const created = await createCategory(auth.organizationId, parsed.data.name);
  return NextResponse.json({ category: created }, { status: 201 });
}