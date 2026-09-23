import { NextRequest, NextResponse } from "next/server";
import { verifyRefreshToken } from "@/lib/auth/tokens";
import { logout } from "@/controller/auth/logout";

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get("refreshToken")?.value;
  const response = NextResponse.json({ success: true });

  // Always clear the cookie client-side, even if the token is already invalid/expired.
  response.cookies.delete({ name: "refreshToken", path: "/api/auth" });
  response.cookies.delete({ name: "isLoggedIn", path: "/" });

  if (!refreshToken) {
    return response;
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    await logout(payload.sessionId);
  } catch(error) {
    console.error("Error occurred while logging out:", error);
  }

  return response;
}