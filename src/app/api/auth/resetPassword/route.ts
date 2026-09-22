import { resetPassword, resetPasswordSchema } from "@/controller/auth/password-reset";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await resetPassword(parsed.data.resetId, parsed.data.newPassword);
    return NextResponse.json({ message: "Password reset successfully" });
  } catch {
    return NextResponse.json({ error: "Reset session expired, please start again" }, { status: 400 });
  }
}