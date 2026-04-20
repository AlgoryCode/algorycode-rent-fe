import axios from "axios";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getJsonErrorText } from "@/lib/api-error-text";
import { getUserIdFromAccessToken } from "@/lib/auth-user";
import { AUTH_BASE } from "@/lib/config";

type Body = { currentPassword?: string; newPassword?: string };

/** AuthService: POST {AUTH_BASE}/account/change-password — JWT + X-User-Id. */
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const accessToken =
      cookieStore.get("accessToken")?.value || cookieStore.get("algory_access_token")?.value || null;
    if (!accessToken) {
      return NextResponse.json({ message: "Oturum gerekli" }, { status: 401 });
    }

    const userId = getUserIdFromAccessToken(accessToken);
    if (userId == null) {
      return NextResponse.json({ message: "Token'da kullanıcı bilgisi yok" }, { status: 401 });
    }

    const body = (await req.json()) as Body;
    if (!body?.currentPassword || !body?.newPassword) {
      return NextResponse.json({ message: "Mevcut şifre ve yeni şifre gerekli" }, { status: 400 });
    }

    const upstream = await axios.post(
      `${AUTH_BASE}/account/change-password`,
      { currentPassword: body.currentPassword, newPassword: body.newPassword },
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
      const raw = upstream.data;
      let message = typeof raw === "string" ? raw : JSON.stringify(raw);
      if (raw != null && typeof raw === "object") {
        message = getJsonErrorText(raw) || message;
      }
      return NextResponse.json({ message: message || "Şifre değiştirilemedi" }, { status: upstream.status });
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 });
  }
}
