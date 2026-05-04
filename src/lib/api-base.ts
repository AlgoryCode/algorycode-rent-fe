const stripTrailingSlash = (s: string) => s.replace(/\/+$/, "");

const API_TARGETS = {
  local: {
    gatewayOrigin: "http://localhost:8072",
    rentGatewayOrigin: "http://localhost:8073",
    authServiceBase: "http://localhost:8081/authservice",
  },
  prod: {
    gatewayOrigin: "https://gateway.algorycode.com",
    rentGatewayOrigin: "https://gateway.algorycode.com",
    authServiceBase: "https://auth.algorycode.com/authservice",
  },
} as const;

function isLocalProdFlag(): boolean {
  const v = process.env.NEXT_PUBLIC_LOCAL_PROD?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

function gatewayOrigin(): string {
  const useProd = isLocalProdFlag() || process.env.NODE_ENV !== "development";
  return stripTrailingSlash(useProd ? API_TARGETS.prod.gatewayOrigin : API_TARGETS.local.gatewayOrigin);
}

function authServiceBase(): string {
  const useProd = isLocalProdFlag() || process.env.NODE_ENV !== "development";
  return stripTrailingSlash(useProd ? API_TARGETS.prod.authServiceBase : API_TARGETS.local.authServiceBase);
}

function envRentGatewayOrigin(): string | undefined {
  const v = process.env.NEXT_PUBLIC_RENT_GATEWAY_URL?.trim();
  return v && v.length > 0 ? stripTrailingSlash(v) : undefined;
}

function rentGatewayOrigin(): string {
  const override = envRentGatewayOrigin();
  if (override) return override;
  const useProd = isLocalProdFlag() || process.env.NODE_ENV !== "development";
  return stripTrailingSlash(useProd ? API_TARGETS.prod.rentGatewayOrigin : API_TARGETS.local.rentGatewayOrigin);
}

export function resolveBaseApiUrl(): string {
  return gatewayOrigin();
}

export const baseApiUrl = resolveBaseApiUrl();

export function getAuthApiRoot(): string {
  return authServiceBase();
}

export function getRentApiRoot(): string {
  return `${rentGatewayOrigin()}/rent`;
}
