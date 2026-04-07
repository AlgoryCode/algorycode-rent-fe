import { NextRequest, NextResponse } from "next/server";

/**
 * Rent API BFF: tarayıcı → aynı origin `/api/rent/...` → sunucuda `RENT_API_UPSTREAM`’e iletilir.
 * Böylece CORS / istemci TLS / DNS kaynaklı ERR_NETWORK riski azalır.
 *
 * Gerekli: `NEXT_PUBLIC_RENT_API_BASE=/api/rent` ve sunucuda `RENT_API_UPSTREAM=https://rent-api...` (gizli tutun).
 */
function upstreamBase(): string | null {
  const u = process.env.RENT_API_UPSTREAM?.trim().replace(/\/$/, "");
  return u && u.length > 0 ? u : null;
}

function forwardRequestHeaders(req: NextRequest): Headers {
  const h = new Headers();
  const accept = req.headers.get("accept");
  if (accept) h.set("Accept", accept);
  const ct = req.headers.get("content-type");
  if (ct) h.set("Content-Type", ct);
  const auth = req.headers.get("authorization");
  if (auth) h.set("Authorization", auth);
  return h;
}

async function proxy(req: NextRequest, pathSegments: string[], method: string): Promise<NextResponse> {
  const base = upstreamBase();
  if (!base) {
    return NextResponse.json(
      { message: "RENT_API_UPSTREAM ayarlı değil. Sunucu ortamında gerçek Rent API kök URL’ini verin." },
      { status: 500 },
    );
  }

  const sub = pathSegments.length ? pathSegments.join("/") : "";
  const target = sub ? `${base}/${sub}` : base;
  const url = `${target}${req.nextUrl.search}`;

  const init: RequestInit = {
    method,
    headers: forwardRequestHeaders(req),
    cache: "no-store",
  };

  if (method !== "GET" && method !== "HEAD") {
    const body = await req.text();
    if (body.length > 0) init.body = body;
  }

  const res = await fetch(url, init);
  const outHeaders = new Headers();
  const resCt = res.headers.get("content-type");
  if (resCt) outHeaders.set("Content-Type", resCt);

  const buf = await res.arrayBuffer();
  return new NextResponse(buf, { status: res.status, headers: outHeaders });
}

type RouteCtx = { params: Promise<{ path?: string[] }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path, "GET");
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path, "POST");
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path, "PATCH");
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path, "DELETE");
}
