import { NextRequest, NextResponse } from "next/server";

import { resolveRentApiUpstreamUrl } from "@/lib/rent-api-upstream.server";

/**
 * Rent BFF (yalnızca Next.js tarafında): tarayıcı `/api/rent/vehicles` gibi çağırır; burada üretilen
 * upstream URL **`/api` içermez** — örn. `https://…/rent/vehicles` (Spring’de `/vehicles` ile aynı).
 * `app/api/…` klasörü Next route kuralıdır; Java rent servisinde `/api` prefix’i yoktur.
 */

function bearerFromSessionCookies(req: NextRequest): string | undefined {
  const raw =
    req.cookies.get("algory_access_token")?.value ||
    req.cookies.get("accessToken")?.value ||
    req.cookies.get("access_token")?.value;
  if (!raw?.trim()) return undefined;
  const t = raw.trim();
  return t.toLowerCase().startsWith("bearer ") ? t : `Bearer ${t}`;
}

function forwardRequestHeaders(req: NextRequest): Headers {
  const h = new Headers();
  const accept = req.headers.get("accept");
  if (accept) h.set("Accept", accept);
  const ct = req.headers.get("content-type");
  if (ct) h.set("Content-Type", ct);
  const auth = req.headers.get("authorization") ?? bearerFromSessionCookies(req);
  if (auth) h.set("Authorization", auth);
  return h;
}

async function proxy(req: NextRequest, pathSegments: string[], method: string): Promise<NextResponse> {
  const base = resolveRentApiUpstreamUrl();

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

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upstream fetch failed";
    return NextResponse.json({ message: `Rent API'ye ulasilamadi: ${message}`, upstream: base }, { status: 502 });
  }
  const outHeaders = new Headers();
  const resCt = res.headers.get("content-type");
  if (resCt) outHeaders.set("Content-Type", resCt);
  if (res.status >= 500) {
    outHeaders.set("X-Rent-Upstream-Base", base);
  }

  const buf = await res.arrayBuffer();
  if (res.status === 503 && buf.byteLength === 0) {
    return NextResponse.json(
      {
        message:
          "Rent upstream 503 (bos govde). Genelde gateway Eureka’da rent servisi yok / LB bulamıyor. " +
          "Vercel’de RENT_API_UPSTREAM ile dogrudan rent public URL kullanin (ornek: https://rental.algorycode.com).",
        upstream: base,
      },
      { status: 503, headers: outHeaders },
    );
  }
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
