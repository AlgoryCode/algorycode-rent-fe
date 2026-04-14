import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getExpFromAccessToken } from "@/lib/auth-user";
import { AUTH_BASE, COOKIE_MAX_AGE_SECONDS } from "@/lib/config";
import { clearAuthCookies } from "@/lib/server/auth-cookies";

/** Panel httpOnly çerezleriyle AuthService refresh; rent-api 401 sonrası same-origin çağrı. */
export async function POST() {
  try {
    const cookieStore = await cookies();
    const refreshToken =
      cookieStore.get("algory_refresh_token")?.value ||
      cookieStore.get("refreshToken")?.value ||
      null;

    if (!refreshToken?.trim()) {
      const res = NextResponse.json({ message: "Refresh token yok" }, { status: 401 });
      clearAuthCookies(res);
      return res;
    }

    const upstream = await fetch(`${AUTH_BASE}/basicauth/refreshToken`, {
      method: "POST",
      headers: { Cookie: `refreshToken=${refreshToken.trim()}` },
      cache: "no-store",
    });

    const raw = await upstream.text();
    let data: {
      message?: string;
      accessToken?: string;
      refreshToken?: string;
      access_token?: string;
      refresh_token?: string;
    } = {};
    try {
      data = raw ? (JSON.parse(raw) as typeof data) : {};
    } catch {
      data = { message: raw || "Beklenmeyen yanıt" };
    }

    if (!upstream.ok) {
      const status = upstream.status || 401;
      const response = NextResponse.json(
        { message: typeof data?.message === "string" ? data.message : "Token yenilenemedi" },
        { status },
      );
      if (status === 401) {
        clearAuthCookies(response);
      }
      return response;
    }

    const accessToken = data?.accessToken ?? data?.access_token;
    const newRefresh = data?.refreshToken ?? data?.refresh_token;
    const accessTokenExpiresAt = getExpFromAccessToken(typeof accessToken === "string" ? accessToken : undefined);

    const response = NextResponse.json({ ...data, accessTokenExpiresAt }, { status: 200 });

    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
    };
    if (accessToken) {
      response.cookies.set("algory_access_token", accessToken, cookieOpts);
      response.cookies.set("accessToken", accessToken, cookieOpts);
    }
    if (newRefresh) {
      response.cookies.set("algory_refresh_token", newRefresh, cookieOpts);
      response.cookies.set("refreshToken", newRefresh, cookieOpts);
    }
    return response;
  } catch {
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 });
  }
}
