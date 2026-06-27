import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only **service-role** Supabase client. Bypasses RLS, so use it ONLY inside route
 * handlers that have already been authorized (middleware role check / explicit gate), never
 * in client code.
 *
 * Caveats (see CLAUDE.md "Security" + the SECURITY DEFINER gotchas):
 *  - `auth.uid()` is NULL for service-role calls. A SECURITY DEFINER RPC with an internal
 *    `auth.uid()` check will not see the caller — pass the user id explicitly instead.
 *  - `persistSession` / `autoRefreshToken` are off: they're browser-only concerns (localStorage,
 *    refresh timers) and no-ops in a one-shot server request, but set explicitly for clarity.
 */
export function createServiceRoleClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
