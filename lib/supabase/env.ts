export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

/** Supabase's newer publishable key (sb_publishable_...) or the legacy anon key. */
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseKey);
}
