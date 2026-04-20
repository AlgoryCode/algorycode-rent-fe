import axios from "axios";
import { NextResponse } from "next/server";

import { getExpFromAccessToken } from "@/lib/auth-user";
import { AUTH_BASE } from "@/lib/config";
import { applyRentFeRolesCookie } from "@/lib/rbac/role-cookie";
import { setAuthCookies, setTwoFactorPendingCookie } from "@/lib/server/auth-cookies";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LoginBody;
    const loginPayload = {
      email: typeof body?.email === "string" ? body.email.trim() : "",
      password: typeof body?.password === "string" ? body.password : "",
    };

    if (!loginPayload.email || !loginPayload.password) {
      return NextResponse.json({ message: "E-posta ve şifre gerekli" }, { status: 400 });
    }

    const upstream = await axios.post<Record<string, unknown>>(
      `${AUTH_BASE}/basicauth/login`,
      loginPayload,
      {
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        validateStatus: () => true,
        timeout: 20_000,
      },
    );

    const data = (typeof upstream.data === "object" && upstream.data != null ? upstream.data : {}) as Record<
      string,
      unknown
    > & {
      message?: string;
      requiresTwoFactor?: boolean;
      twoFactorToken?: string;
      userId?: number;
      email?: string;
      firstName?: string;
      lastName?: string;
      accessToken?: string;
      access_token?: string;
      refreshToken?: string;
      refresh_token?: string;
    };

    if (upstream.status < 200 || upstream.status >= 300) {
      return NextResponse.json(
        { message: typeof data?.message === "string" ? data.message : "Giriş başarısız" },
        { status: upstream.status || 401 },
      );
    }

    if (data?.requiresTwoFactor === true && data?.twoFactorToken) {
      const response = NextResponse.json(
        {
          requiresTwoFactor: true,
          userId: data.userId,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
        },
        { status: 200 },
      );
      setTwoFactorPendingCookie(response, String(data.twoFactorToken));
      return response;
    }

    const accessToken = data?.accessToken ?? data?.access_token;
    const refreshToken = data?.refreshToken ?? data?.refresh_token;
    const accessTokenExpiresAt =
      getExpFromAccessToken(typeof accessToken === "string" ? accessToken : undefined) ?? undefined;

    const response = NextResponse.json({ ...data, accessTokenExpiresAt }, { status: 200 });
    setAuthCookies(
      response,
      typeof accessToken === "string" ? accessToken : undefined,
      typeof refreshToken === "string" ? refreshToken : undefined,
    );
    if (typeof accessToken === "string" && accessToken) {
      applyRentFeRolesCookie(response, accessToken, data);
    }
    return response;
  } catch {
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 });
  }
}
