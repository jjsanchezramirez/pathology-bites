/**
 * Records one row per WSI question generation attempt.
 *
 * Before this, nothing did. The route built a question, returned the model,
 * latency and token count in its response, and then dropped all of it; the only
 * memory anywhere was a localStorage list of slide ids the client kept to avoid
 * repeating a slide. So the volume question could only be answered from
 * Cloudflare, which retains 8 days and counts requests rather than people.
 *
 * Two rules this module follows, both learned the hard way elsewhere in this
 * codebase:
 *
 * 1. **Telemetry never fails the request it measures.** Every write is wrapped;
 *    a broken insert logs and returns. A student mid-question must not lose a
 *    generation because an analytics column was renamed.
 *
 * 2. **The service-role client is required, not preferred.** The table has RLS
 *    enabled with no policy, so the cookie-auth client would insert zero rows
 *    and report `error: null` — the silent-empty failure documented in
 *    CLAUDE.md. Inserting through the service role is what makes the write real.
 */
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

import { log } from "@/shared/utils/logging";
import type { VirtualSlide } from "@/shared/types/virtual-slides";

type WsiEventOutcome = "generated" | "model_failed" | "invalid_wsi" | "bad_request";

export interface WsiEventInput {
  outcome: WsiEventOutcome;
  wsi?: Partial<VirtualSlide> | null;
  questionKind?: string | null;
  model?: string | null;
  generationTimeMs?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  errorDetail?: string | null;
}

/** Truncated so one pathological error string cannot bloat the table. */
const clip = (s: unknown, n: number): string | null => {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t ? t.slice(0, n) : null;
};

/**
 * Which part of the product produced this.
 *
 * `/debug/*` pages call the same endpoint, and the bench page calls it in
 * loops. Counting those as student activity would inflate every number in this
 * table, so they are separated at write time — the Referer is the only thing
 * that distinguishes them, since the request body is identical.
 */
function surfaceOf(request: NextRequest): "dashboard" | "debug" | "unknown" {
  const referer = request.headers.get("referer");
  if (!referer) return "unknown";
  try {
    const path = new URL(referer).pathname;
    if (path.startsWith("/debug/")) return "debug";
    if (path.startsWith("/dashboard/")) return "dashboard";
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Returns the new row's id, or null if nothing was written.
 *
 * The id is handed back to the client so it can report the answer against this
 * exact generation. Null is a normal outcome, not an error — the caller treats
 * a missing id as "engagement is not measurable for this one" and carries on.
 */
export async function recordWsiQuestionEvent(
  request: NextRequest,
  input: WsiEventInput
): Promise<string | null> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;

    // Set by middleware for every /api/user/* route. Absent means unauthenticated,
    // which the route rejects before it gets here — but the column stays nullable
    // so a missing header can never be the reason a row is lost.
    const userId = request.headers.get("x-user-id");

    const wsi = input.wsi ?? {};
    const db = createServiceClient(url, key, { auth: { persistSession: false } });

    const { data, error } = await db
      .from("wsi_question_events")
      .insert({
        user_id: userId && /^[0-9a-f-]{36}$/i.test(userId) ? userId : null,
        surface: surfaceOf(request),
        outcome: input.outcome,
        wsi_id: clip(wsi.id, 200),
        repository: clip(wsi.repository, 120),
        category: clip(wsi.category, 120),
        subcategory: clip(wsi.subcategory, 120),
        diagnosis: clip(wsi.diagnosis, 400),
        stain_type: clip(wsi.stain_type, 120),
        question_kind: input.questionKind ?? null,
        model: clip(input.model, 200),
        generation_time_ms: input.generationTimeMs ?? null,
        prompt_tokens: input.promptTokens ?? null,
        completion_tokens: input.completionTokens ?? null,
        error_detail: clip(input.errorDetail, 500),
      })
      .select("id")
      .single();
    if (error) {
      log.error("[WSI Events] insert failed:", error.message);
      return null;
    }
    return (data as { id: string } | null)?.id ?? null;
  } catch (e) {
    log.error("[WSI Events] insert threw:", e instanceof Error ? e.message : String(e));
    return null;
  }
}
