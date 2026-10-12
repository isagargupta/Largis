import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";
import type { Database } from "./types";

/**
 * Secret-key client that bypasses RLS. Reserved for sign-in eligibility checks, creating invited
 * accounts, and applying invitations; returns null until SUPABASE_SECRET_KEY is set.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secret) return null;

  return createClient<Database>(supabaseUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
