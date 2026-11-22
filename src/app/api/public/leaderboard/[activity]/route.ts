import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createCookieClient } from "@/shared/services/server";
import { LEADERBOARD_ACTIVITIES } from "@/shared/leaderboard/activities";

// `leaderboard_scores` and `leaderboard_top` are service-role only (RLS on, no
// policies, EXECUTE revoked from anon/authenticated) — see CLAUDE.md gotchas.
function admin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BLOCKED = ["fuck", "shit", "cunt", "nigg", "fag", "rape", "nazi", "bitch", "dick", "cock"];

function cleanNickname(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 24) return null;
  if (!/^[\p{L}\p{N} ._'-]+$/u.test(name)) return null;
  const squashed = name.toLowerCase().replace(/[^a-z]/g, "");
  if (BLOCKED.some((w) => squashed.includes(w))) return null;
  return name;
}

async function currentUserId(): Promise<string | null> {
  try {
    const supabase = await createCookieClient();
    return (await supabase.auth.getUser()).data.user?.id ?? null;
  } catch {
    return null;
  }
}

type Ctx = { params: Promise<{ activity: string }> };

/**
 * @swagger
 * /api/public/leaderboard/{activity}:
 *   get:
 *     summary: Get the top 25 leaderboard scores for an activity
 *     description: Returns the top 25 scores for a registered activity (currently `cell-quiz`). Rows never expose player identifiers; the caller's own rows are flagged with `isYou` (signed-in session, or the `guestId` query parameter for guests). Not cached.
 *     tags:
 *       - Public - Tools
 *     parameters:
 *       - in: path
 *         name: activity
 *         required: true
 *         schema:
 *           type: string
 *           example: cell-quiz
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [all, weekly]
 *           default: all
 *       - in: query
 *         name: guestId
 *         description: The guest's locally stored UUID, used only to flag their own rows
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Leaderboard rows, best first
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rows:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       rank:
 *                         type: integer
 *                       display_name:
 *                         type: string
 *                       score:
 *                         type: number
 *                       duration_ms:
 *                         type: integer
 *                         nullable: true
 *                       meta:
 *                         type: object
 *                       isYou:
 *                         type: boolean
 *       404:
 *         description: Unknown activity
 *       500:
 *         description: Leaderboard unavailable
 *   post:
 *     summary: Submit a leaderboard score
 *     description: Submits the raw result of a round. The server validates the payload and computes the score itself; clients never send a total. Signed-in users rank under their profile name; guests must send a nickname (2-24 characters, filtered) and their guest UUID. A non-empty `referral_source` honeypot is accepted and silently dropped.
 *     tags:
 *       - Public - Tools
 *     parameters:
 *       - in: path
 *         name: activity
 *         required: true
 *         schema:
 *           type: string
 *           example: cell-quiz
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - payload
 *             properties:
 *               payload:
 *                 type: object
 *                 description: Activity-specific raw result. For cell-quiz, an `answers` array with one `{ correct, ms }` entry per question.
 *               nickname:
 *                 type: string
 *                 description: Required for guests
 *               guestId:
 *                 type: string
 *                 format: uuid
 *                 description: Required for guests
 *               referral_source:
 *                 type: string
 *                 description: Honeypot — leave empty
 *     responses:
 *       200:
 *         description: Score saved (or honeypot submission dropped)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 score:
 *                   type: number
 *       400:
 *         description: Invalid JSON, invalid submission, or missing guest nickname/id
 *       404:
 *         description: Unknown activity
 *       500:
 *         description: Could not save score
 */

export async function GET(request: NextRequest, { params }: Ctx) {
  const { activity } = await params;
  if (!LEADERBOARD_ACTIVITIES[activity]) {
    return NextResponse.json({ error: "Unknown activity" }, { status: 404 });
  }
  const period = request.nextUrl.searchParams.get("period") === "weekly" ? "weekly" : "all";
  const { data, error } = await admin().rpc("leaderboard_top", {
    p_activity: activity,
    p_period: period,
    p_limit: 25,
  });
  if (error) return NextResponse.json({ error: "Leaderboard unavailable" }, { status: 500 });

  // Flag the caller's own row without exposing anyone's identifiers.
  const guestParam = request.nextUrl.searchParams.get("guestId");
  const mine = new Set(
    [await currentUserId(), guestParam && UUID.test(guestParam) ? guestParam : null].filter(Boolean)
  );
  const rows = (data ?? []).map(({ player_key, ...row }: { player_key: string }) => ({
    ...row,
    isYou: mine.has(player_key),
  }));
  return NextResponse.json({ rows }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const { activity } = await params;
  const handler = LEADERBOARD_ACTIVITIES[activity];
  if (!handler) return NextResponse.json({ error: "Unknown activity" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Honeypot — silently accept and drop.
  if (typeof body.referral_source === "string" && body.referral_source) {
    return NextResponse.json({ ok: true });
  }

  const result = handler.validate(body.payload);
  if (!result) return NextResponse.json({ error: "Invalid submission" }, { status: 400 });

  // Identity: signed-in users rank under their profile name; guests need a
  // valid nickname and their locally stored guest id.
  const userId = await currentUserId();
  let displayName: string | null = null;
  if (userId) {
    const { data: profile } = await admin()
      .from("users")
      .select("first_name,last_name")
      .eq("id", userId)
      .maybeSingle();
    const first = profile?.first_name?.trim();
    const last = profile?.last_name?.trim();
    displayName = first ? (last ? `${first} ${last[0]}.` : first) : "Anonymous";
  }
  const guestId = typeof body.guestId === "string" && UUID.test(body.guestId) ? body.guestId : null;
  if (!userId) {
    displayName = cleanNickname(body.nickname);
    if (!displayName || !guestId) {
      return NextResponse.json({ error: "A valid nickname is required" }, { status: 400 });
    }
  }

  const { error } = await admin()
    .from("leaderboard_scores")
    .insert({
      activity,
      user_id: userId,
      guest_id: userId ? null : guestId,
      display_name: (displayName ?? "Anonymous").slice(0, 24),
      score: result.score,
      duration_ms: result.durationMs,
      meta: result.meta as never,
    });
  if (error) return NextResponse.json({ error: "Could not save score" }, { status: 500 });

  return NextResponse.json({ ok: true, score: result.score });
}
