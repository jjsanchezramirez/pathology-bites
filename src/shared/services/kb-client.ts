import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/types/supabase";

/**
 * Server-only client for the **knowledge base** (entities, markers, evidence, passages,
 * claims and their kin, plus the `kb_*` / `kg_*` RPCs).
 *
 * Since 2026-11-26 the knowledge base lives in its own Supabase project ("Pathology Bites
 * Knowledge Base") so it can grow without eating the app's 500 MB. Users, quizzes,
 * questions, images and Ask Dr. Albright usage stay in the main project — use
 * `createClient` / `createServiceRoleClient` for those, and this for knowledge-base data.
 * Nothing joins across the two: `questions.entity_id` is a plain uuid now, no FK.
 *
 * Uses the KB project's secret key (bypasses RLS), so call it only from server code. The
 * KB project knows nothing about the app's users: its RLS allows public reads and nothing
 * else, and every write goes through here.
 */
let client: SupabaseClient<Database> | null = null;

export function createKbClient(): SupabaseClient<Database> {
  if (!client) {
    const url = process.env.KB_SUPABASE_URL;
    const key = process.env.KB_SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("KB_SUPABASE_URL / KB_SUPABASE_SERVICE_ROLE_KEY are not set");
    }
    client = createClient<Database>(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}
