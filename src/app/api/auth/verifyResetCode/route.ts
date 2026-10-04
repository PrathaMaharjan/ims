import { verifyResetCode, verifyResetCodeSchema } from "@/controller/auth/password-reset";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = verifyResetCodeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
    const rateLimit = await checkRateLimit({
    scope: "verify-reset-code",
    identifier: parsed.data.email,
    limit: 5,
    windowSeconds: 15 * 60,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  try {
    const resetId = await verifyResetCode(parsed.data.email, parsed.data.code);
    return NextResponse.json({ resetId });
  } catch {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }
}