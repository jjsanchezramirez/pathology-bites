/**
 * Records whether the learner got a generated WSI question right.
 *
 * Volume alone cannot support a claim about an educational tool -- "we served
 * 6,000 questions" says nothing about whether anyone learned. This closes the
 * loop on the row `/generate` already wrote, so each generation carries both
 * what was asked and how it went.
 *
 * Two things this route deliberately does NOT do:
 *
 * - It does not accept a user id from the caller. The row is matched on
 *   `user_id = <the middleware's x-user-id>`, so one learner cannot write an
 *   answer onto another learner's question even with a guessed event id.
 * - It does not let an answer be rewritten. The guard lives in the UPDATE's
 *   WHERE clause (`answered_at IS NULL`), not in a prior SELECT — a read-then-
 *   write check races itself, which is documented in CLAUDE.md and has bitten
 *   the quiz session route before. A second submission simply matches no rows.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";

import { parseBody } from "@/shared/utils/api/parse-body";
import { log } from "@/shared/utils/logging";

const answerSchema = z.object({
  event_id: z.string().uuid(),
  was_correct: z.boolean(),
});

export async function POST(request: NextRequest) {
  const body = await parseBody(request, answerSchema);
  if (body instanceof NextResponse) return body;

  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ success: false, error: "Not configured" }, { status: 500 });
  }

  try {
    const db = createServiceClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await db
      .from("wsi_question_events")
      .update({ answered_at: new Date().toISOString(), was_correct: body.was_correct })
      .eq("id", body.event_id)
      .eq("user_id", userId)
      .is("answered_at", null)
      .select("id");

    if (error) {
      log.error("[WSI Answer] update failed:", error.message);
      return NextResponse.json({ success: false, error: "Could not record" }, { status: 500 });
    }
    // Zero rows means already answered, not this user's, or no such event. All
    // three are fine to report as success: nothing is wrong, and the client has
    // nothing to do about any of them.
    return NextResponse.json({ success: true, recorded: (data ?? []).length > 0 });
  } catch (e) {
    log.error("[WSI Answer] threw:", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ success: false, error: "Could not record" }, { status: 500 });
  }
}
