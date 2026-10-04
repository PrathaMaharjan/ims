import {
  forgotPasswordSchema,
  requestPasswordReset,
} from "@/controller/auth/password-reset";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
    // Keyed on the email so one victim can't be email-bombed, even from many IPs.
  const rateLimit = await checkRateLimit({
    scope: "forgot-password",
    identifier: parsed.data.email,
    limit: 3,
    windowSeconds: 15 * 60,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  await requestPasswordReset(parsed.data.email);

  return NextResponse.json({
    message: "If that email exists, a code has been sent.",
  });
}
