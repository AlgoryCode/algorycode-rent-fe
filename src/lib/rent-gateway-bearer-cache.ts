"use client";

import {
  clearGatewayBearerCache,
  getGatewayBearerCache,
  setGatewayBearerCache,
} from "@/lib/gateway-bearer-cache-state";
import { getPanelSameOriginAxios } from "@/lib/panel-same-origin-axios";

const GATEWAY_BEARER_CACHE_MS = 45_000;

export function clearRentApiGatewayAuthCache() {
  clearGatewayBearerCache();
}

export async function resolveGatewayBearerHeader(): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined;
  const now = Date.now();
  const hit = getGatewayBearerCache(now);
  if (hit) return `Bearer ${hit.token}`;
  try {
    const { data } = await getPanelSameOriginAxios().get<{ accessToken?: string | null }>("/api/auth/access-token", {
      headers: { Accept: "application/json" },
      validateStatus: (s) => s < 500,
    });
    const t = data?.accessToken?.trim();
    if (!t) {
      clearGatewayBearerCache();
      return undefined;
    }
    setGatewayBearerCache(t, now + GATEWAY_BEARER_CACHE_MS);
    return `Bearer ${t}`;
  } catch {
    clearGatewayBearerCache();
    return undefined;
  }
}
