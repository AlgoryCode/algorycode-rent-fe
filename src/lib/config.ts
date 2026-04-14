import { getAuthApiRoot, getRentApiRoot } from "@/lib/api-base";

/** Auth upstream: `{gateway}/authservice` */
export const AUTH_BASE = getAuthApiRoot();

/** Rent API (axios): `{gateway}/rent` — doğrudan gateway; BFF yok. */
export const RENT_API_BASE = getRentApiRoot();

/**
 * Panelin herkese açık kök URL’si, sonunda `/` yok (örn. `https://rent.algorycode.com`).
 */
export const PUBLIC_APP_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN?.replace(/\/$/, "").trim() ?? "";

export function resolvePublicAppOrigin(browserOrigin?: string | null): string {
  const fromBrowser = browserOrigin?.replace(/\/$/, "").trim() ?? "";
  if (fromBrowser.length > 0) return fromBrowser;
  return PUBLIC_APP_ORIGIN;
}

export function publicAbsoluteUrl(path: string, browserOrigin?: string | null): string {
  const pathClean = path.startsWith("/") ? path : `/${path}`;
  const base = resolvePublicAppOrigin(browserOrigin);
  if (!base) return pathClean;
  return `${base}${pathClean}`;
}

export const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
/** AuthService access JWT ile uyumlu (2 saat). */
export const ACCESS_TOKEN_EXPIRY_MS = 7_200_000;
export const ACCESS_TOKEN_EXPIRY_SECONDS = ACCESS_TOKEN_EXPIRY_MS / 1000;
export const TWO_FACTOR_PENDING_COOKIE_MAX_AGE_SECONDS = ACCESS_TOKEN_EXPIRY_SECONDS;
