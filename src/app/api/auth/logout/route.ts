import axios from "axios";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isSupabaseAuthEnabled } from "@/lib/data-source";
import { AUTH_BASE } from "@/lib/config";
import { clearAuthCookies } from "@/lib/server/auth-cookies";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    if (isSupabaseAuthEnabled()) {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    } else {
      const cookieStore = await cookies();
      const refreshToken =
        cookieStore.get("refreshToken")?.value?.trim() ||
        cookieStore.get("algory_refresh_token")?.value?.trim() ||
        null;
      if (refreshToken) {
        await axios
          .post(`${AUTH_BASE}/basicauth/logout`, { refreshToken }, {
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            validateStatus: () => true,
            timeout: 15_000,
          })
          .catch(() => undefined);
      }
    }
  } catch {
    /* best-effort */
  }

  const response = NextResponse.json({ success: true }, { status: 200 });
  clearAuthCookies(response);
  return response;
}
