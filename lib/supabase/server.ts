import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { supabaseKey, supabaseUrl } from "./env";
import type { Database } from "./types";

export { isSupabaseConfigured } from "./env";

/**
 * The access token the mobile app sends as `Authorization: Bearer …`. Browsers never attach it on
 * their own, so honouring it doesn't open cookie-style cross-site request forgery.
 */
export function bearerToken() {
  const header = headers().get("authorization");
  const match = header ? /^Bearer\s+([A-Za-z0-9._-]+)$/.exec(header.trim()) : null;
  return match ? match[1] : null;
}

/**
 * Server-side Supabase client bound to the request's auth cookies, or to the mobile app's bearer token.
 * All tenant data access relies on RLS policies scoped by organization_id,
 * so this client must never be created with the service-role key.
 */
export function createClient() {
  const token = bearerToken();
  if (token) {
    return createServerClient<Database>(supabaseUrl!, supabaseKey!, {
      cookies: { getAll: () => [], setAll() {} },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  }

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

/** The signed-in user and their access token, from cookies or the bearer header. */
export async function getAuthSession(supabase = createClient()) {
  const token = bearerToken();
  if (token) {
    const { data } = await supabase.auth.getUser(token);
    return { user: data.user ?? null, accessToken: data.user ? token : null };
  }
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { user: null, accessToken: null };
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { user: data.user, accessToken: session?.access_token ?? null };
}
