import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/require-auth";
import { createWriteOffSchema, listWriteOffsQuerySchema } from "@/lib/validation/writeOffs";
import { createWriteOff, listWriteOffs, WriteOffError } from "@/controller/writeOff/controller";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = listWriteOffsQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const writeOffs = await listWriteOffs(auth.organizationId, parsed.data);
    return NextResponse.json({ writeOffs });
  } catch (err) {
    console.error("GET /api/write-offs failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = createWriteOffSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const writeOff = await createWriteOff(auth.organizationId, auth.userId, parsed.data);
    return NextResponse.json({ writeOff }, { status: 201 });
  } catch (err) {
    if (err instanceof WriteOffError) {
      return NextResponse.json({ error: err.message, reason: err.reason }, { status: 400 });
    }
    console.error("POST /api/write-offs failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}