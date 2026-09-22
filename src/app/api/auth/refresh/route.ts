import { NextRequest, NextResponse } from "next/server";
import { REFRESH_TOKEN_EXPIRY_MS } from "@/lib/auth/tokens";
import { refreshAccessToken } from "@/controller/auth/refresh";

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get("refreshToken")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  try {
    const { accessToken, refreshToken: newRefreshToken } = await refreshAccessToken(refreshToken);

    const response = NextResponse.json({ accessToken });

    response.cookies.set("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth",
      maxAge: REFRESH_TOKEN_EXPIRY_MS / 1000,
    });

    return response;
  } catch {
    const response = NextResponse.json({ error: "Session expired, please log in again" }, { status: 401 });
    response.cookies.delete("refreshToken");
    return response;
  }
}