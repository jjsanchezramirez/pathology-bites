// src/app/api/user/ask-albright/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  type AskEvent,
  type AskResult,
  NoPassagesError,
  askAlbright,
  askAlbrightStream,
  isAskAlbrightAvailable,
} from "@/features/user/ask-albright/lib/ask";
import { recordCost, reserveQuestion } from "@/features/user/ask-albright/lib/usage";
import { findInHistory, saveHistory } from "@/features/user/ask-albright/lib/history";
import { MAX_QUESTION_CHARS } from "@/features/user/ask-albright/lib/router";
import { requireUser } from "@/shared/utils/api/api-guard";
import { APIRateLimiter } from "@/shared/utils/api/api-rate-limiter";
import { apiError, parseBody } from "@/shared/utils/api/parse-body";
import { log } from "@/shared/utils/logging";

const bodySchema = z.object({
  question: z.string().trim().min(2, "Ask a question").max(MAX_QUESTION_CHARS),
});

// Burst guard, in memory (per instance). The real limits are durable and
// daily (lib/usage.ts): per user, and a global budget; each answer is capped
// at 0.20¢ (lib/cost.ts).
const perMinute = new APIRateLimiter({ windowMs: 60_000, maxRequests: 10 });

const NDJSON = "application/x-ndjson";

/** One JSON object per line: meta, delta…, then done (with historyId) or error. */
function streamResponse(
  events: AsyncGenerator<AskEvent>,
  finish: (result: AskResult) => Promise<Record<string, unknown>>
): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(`${JSON.stringify(obj)}\n`));
      try {
        for await (const ev of events) {
          if (ev.type === "done") send({ type: "done", ...(await finish(ev.result)) });
          else send(ev);
        }
      } catch (err) {
        if (err instanceof NoPassagesError)
          send({ type: "error", status: 404, error: err.message });
        else {
          log.error("[ask-albright] failed", err);
          send({
            type: "error",
            status: 502,
            error: "Dr. Albright couldn't answer that right now",
          });
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, {
    headers: { "Content-Type": NDJSON, "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}

function limited(resetTime: number, message: string): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((resetTime - Date.now()) / 1000));
  return NextResponse.json(
    { error: message, retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

/**
 * @swagger
 * /api/user/ask-albright:
 *   post:
 *     summary: Ask Dr. Albright a short pathology question
 *     description: >
 *       Routes the question to one source (PathologyOutlines, PubMed or WHO via
 *       PathTalk) with a small Workers AI model, retrieves the top passages, and
 *       returns a brief cited answer. Each answer costs at most $0.002. Send
 *       `Accept: application/x-ndjson` to stream it: one JSON object per line —
 *       `meta` (citations, tables), `delta` (text), `reset`, then `done` (the
 *       full answer below) or `error`. Limited per user (10/min, and a daily
 *       cap) and by a global daily budget.
 *     tags:
 *       - User - Ask Dr. Albright
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [question]
 *             properties:
 *               question:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 300
 *     responses:
 *       200:
 *         description: Answer with citations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 answer: { type: string }
 *                 source: { type: string, enum: [outlines, pubmed, who] }
 *                 sourceLabel: { type: string }
 *                 cached: { type: boolean }
 *                 tokens: { type: integer }
 *                 historyId: { type: string, nullable: true, description: id of the saved history entry }
 *                 followUps: { type: array, items: { type: string }, description: suggested next questions }
 *                 repeated: { type: boolean, description: true when this question was already in the caller's history and the saved answer is returned (no AI call) }
 *                 citations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       n: { type: integer }
 *                       title: { type: string }
 *                       href: { type: string }
 *                 tables:
 *                   type: array
 *                   description: Symbol tables (e.g. IHC panels) rebuilt from the cited passages
 *                   items:
 *                     type: object
 *                     properties:
 *                       n: { type: integer, description: citation number }
 *                       headers: { type: array, items: { type: string } }
 *                       focusRows: { type: array, items: { type: string } }
 *                       rows:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             name: { type: string }
 *                             cells: { type: array, items: { type: string } }
 *       400: { description: Invalid question }
 *       401: { description: Not signed in }
 *       404: { description: No passages found for the question }
 *       429: { description: Per-minute, daily, or global daily limit reached }
 *       502: { description: Upstream AI or search failure }
 *       503: { description: Feature switched off or not configured }
 */
export async function POST(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  if (!isAskAlbrightAvailable()) {
    return apiError("Dr. Albright is unavailable right now", 503);
  }

  const body = await parseBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  const wantsStream = (request.headers.get("accept") ?? "").includes(NDJSON);

  // Dev-only eval mode (tests/eval/ask-albright.eval.mjs): a fresh answer every
  // time — no history, no cache, no limits. Ignored in production.
  const evalMode =
    process.env.NODE_ENV !== "production" && request.headers.get("x-ask-albright-eval") === "1";
  if (evalMode) {
    if (wantsStream) {
      return streamResponse(askAlbrightStream(body.question, { noCache: true }), async (r) => ({
        ...r,
      }));
    }
    try {
      return NextResponse.json(await askAlbright(body.question, { noCache: true }));
    } catch (err) {
      if (err instanceof NoPassagesError) return apiError(err.message, 404);
      return apiError(err instanceof Error ? err.message : "failed", 502);
    }
  }

  // Asked before? Return the saved answer: no AI call, no rate-limit charge.
  try {
    const prior = await findInHistory(auth.userId, body.question);
    if (prior) {
      return NextResponse.json({
        ...prior.result,
        followUps: prior.result.followUps ?? [],
        cached: true,
        tokens: 0,
        historyId: prior.id,
        feedback: prior.feedback,
        repeated: true,
      });
    }
  } catch (err) {
    log.warn("[ask-albright] history lookup failed; answering fresh", err);
  }

  const minute = perMinute.checkLimit(auth.userId, "ask-albright");
  if (!minute.allowed) return limited(minute.resetTime, "Slow down — try again in a minute.");
  // Admins have no per-user daily cap; the global budget still applies to them.
  const reservation = await reserveQuestion(auth.userId, { uncapped: auth.role === "admin" });
  if (!reservation.allowed) {
    if (reservation.reason === "unavailable")
      return apiError("Dr. Albright is unavailable right now", 503);
    const midnight = new Date();
    midnight.setUTCHours(24, 0, 0, 0);
    return limited(
      midnight.getTime(),
      reservation.reason === "global"
        ? "Dr. Albright has reached today's limit. Try again tomorrow."
        : "Daily question limit reached. Try again tomorrow."
    );
  }

  // Saved to the user's account history and costed (neither fails the answer).
  const finish = async (result: AskResult) => {
    log.info(
      `[ask-albright] source=${result.source} cached=${result.cached} tokens=${result.tokens} cost=${result.costUsd ?? 0}`
    );
    // Declines aren't saved: a repeat would replay the decline from history
    // instead of planning again ("Hans algorithm" stuck as off-topic).
    const [historyId] = await Promise.all([
      result.scope ? Promise.resolve(null) : saveHistory(auth.userId, body.question, result),
      recordCost(auth.userId, result.costUsd ?? 0),
    ]);
    return { ...result, historyId };
  };

  if (wantsStream) return streamResponse(askAlbrightStream(body.question), finish);

  try {
    return NextResponse.json(await finish(await askAlbright(body.question)));
  } catch (err) {
    if (err instanceof NoPassagesError) return apiError(err.message, 404);
    log.error("[ask-albright] failed", err);
    return apiError("Dr. Albright couldn't answer that right now", 502);
  }
}
