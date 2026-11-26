// src/app/api/public/ask-albright/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  type AskResult,
  NoPassagesError,
  askAlbright,
  askAlbrightStream,
  isAskAlbrightAvailable,
} from "@/features/user/ask-albright/lib/ask";
import {
  ANON_COOKIE,
  ANON_COOKIE_MAX_AGE,
  anonLimits,
  anonRemaining,
  clientNetwork,
  newVisitorId,
  readVisitor,
  recordAnonCost,
  refundAnon,
  reserveAnon,
} from "@/features/user/ask-albright/lib/anon-usage";
import { NDJSON, limited, streamResponse } from "@/features/user/ask-albright/lib/http";
import { budgetMessage } from "@/features/user/ask-albright/lib/usage";
import { MAX_QUESTION_CHARS } from "@/features/user/ask-albright/lib/router";
import { createClient } from "@/shared/services/server";
import { APIRateLimiter } from "@/shared/utils/api/api-rate-limiter";
import { apiError, parseBody } from "@/shared/utils/api/parse-body";
import { log } from "@/shared/utils/logging";

/**
 * Ask Dr. Albright for signed-out visitors: the homepage teaser. A few free
 * answers per browser (lib/anon-usage.ts), then "sign up for more". Nothing is
 * saved to a history. Signed-in visitors are told to use /api/user/ask-albright.
 *
 * Bot defences, cheapest first: Cloudflare Bot Fight Mode (zone-wide, before
 * Vercel); a same-origin check; a honeypot field; a visitor cookie that only
 * the GET hands out (a bare POST loop never has one); a per-network burst
 * limit; then the durable browser / network / global-budget buckets.
 */

const bodySchema = z.object({
  question: z.string().trim().min(2, "Ask a question").max(MAX_QUESTION_CHARS),
  /** Honeypot: hidden in the form; people leave it empty, form-filling bots don't. */
  referral_source: z.string().optional(),
});

// Burst guard per network, in memory (per instance).
const perMinute = new APIRateLimiter({ windowMs: 60_000, maxRequests: 4 });

/** Browsers always send Origin on a POST fetch; it must be this site. */
function sameOrigin(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

function withVisitorCookie<T extends Response>(res: T, visitor: string): T {
  if (res instanceof NextResponse) {
    res.cookies.set(ANON_COOKIE, visitor, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/public/ask-albright",
      maxAge: ANON_COOKIE_MAX_AGE,
    });
  }
  return res;
}

/**
 * @swagger
 * /api/public/ask-albright:
 *   get:
 *     summary: Free-question status for a signed-out visitor
 *     description: >
 *       Returns how many free Ask Dr. Albright questions this browser has left,
 *       and sets the visitor cookie the POST requires. `signedIn: true` means
 *       the caller has a session and should use /api/user/ask-albright instead.
 *     tags:
 *       - Public - Ask Dr. Albright
 *     responses:
 *       200:
 *         description: Status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 signedIn: { type: boolean }
 *                 enabled: { type: boolean }
 *                 remaining: { type: integer }
 *                 limit: { type: integer }
 */
export async function GET(request: NextRequest) {
  const limit = anonLimits().free;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) return NextResponse.json({ signedIn: true, enabled: true, remaining: 0, limit });
  } catch {
    // No session machinery available: treat as signed out.
  }
  const enabled = isAskAlbrightAvailable() && anonLimits().global > 0;
  const visitor = readVisitor(request) ?? newVisitorId();
  const remaining = enabled ? await anonRemaining(visitor) : 0;
  const res = NextResponse.json(
    { signedIn: false, enabled, remaining, limit },
    { headers: { "Cache-Control": "no-store" } }
  );
  return withVisitorCookie(res, visitor);
}

/**
 * @swagger
 * /api/public/ask-albright:
 *   post:
 *     summary: Ask Dr. Albright as a signed-out visitor (a few free questions)
 *     description: >
 *       Same answer as /api/user/ask-albright (send `Accept: application/x-ndjson`
 *       to stream), plus `remaining`: free questions this browser has left.
 *       Requires the visitor cookie from GET and a same-origin request. Declined
 *       questions, "nothing found" and failures don't use up a free question.
 *     tags:
 *       - Public - Ask Dr. Albright
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [question]
 *             properties:
 *               question: { type: string, minLength: 2, maxLength: 300 }
 *     responses:
 *       200: { description: Answer with citations and `remaining` }
 *       400: { description: Invalid question }
 *       403: { description: Not a same-origin browser request, or no visitor cookie }
 *       404: { description: No passages found for the question }
 *       429:
 *         description: >
 *           Free questions used up (`reason: visitor`), the network's daily
 *           allowance used up (`ip`), today's teaser budget spent (`global`), or
 *           too many in a minute (no reason)
 *       502: { description: Upstream AI or search failure }
 *       503: { description: Feature switched off or not configured }
 */
export async function POST(request: NextRequest) {
  if (!isAskAlbrightAvailable() || anonLimits().global === 0) {
    return apiError("Dr. Albright is unavailable right now", 503);
  }
  if (!sameOrigin(request)) return apiError("Forbidden", 403);

  const body = await parseBody(request, bodySchema);
  if (body instanceof NextResponse) return body;
  if (body.referral_source) return apiError("Something went wrong. Try again.", 400);

  const visitor = readVisitor(request);
  const network = clientNetwork(request);
  if (!visitor || !network) return apiError("Reload the page and try again.", 403);

  const minute = perMinute.checkLimit(network, "ask-albright-public");
  if (!minute.allowed) return limited(minute.resetTime, "Slow down — try again in a minute.");

  const reservation = await reserveAnon(visitor, network);
  if (!reservation.allowed) {
    if (reservation.reason === "unavailable")
      return apiError("Dr. Albright is unavailable right now", 503);
    const message =
      reservation.reason === "visitor"
        ? "You've used your free questions. Sign up free to keep asking."
        : reservation.reason === "ip"
          ? "Free questions from your network are used up for today. Sign up free to keep asking."
          : reservation.period === "day" || !reservation.period
            ? "Dr. Albright has answered all the free questions he can today. Sign up free to keep asking."
            : budgetMessage(reservation.period);
    return NextResponse.json(
      { error: message, reason: reservation.reason, remaining: reservation.remaining },
      { status: 429 }
    );
  }
  const { remaining } = reservation;
  const refund = () => refundAnon(visitor, network);

  const finish = async (result: AskResult) => {
    log.info(
      `[ask-albright] public source=${result.source} cached=${result.cached} cost=${result.costUsd ?? 0}`
    );
    // A decline ("I only answer pathology") isn't an answer: give it back.
    if (result.scope) {
      await refund();
      return { ...result, historyId: null, remaining: remaining + 1 };
    }
    await recordAnonCost(visitor, result.costUsd ?? 0);
    return { ...result, historyId: null, remaining };
  };

  const wantsStream = (request.headers.get("accept") ?? "").includes(NDJSON);
  if (wantsStream) return streamResponse(askAlbrightStream(body.question), finish, refund);

  try {
    return NextResponse.json(await finish(await askAlbright(body.question)));
  } catch (err) {
    await refund();
    if (err instanceof NoPassagesError) return apiError(err.message, 404);
    log.error("[ask-albright] public failed", err);
    return apiError("Dr. Albright couldn't answer that right now", 502);
  }
}
