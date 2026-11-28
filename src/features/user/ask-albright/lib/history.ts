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
  /** The user's thumbs on this answer: 1 up, -1 down, null none. */
  feedback: -1 | 1 | null;
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

/**
 * Signed-out questions (public.ask_albright_public_history), kept for quality
 * control: the question, what came of it, the answer or decline the visitor saw
 * (null when nothing was found or the answer failed), and when. Nothing that
 * identifies the visitor is stored (no IP, cookie or usage bucket). Like
 * saveHistory, a failed write never fails the answer.
 */
const PUBLIC_TABLE = "ask_albright_public_history";

export type PublicOutcome = "answered" | "declined" | "clarified" | "not_found" | "failed";

export async function savePublicHistory(
  question: string,
  outcome: PublicOutcome,
  result: AskResult | null
): Promise<void> {
  try {
    const { error } = await db().from(PUBLIC_TABLE).insert({ question, outcome, result });
    if (error) throw error;
  } catch (err) {
    log.warn("[ask-albright] public history save failed", err);
  }
}

export async function listHistory(userId: string, limit = 20): Promise<HistoryEntry[]> {
  const { data, error } = await db()
    .from(TABLE)
    .select("id, question, result, created_at, feedback")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(
    (r: {
      id: string;
      question: string;
      result: AskResult;
      created_at: string;
      feedback: -1 | 1 | null;
    }) => ({
      id: r.id,
      question: r.question,
      result: r.result,
      createdAt: r.created_at,
      feedback: r.feedback ?? null,
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

/**
 * Thumbs up (1), down (-1) or cleared (0) on one of the user's saved answers.
 * False when no entry of theirs has that id.
 */
export async function setFeedback(
  userId: string,
  id: string,
  rating: -1 | 0 | 1
): Promise<boolean> {
  const { data, error } = await db()
    .from(TABLE)
    .update({
      feedback: rating === 0 ? null : rating,
      feedback_at: rating === 0 ? null : new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}
