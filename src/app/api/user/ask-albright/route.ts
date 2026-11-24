// src/app/api/user/ask-albright/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  NoPassagesError,
  askAlbright,
  isAskAlbrightAvailable,
} from "@/features/user/ask-albright/lib/ask";
import { findInHistory, saveHistory } from "@/features/user/ask-albright/lib/history";
import { MAX_QUESTION_CHARS } from "@/features/user/ask-albright/lib/router";
import { requireUser } from "@/shared/utils/api/api-guard";
import { APIRateLimiter } from "@/shared/utils/api/api-rate-limiter";
import { apiError, parseBody } from "@/shared/utils/api/parse-body";
import { log } from "@/shared/utils/logging";

const bodySchema = z.object({
  question: z.string().trim().min(5, "Ask a full question").max(MAX_QUESTION_CHARS),
});

// Cost guards. In-memory, so per instance (see api-rate-limiter.ts) — a soft
// cap on spend, not a security boundary. ASK_ALBRIGHT_ENABLED=false is the hard stop.
const perMinute = new APIRateLimiter({ windowMs: 60_000, maxRequests: 10 });
const perDay = new APIRateLimiter({ windowMs: 24 * 60 * 60 * 1000, maxRequests: 50 });

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
 *       returns a brief cited answer. Rate limited per user (10/min, 50/day).
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
 *       429: { description: Rate limit reached }
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
        repeated: true,
      });
    }
  } catch (err) {
    log.warn("[ask-albright] history lookup failed; answering fresh", err);
  }

  const minute = perMinute.checkLimit(auth.userId, "ask-albright");
  if (!minute.allowed) return limited(minute.resetTime, "Slow down — try again in a minute.");
  const day = perDay.checkLimit(auth.userId, "ask-albright");
  if (!day.allowed) return limited(day.resetTime, "Daily question limit reached.");

  try {
    const result = await askAlbright(body.question);
    log.info(
      `[ask-albright] source=${result.source} cached=${result.cached} tokens=${result.tokens}`
    );
    // Saved to the user's account history (never fails the answer).
    const historyId = await saveHistory(auth.userId, body.question, result);
    return NextResponse.json({ ...result, historyId });
  } catch (err) {
    if (err instanceof NoPassagesError) return apiError(err.message, 404);
    log.error("[ask-albright] failed", err);
    return apiError("Dr. Albright couldn't answer that right now", 502);
  }
}
