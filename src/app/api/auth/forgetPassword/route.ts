import {
  forgotPasswordSchema,
  requestPasswordReset,
} from "@/controller/auth/password-reset";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  await requestPasswordReset(parsed.data.email);

  return NextResponse.json({
    message: "If that email exists, a code has been sent.",
  });
}
