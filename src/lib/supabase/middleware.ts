import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import type { RentAppRole } from "@/lib/rbac/rent-roles";
import { hasRentManagerAccess } from "@/lib/rbac/rent-roles";
import { requiresRentManagerForPath } from "@/lib/rbac/route-policy";
import { RENT_FE_ROLES_COOKIE, rentFeRolesCookieOptions } from "@/lib/rbac/role-cookie";

const AUTH_PATH = "/login";

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

function redirectTalep(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/talep/p" || pathname.startsWith("/talep/p/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/rental-request-form";
    return NextResponse.redirect(url);
  }
  if (pathname === "/rental-request-form/kiosk" || pathname.startsWith("/rental-request-form/kiosk/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/rental-request-form";
    return NextResponse.redirect(url);
  }
  if (pathname === "/talep") {
    const url = req.nextUrl.clone();
    url.pathname = "/rental-request-form";
    return NextResponse.redirect(url);
  }
  return null;
}

export async function updateSupabaseSession(req: NextRequest) {
  const talepRedirect = redirectTalep(req);
  if (talepRedirect) return talepRedirect;

  let supabaseResponse = NextResponse.next({ request: req });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request: req });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = req.nextUrl;
  const authed = Boolean(user);

  if (pathname === AUTH_PATH) {
    if (authed) return NextResponse.redirect(new URL("/dashboard", req.url));
    return supabaseResponse;
  }

  if (isProtectedPath(pathname)) {
    if (!authed) {
      const url = req.nextUrl.clone();
      url.pathname = AUTH_PATH;
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }

    if (requiresRentManagerForPath(pathname)) {
      const rolesCookie = req.cookies.get(RENT_FE_ROLES_COOKIE)?.value ?? "";
      const roles = rolesCookie
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean) as RentAppRole[];
      if (!hasRentManagerAccess(roles)) {
        const url = req.nextUrl.clone();
        url.pathname = "/dashboard";
        url.searchParams.set("yetkisiz", "1");
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
