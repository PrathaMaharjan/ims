import { createCustomer, listCustomers } from "@/controller/customer/controller";
import { getAuth } from "@/lib/auth/require-auth";
import { createCustomerSchema, listCustomersQuerySchema } from "@/lib/validation/customer";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = listCustomersQuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams)
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await listCustomers(auth.organizationId, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /customers failed:", error);
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
    const parsed = createCustomerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const created = await createCustomer(auth.organizationId, parsed.data);
    return NextResponse.json({ customer: created }, { status: 201 });
  } catch (error) {
    console.error("POST /customers failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}