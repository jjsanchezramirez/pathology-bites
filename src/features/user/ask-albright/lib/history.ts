import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/shared/services/service-role-client";
import { log } from "@/shared/utils/logging";
import type { AskResult } from "./ask";
import { normalizeQuestion } from "./router";

/**
 * Per-user Ask Dr. Albright history (public.ask_albright_history).
 *
 * The table denies all client access; only these helpers touch it, with the
 * service-role client, always scoped to the middleware-verified user id the
 * route passes in. Writes never fail a question: history is a convenience.
 */

export interface HistoryEntry {
  id: string;
  question: string;
  result: AskResult;
  createdAt: string;
}

/** Rows kept per user; older ones are pruned on write. */
export const HISTORY_KEEP = 100;

// The table postdates the generated Database types; keep this module untyped
// rather than regenerating every table's types for one addition.
function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

const TABLE = "ask_albright_history";

export async function saveHistory(
  userId: string,
  question: string,
  result: AskResult
): Promise<string | null> {
  try {
    const sb = db();
    const { data, error } = await sb
      .from(TABLE)
      .insert({ user_id: userId, question, result: { ...result, cached: false } })
      .select("id")
      .single();
    if (error) throw error;

    // Prune beyond the newest HISTORY_KEEP. Ordered by created_at, then id, so
    // paging is stable (unordered .range() drops rows).
    const { data: old, error: oldErr } = await sb
      .from(TABLE)
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(HISTORY_KEEP, HISTORY_KEEP + 99);
    if (oldErr) throw oldErr;
    if (old && old.length > 0) {
      await sb
        .from(TABLE)
        .delete()
        .eq("user_id", userId)
        .in(
          "id",
          old.map((r: { id: string }) => r.id)
        );
    }
    return (data as { id: string }).id;
  } catch (err) {
    log.warn("[ask-albright] history save failed", err);
    return null;
  }
}

export async function listHistory(userId: string, limit = 20): Promise<HistoryEntry[]> {
  const { data, error } = await db()
    .from(TABLE)
    .select("id, question, result, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(
    (r: { id: string; question: string; result: AskResult; created_at: string }) => ({
      id: r.id,
      question: r.question,
      result: r.result,
      createdAt: r.created_at,
    })
  );
}

/**
 * The caller's saved entry for this question (same after normalising case,
 * spacing and trailing punctuation), if any. Lets a repeat be answered from
 * history: no AI call, and it does not count against the rate limit.
 */
export async function findInHistory(
  userId: string,
  question: string
): Promise<HistoryEntry | null> {
  const want = normalizeQuestion(question);
  const recent = await listHistory(userId, HISTORY_KEEP);
  return recent.find((e) => normalizeQuestion(e.question) === want) ?? null;
}

/** Delete one entry (when `id` is given) or the user's whole history. */
export async function clearHistory(userId: string, id?: string): Promise<void> {
  let q = db().from(TABLE).delete().eq("user_id", userId);
  if (id) q = q.eq("id", id);
  const { error } = await q;
  if (error) throw error;
}
