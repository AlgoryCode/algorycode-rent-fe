import axios from "axios";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getJsonErrorText } from "@/lib/api-error-text";
import { getUserIdFromAccessToken } from "@/lib/auth-user";
import { AUTH_BASE } from "@/lib/config";
import { readAccessTokenFromCookies } from "@/lib/server/auth-cookies";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const accessToken = readAccessTokenFromCookies(cookieStore);
    if (!accessToken) {
      return NextResponse.json({ message: "Oturum gerekli" }, { status: 401 });
    }

    const userId = getUserIdFromAccessToken(accessToken);
    if (userId == null) {
      return NextResponse.json({ message: "Token'da kullanıcı bilgisi yok" }, { status: 401 });
    }

    const upstream = await axios.post<Record<string, unknown>>(
      `${AUTH_BASE}/2fa/setup`,
      undefined,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-User-Id": String(userId),
          Accept: "application/json",
        },
        validateStatus: () => true,
        timeout: 20_000,
      },
    );

    if (upstream.status < 200 || upstream.status >= 300) {
      const message = getJsonErrorText(upstream.data) || "2FA kurulumu başarısız";
      return NextResponse.json({ message }, { status: upstream.status || 400 });
    }

    const payload = upstream.data;
    if (typeof payload === "object" && payload != null) {
      return NextResponse.json(payload);
    }
    return NextResponse.json({ message: "Geçersiz yanıt" }, { status: 502 });
  } catch {
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 });
  }
}
