import type { NextResponse } from "next/server";

import { COOKIE_MAX_AGE_SECONDS } from "@/lib/config";
import { decodeJwtPayloadJson, extractRentRolesFromJwtPayload } from "@/lib/rbac/jwt-rent-roles";
import type { RentAppRole } from "@/lib/rbac/rent-roles";
import { parseRentRoleList } from "@/lib/rbac/rent-roles";

export const RENT_FE_ROLES_COOKIE = "rent_fe_roles";

export function rentFeRolesCookieOptions(maxAgeSeconds = COOKIE_MAX_AGE_SECONDS) {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

function rolesFromLoginBody(data: Record<string, unknown>): RentAppRole[] {
  const out: RentAppRole[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string") out.push(...parseRentRoleList(v));
    if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === "string") out.push(...parseRentRoleList(item));
      }
    }
  };
  push(data.roles);
  push(data.role);
  push(data.authorities);
  return out;
}

export function applyRentFeRolesCookie(
  response: NextResponse,
  accessToken: string | undefined,
  body?: Record<string, unknown>,
): void {
  const fromToken =
    accessToken && accessToken.trim()
      ? extractRentRolesFromJwtPayload(decodeJwtPayloadJson(accessToken.trim()) ?? {})
      : [];
  const fromBody = body ? rolesFromLoginBody(body) : [];
  const roles = fromToken.length > 0 ? fromToken : fromBody;
  response.cookies.set(RENT_FE_ROLES_COOKIE, roles.join(","), rentFeRolesCookieOptions());
}

export function clearRentFeRolesCookie(response: NextResponse): void {
  response.cookies.set(RENT_FE_ROLES_COOKIE, "", {
    ...rentFeRolesCookieOptions(0),
    maxAge: 0,
  });
}

export function applyRentFeRolesFromList(response: NextResponse, roles: RentAppRole[]): void {
  response.cookies.set(RENT_FE_ROLES_COOKIE, roles.join(","), rentFeRolesCookieOptions());
}
