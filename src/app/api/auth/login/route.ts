import axios from "axios";
import { NextResponse } from "next/server";

import { getExpFromAccessToken } from "@/lib/auth-user";
import { isSupabaseAuthEnabled } from "@/lib/data-source";
import { AUTH_BASE } from "@/lib/config";
import { applyRentFeRolesCookie, applyRentFeRolesFromList } from "@/lib/rbac/role-cookie";
import type { RentAppRole } from "@/lib/rbac/rent-roles";
import { isRentAppRole } from "@/lib/rbac/rent-roles";
import { setAuthCookies, setTwoFactorPendingCookie } from "@/lib/server/auth-cookies";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LoginBody = {
  email?: string;
  password?: string;
};

function rolesFromProfile(raw: unknown): RentAppRole[] {
  if (!Array.isArray(raw)) return ["RENT_USER"];
  const out: RentAppRole[] = [];
  for (const r of raw) {
    if (typeof r === "string" && isRentAppRole(r)) out.push(r);
  }
  return out.length > 0 ? out : ["RENT_USER"];
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LoginBody;
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ message: "E-posta ve şifre gerekli" }, { status: 400 });
    }

    if (isSupabaseAuthEnabled()) {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        return NextResponse.json({ message: error?.message ?? "Giriş başarısız" }, { status: 401 });
      }

      const { data: profile } = await supabase
        .from("rent_profiles")
        .select("rent_roles, full_name, email")
        .eq("id", data.user.id)
        .maybeSingle();

      const roles = rolesFromProfile(profile?.rent_roles);
      const response = NextResponse.json(
        {
          email: data.user.email,
          firstName: profile?.full_name?.split(" ")[0] ?? "",
          lastName: profile?.full_name?.split(" ").slice(1).join(" ") ?? "",
          accessTokenExpiresAt: data.session.expires_at
            ? new Date(data.session.expires_at * 1000).toISOString()
            : undefined,
        },
        { status: 200 },
      );
      applyRentFeRolesFromList(response, roles);
      return response;
    }

    const upstream = await axios.post<Record<string, unknown>>(
      `${AUTH_BASE}/basicauth/login`,
      { email, password },
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
