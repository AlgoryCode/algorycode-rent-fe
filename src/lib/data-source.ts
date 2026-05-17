/** Supabase veri katmanı: URL + anon key tanımlıysa ve devre dışı bırakılmadıysa aktif. */
export function isSupabaseDataEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_USE_RENT_GATEWAY === "true") return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  return Boolean(url && key);
}

export function isSupabaseAuthEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_USE_ALGORY_AUTH === "true") return false;
  return isSupabaseDataEnabled();
}
