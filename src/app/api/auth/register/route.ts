import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import axios from "axios";

import { AUTH_BASE } from "@/lib/config";
import { decodeJwtPayloadJson, extractRentRolesFromJwtPayload } from "@/lib/rbac/jwt-rent-roles";
import { hasRentManagerAccess } from "@/lib/rbac/rent-roles";

type RegisterBody = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  password?: string;
};

function messageFromBody(data: unknown, fallback: string): string {
  if (data != null && typeof data === "object" && "message" in data) {
    const m = (data as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m.trim();
  }
  return fallback;
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token =
      cookieStore.get("accessToken")?.value?.trim() || cookieStore.get("algory_access_token")?.value?.trim() || "";
    if (!token) {
      return NextResponse.json({ message: "Oturum gerekli" }, { status: 401 });
    }
    const payload = decodeJwtPayloadJson(token);
    const roles = payload ? extractRentRolesFromJwtPayload(payload) : [];
    if (!hasRentManagerAccess(roles)) {
      return NextResponse.json({ message: "Bu işlem için yönetici rolü gerekir" }, { status: 403 });
    }

    const body = (await req.json()) as RegisterBody;
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : undefined;

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json({ message: "Ad, soyad, e-posta ve şifre zorunludur" }, { status: 400 });
    }

    const upstream = await axios.post(
      `${AUTH_BASE}/basicauth/register`,
      {
        firstName,
        lastName,
        email,
        password,
        phoneNumber: phoneNumber && phoneNumber.length > 0 ? phoneNumber : undefined,
        registrationRole: "RENT_USER",
      },
      {
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        validateStatus: () => true,
        timeout: 20_000,
      },
    );

    const parsed: unknown = upstream.data;

    if (upstream.status < 200 || upstream.status >= 300) {
      return NextResponse.json(
        { message: messageFromBody(parsed, `Kayıt başarısız (${upstream.status})`) },
        { status: upstream.status || 400 },
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 });
  }
}
