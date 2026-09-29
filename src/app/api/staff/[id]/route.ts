import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/require-auth";
import { updateStaffSchema } from "@/lib/validation/staff";
import {
  deleteStaff,
  getStaff,
  StaffError,
  updateStaff,
} from "@/controller/staff/controller";

type Ctx = { params: Promise<{ id: string }> };

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

export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await getAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json(await getStaff(auth.organizationId, id));
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await getAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = updateStaffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(await updateStaff(auth.organizationId, id, parsed.data));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await getAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json(await deleteStaff(auth.organizationId, auth.userId, id));
  } catch (err) {
    return handleError(err);
  }
}