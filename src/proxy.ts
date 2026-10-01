import { NextRequest, NextResponse } from "next/server";


const PUBLIC_EXACT = ["/", "/offline"];


const AUTH_PATHS = ["/login", "/forgot-password"];

function matchesPath(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAuthPage = AUTH_PATHS.some((p) => matchesPath(pathname, p));
  const isPublicPath = PUBLIC_EXACT.includes(pathname) || isAuthPage;

  // refreshToken itself is scoped to path "/api/auth" and is never visible here;
  // isLoggedIn is the non-sensitive marker cookie set alongside it for this check.
  const isLoggedIn = req.cookies.get("isLoggedIn")?.value === "1";

  if (!isLoggedIn && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/pharma", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};