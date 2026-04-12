import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Sadece aynı origin (panel) istemcisi okur: httpOnly çerezdeki access JWT’yi JSON olarak döner.
 * Tarayıcıdan doğrudan `gateway…/rent` çağrılarında Bearer eklemek için kullanılır (`rent-api` interceptor).
 */
export async function GET() {
  const store = await cookies();
  const accessToken =
    store.get("algory_access_token")?.value?.trim() ||
    store.get("accessToken")?.value?.trim() ||
    null;
  return NextResponse.json({ accessToken: accessToken || null }, { status: 200 });
}
