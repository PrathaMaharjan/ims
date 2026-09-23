import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/forgot-password"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  // refreshToken itself is scoped to path "/api/auth" and is never visible here;
  // isLoggedIn is the non-sensitive marker cookie set alongside it for this check.
  const isLoggedIn = req.cookies.get("isLoggedIn")?.value === "1";

  if (!isLoggedIn && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isPublicPath) {
    return NextResponse.redirect(new URL("/pharma", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};