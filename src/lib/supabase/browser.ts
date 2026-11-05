"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { SUPABASE_AUTH_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function getBrowserSupabase() {
  if (!client) {
    client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookieOptions: SUPABASE_AUTH_COOKIE_OPTIONS,
    });
  }
  return client;
}
