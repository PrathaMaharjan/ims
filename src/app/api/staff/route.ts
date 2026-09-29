import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/require-auth";
import { createStaffSchema, listStaffSchema } from "@/lib/validation/staff";
import { createStaff, listStaff, StaffError } from "@/controller/staff/controller";

function handleError(err: unknown) {
  if (err instanceof StaffError) {
    return NextResponse.json(
      { error: err.message, reason: err.reason },
      { status: err.reason === "NOT_FOUND" ? 404 : 400 }
    );
  }
  console.error(err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function GET(req: NextRequest) {
  const auth = await getAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const parsed = listStaffSchema.safeParse({
    page: sp.get("page") ?? undefined,
    limit: sp.get("limit") ?? undefined,
    search: sp.get("search") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
   return NextResponse.json(await listStaff(auth.organizationId, auth.userId, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createStaffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const staff = await createStaff(auth.organizationId, parsed.data);
    return NextResponse.json(staff, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}