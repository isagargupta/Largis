import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseKey, supabaseUrl } from "./env";
import type { Database } from "./types";

export { isSupabaseConfigured } from "./env";

/**
 * Server-side Supabase client bound to the request's auth cookies.
 * All tenant data access relies on RLS policies scoped by organization_id,
 * so this client must never be created with the service-role key.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component where cookies are read-only; middleware refreshes the session.
          }
        },
      },
    },
  );
}
