"use client";

let gatewayBearerCache: { token: string; exp: number } | null = null;

export function clearGatewayBearerCache() {
  gatewayBearerCache = null;
}

export function getGatewayBearerCache(now: number): { token: string; exp: number } | null {
  if (gatewayBearerCache && gatewayBearerCache.exp > now) return gatewayBearerCache;
  return null;
}

export function setGatewayBearerCache(token: string, exp: number) {
  gatewayBearerCache = { token, exp };
}
