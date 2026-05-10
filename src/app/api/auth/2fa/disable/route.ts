import axios from "axios";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  getJsonErrorText,
  isLikelyWrongTotpBackendText,
  TOTP_WRONG_USER_MESSAGE,
} from "@/lib/api-error-text";
import { getUserIdFromAccessToken } from "@/lib/auth-user";
import { AUTH_BASE } from "@/lib/config";
import { readAccessTokenFromCookies } from "@/lib/server/auth-cookies";

type Body = { code?: string };

export async function POST(req: Request) {
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

    const body = (await req.json()) as Body;
    if (!body?.code || !/^\d{6}$/.test(String(body.code).trim())) {
      return NextResponse.json({ message: "Geçerli 6 haneli kod gerekli" }, { status: 400 });
    }

    const upstream = await axios.post(
      `${AUTH_BASE}/2fa/disable`,
      { code: String(body.code).trim() },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-User-Id": String(userId),
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        validateStatus: () => true,
        timeout: 20_000,
      },
    );

    if (upstream.status < 200 || upstream.status >= 300) {
      let message = getJsonErrorText(upstream.data) || String(upstream.data ?? "");
      if (upstream.status === 500 && isLikelyWrongTotpBackendText(message)) {
        message = TOTP_WRONG_USER_MESSAGE;
      } else if (upstream.status === 401) {
        const m = String(message).toLowerCase();
        if (!m.trim()) {
          message = "Oturum doğrulanamadı. Yeniden giriş yapın.";
        } else if (!/oturum|token|giriş|yetkisiz/i.test(m)) {
          message = TOTP_WRONG_USER_MESSAGE;
        }
      }
      return NextResponse.json({ message: message || "2FA kapatılamadı" }, { status: upstream.status });
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 });
  }
}
