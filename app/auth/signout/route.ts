import { cookies } from "next/headers";
import { ORG_COOKIE } from "@/lib/portal/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  if (isSupabaseConfigured()) await createClient().auth.signOut({ scope: "local" });
  cookies().delete(ORG_COOKIE);
  // Relative so the browser stays on whichever portal host it signed out from.
  return new Response(null, { status: 303, headers: { Location: "/login" } });
}
