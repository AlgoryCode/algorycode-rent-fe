const stripTrailingSlash = (s: string) => s.replace(/\/+$/, "");

const REMOTE = {
  gatewayOrigin: "http://localhost:8072",
  rentGatewayOrigin: "https://gateway.algorycode.com",
  authServiceBase: "https://auth.algorycode.com/authservice",
} as const;

function envRentGatewayOrigin(): string | undefined {
  const v = process.env.NEXT_PUBLIC_RENT_GATEWAY_URL?.trim();
  return v && v.length > 0 ? stripTrailingSlash(v) : undefined;
}

export function resolveBaseApiUrl(): string {
  return stripTrailingSlash(REMOTE.gatewayOrigin);
}

export const baseApiUrl = resolveBaseApiUrl();

export function getAuthApiRoot(): string {
  return stripTrailingSlash(REMOTE.authServiceBase);
}

export function getRentApiRoot(): string {
  const origin = envRentGatewayOrigin() ?? stripTrailingSlash(REMOTE.rentGatewayOrigin);
   return `${origin}/rent`;
  //return `http://localhost:8090`;
  
}
