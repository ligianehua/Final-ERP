import { createClient } from "@supabase/supabase-js"

/**
 * Service-role Supabase client. Used by the daily cron and any other
 * server-only path that needs to bypass RLS (e.g. inserting reminders
 * across users).
 *
 * NEVER import this from a client component — the service role key
 * would leak in the bundle.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL are required for the admin client",
    )
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
