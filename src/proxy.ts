import { NextRequest, NextResponse } from "next/server";

<<<<<<< HEAD
// Public for everyone, logged in or not (exact match only).
const PUBLIC_EXACT = ["/"];

// Auth pages: public, but a logged-in user gets sent to the app.
const AUTH_PATHS = ["/login", "/forgot-password"];

function matchesPath(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}
=======
const PUBLIC_PATHS = ["/login", "/forgot-password", "/"];
>>>>>>> ce3aa31c7ed29c5046902077de1896d1dea2ce31

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

<<<<<<< HEAD
  const isAuthPage = AUTH_PATHS.some((p) => matchesPath(pathname, p));
  const isPublicPath = PUBLIC_EXACT.includes(pathname) || isAuthPage;

  // refreshToken itself is scoped to path "/api/auth" and is never visible here;
  // isLoggedIn is the non-sensitive marker cookie set alongside it for this check.
=======
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

>>>>>>> ce3aa31c7ed29c5046902077de1896d1dea2ce31
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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};