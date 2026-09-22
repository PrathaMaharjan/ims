import { NextRequest, NextResponse } from "next/server";
import { REFRESH_TOKEN_EXPIRY_MS } from "@/lib/auth/tokens";
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

  try {
    const { accessToken, refreshToken, user } = await login(parsed.data);

    const response = NextResponse.json({ accessToken, user });

    response.cookies.set("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth",
      maxAge: REFRESH_TOKEN_EXPIRY_MS / 1000,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
}