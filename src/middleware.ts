import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_PATH = "/login";

const TALEP_KIOSK_COOKIE = "talep_kiosk_lock";

function isLockedTalepPath(pathname: string) {
  return pathname === "/talep/p" || pathname.startsWith("/talep/p/");
}

function isProtectedPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/vehicles") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/countries") ||
    pathname.startsWith("/customers") ||
    pathname.startsWith("/logs") ||
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/payments") ||
    pathname.startsWith("/requests") ||
    pathname.startsWith("/rentals") ||
    pathname.startsWith("/users") ||
    pathname.startsWith("/settings")
  );
}

function hasAccessToken(req: NextRequest) {
  return Boolean(req.cookies.get("algory_access_token")?.value || req.cookies.get("accessToken")?.value);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authed = hasAccessToken(req);
  const kioskLock = req.cookies.get(TALEP_KIOSK_COOKIE)?.value === "1";

  if (kioskLock && !authed) {
    if (isLockedTalepPath(pathname)) {
      return NextResponse.next();
    }
    const url = req.nextUrl.clone();
    url.pathname = "/talep/p";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (pathname === AUTH_PATH) {
    if (authed) return NextResponse.redirect(new URL("/dashboard", req.url));
    return NextResponse.next();
  }

  if (isProtectedPath(pathname)) {
    if (!authed) {
      const url = req.nextUrl.clone();
      url.pathname = AUTH_PATH;
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
