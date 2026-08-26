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

/**
 * Two things can be reported against a generation, and they arrive at different
 * moments: that the reader was SHOWN it, and how they answered.
 *
 * Delivery is not implied by generation. The generator prefetches the next
 * question while the reader works through the current one, so a question can be
 * built and then discarded when the category changes — never seen by anyone.
 * Without this signal those orphans are indistinguishable from questions that
 * were read and skipped.
 */
const answerSchema = z
  .object({
    event_id: z.string().uuid(),
    delivered: z.literal(true).optional(),
    was_correct: z.boolean().optional(),
  })
  .refine((b) => b.delivered !== undefined || b.was_correct !== undefined, {
    message: "report delivered, was_correct, or both",
  });

/**
 * @swagger
 * /api/user/wsi-questions/answer:
 *   post:
 *     summary: Record delivery and/or the answer outcome for a generated WSI question
 *     description: >
 *       Closes the loop on a row written by /generate. Accepts a delivery signal
 *       (the question was actually shown) and/or the answer outcome (was_correct).
 *       The row is matched on the caller's x-user-id, so one learner cannot write
 *       onto another's event. Guards live in the UPDATE WHERE clause (a delivery
 *       may be re-reported; an answer may not be rewritten).
 *     tags:
 *       - User - WSI Questions
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [event_id]
 *             properties:
 *               event_id:
 *                 type: string
 *                 format: uuid
 *               delivered:
 *                 type: boolean
 *                 description: Set true to stamp that the question was shown
 *               was_correct:
 *                 type: boolean
 *                 description: Whether the learner answered correctly
 *     responses:
 *       200:
 *         description: Outcome recorded (recorded=false if already answered / not found)
 *       400:
 *         description: Validation failed (bad event_id or neither field supplied)
 *       401:
 *         description: Not signed in
 *       500:
 *         description: Server error
 */
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
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {};
    // A question can only be answered after it was shown, and the answer may be
    // the first report we get if the delivery POST was lost. Stamping delivery
    // here too keeps the CHECK (answered => delivered) satisfiable without a
    // second round trip.
    if (body.delivered || body.was_correct !== undefined) patch.delivered_at = now;
    if (body.was_correct !== undefined) {
      patch.answered_at = now;
      patch.was_correct = body.was_correct;
    }

    let q = db
      .from("wsi_question_events")
      .update(patch)
      .eq("id", body.event_id)
      .eq("user_id", userId);
    // Guards live in the WHERE clause, never in a prior SELECT. Delivery may be
    // re-reported harmlessly (first stamp wins); an answer may not be rewritten.
    q = body.was_correct !== undefined ? q.is("answered_at", null) : q.is("delivered_at", null);
    const { data, error } = await q.select("id");

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
