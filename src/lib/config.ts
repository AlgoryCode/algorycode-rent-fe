export const AUTH_BASE =
  process.env.AUTH_BASE ||
  process.env.NEXT_PUBLIC_AUTH_BASE ||
  "https://auth.algorycode.com";

/**
 * Rent API kök URL (sonunda / yok). Tüm filo/kiralama/ödeme/kullanıcı istekleri buraya gider.
 *
 * - `next dev`: `NEXT_PUBLIC_RENT_API_BASE` boşsa `http://localhost:8090` (doğrudan Spring Boot).
 * - Prod, doğrudan tarayıcı → API: tam URL (örn. `https://rent.algorycode.com`).
 * - Prod, BFF proxy: `NEXT_PUBLIC_RENT_API_BASE=/api/rent`. Sunucu hedefi için isteğe bağlı
 *   `RENT_API_UPSTREAM`; yoksa `https://rent.algorycode.com` kullanılır.
 *
 * Şablon: `.env.local.example` → `.env.local`. Farklı bir API host’unuz varsa hosting’de
 * `RENT_API_UPSTREAM` verin.
 */
const PROD_RENT_API_DEFAULT = "/api/rent";

export const RENT_API_BASE = (() => {
  const v = process.env.NEXT_PUBLIC_RENT_API_BASE?.trim();
  if (v) return v.replace(/\/$/, "");
  if (process.env.NODE_ENV === "development") return "http://localhost:8090";
  return PROD_RENT_API_DEFAULT;
})();

export const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const ACCESS_TOKEN_EXPIRY_MS = 300_000;
export const ACCESS_TOKEN_EXPIRY_SECONDS = ACCESS_TOKEN_EXPIRY_MS / 1000;
export const TWO_FACTOR_PENDING_COOKIE_MAX_AGE_SECONDS = ACCESS_TOKEN_EXPIRY_SECONDS;
