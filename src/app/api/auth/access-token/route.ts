import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isSupabaseAuthEnabled } from "@/lib/data-source";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  if (isSupabaseAuthEnabled()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token?.trim() || null;
    return NextResponse.json({ accessToken }, { status: 200 });
  }

  const store = await cookies();
  const accessToken =
    store.get("accessToken")?.value?.trim() || store.get("algory_access_token")?.value?.trim() || null;
  return NextResponse.json({ accessToken: accessToken || null }, { status: 200 });
}
