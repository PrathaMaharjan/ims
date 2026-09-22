import { verifyResetCode, verifyResetCodeSchema } from "@/controller/auth/password-reset";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = verifyResetCodeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const resetId = await verifyResetCode(parsed.data.email, parsed.data.code);
    return NextResponse.json({ resetId });
  } catch {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }
}