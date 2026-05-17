import axios from "axios";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getExpFromAccessToken } from "@/lib/auth-user";
import { isSupabaseAuthEnabled } from "@/lib/data-source";
import { AUTH_BASE, COOKIE_MAX_AGE_SECONDS } from "@/lib/config";
import { applyRentFeRolesCookie, applyRentFeRolesFromList } from "@/lib/rbac/role-cookie";
import type { RentAppRole } from "@/lib/rbac/rent-roles";
import { isRentAppRole } from "@/lib/rbac/rent-roles";
import { clearAuthCookies, clearLegacyAlgoryAuthCookies } from "@/lib/server/auth-cookies";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    if (isSupabaseAuthEnabled()) {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        const res = NextResponse.json({ message: "Oturum yok" }, { status: 401 });
        clearAuthCookies(res);
        return res;
      }
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr || !refreshed.session) {
        const res = NextResponse.json({ message: refreshErr?.message ?? "Token yenilenemedi" }, { status: 401 });
        clearAuthCookies(res);
        return res;
      }
      const { data: profile } = await supabase
        .from("rent_profiles")
        .select("rent_roles")
        .eq("id", refreshed.session.user.id)
        .maybeSingle();
      const roles: RentAppRole[] = Array.isArray(profile?.rent_roles)
        ? profile!.rent_roles.filter((r): r is RentAppRole => typeof r === "string" && isRentAppRole(r))
        : ["RENT_USER"];
      const response = NextResponse.json({ success: true }, { status: 200 });
      applyRentFeRolesFromList(response, roles.length > 0 ? roles : ["RENT_USER"]);
      return response;
    }

    const cookieStore = await cookies();
    const refreshToken =
      cookieStore.get("refreshToken")?.value?.trim() ||
      cookieStore.get("algory_refresh_token")?.value?.trim() ||
      null;

    if (!refreshToken) {
      const res = NextResponse.json({ message: "Refresh token yok" }, { status: 401 });
      clearAuthCookies(res);
      return res;
    }

    const upstream = await axios.post<Record<string, unknown>>(
      `${AUTH_BASE}/basicauth/refreshToken`,
      { refreshToken },
      {
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        validateStatus: () => true,
        timeout: 20_000,
      },
    );

    const raw = upstream.data;
    const data = (typeof raw === "object" && raw != null ? raw : {}) as {
      message?: string;
      accessToken?: string;
      refreshToken?: string;
      access_token?: string;
      refresh_token?: string;
    };

    if (upstream.status < 200 || upstream.status >= 300) {
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
    if (typeof accessToken === "string" && accessToken) {
      response.cookies.set("accessToken", accessToken, cookieOpts);
    }
    if (typeof newRefresh === "string" && newRefresh) {
      response.cookies.set("refreshToken", newRefresh, cookieOpts);
    }
    clearLegacyAlgoryAuthCookies(response);
    if (typeof accessToken === "string" && accessToken) {
      applyRentFeRolesCookie(response, accessToken, data as Record<string, unknown>);
    }
    return response;
  } catch {
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 });
  }
}
