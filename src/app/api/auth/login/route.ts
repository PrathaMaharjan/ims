import { NextRequest, NextResponse } from "next/server";
import { REFRESH_TOKEN_EXPIRY_MS } from "@/lib/auth/tokens";
import { checkRateLimit } from "@/lib/rate-limit";
import { login, loginInputSchema } from "@/controller/auth/login";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = loginInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  const rateLimit = await checkRateLimit({
    scope: "login",
    identifier: `${email}:${ip}`,
    limit: 5,
    windowSeconds: 15 * 60,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  try {
    const { accessToken, refreshToken, user } = await login({ email, password });
    const response = NextResponse.json({ accessToken, user });
    response.cookies.set("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth",
      maxAge: REFRESH_TOKEN_EXPIRY_MS / 1000,
    });
    // Non-sensitive marker so proxy.ts can detect an active session without
    // needing the refreshToken cookie, which is scoped to /api/auth only.
    response.cookies.set("isLoggedIn", "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: REFRESH_TOKEN_EXPIRY_MS / 1000,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
}