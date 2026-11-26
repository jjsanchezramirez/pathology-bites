// src/app/api/user/ask-albright/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clearHistory, listHistory, setFeedback } from "@/features/user/ask-albright/lib/history";
import { requireUser } from "@/shared/utils/api/api-guard";
import { apiError, parseBody } from "@/shared/utils/api/parse-body";
import { log } from "@/shared/utils/logging";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @swagger
 * /api/user/ask-albright/history:
 *   get:
 *     summary: The caller's recent Ask Dr. Albright questions
 *     description: Newest first, with the full answer that was shown. Only the caller's own entries.
 *     tags:
 *       - User - Ask Dr. Albright
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 20 }
 *     responses:
 *       200:
 *         description: History entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 entries:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       question: { type: string }
 *                       createdAt: { type: string, format: date-time }
 *                       result: { type: object, description: The answer as POST /api/user/ask-albright returned it }
 *                       feedback: { type: integer, nullable: true, enum: [-1, 1], description: the caller's thumbs on this answer }
 *       401: { description: Not signed in }
 *   delete:
 *     summary: Clear the caller's Ask Dr. Albright history
 *     description: Deletes one entry when `id` is given, otherwise all of the caller's entries.
 *     tags:
 *       - User - Ask Dr. Albright
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Deleted }
 *       400: { description: Invalid id }
 *       401: { description: Not signed in }
 *   patch:
 *     summary: Rate one of the caller's Ask Dr. Albright answers
 *     description: Thumbs up (1), thumbs down (-1), or clear the rating (0).
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
 *             required: [id, rating]
 *             properties:
 *               id: { type: string, format: uuid }
 *               rating: { type: integer, enum: [-1, 0, 1] }
 *     responses:
 *       200: { description: Saved }
 *       400: { description: Invalid body }
 *       401: { description: Not signed in }
 *       404: { description: No such entry for the caller }
 */
export async function GET(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const raw = Number(new URL(request.url).searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(raw) ? Math.min(50, Math.max(1, Math.floor(raw))) : 20;
  try {
    return NextResponse.json({ entries: await listHistory(auth.userId, limit) });
  } catch (err) {
    log.error("[ask-albright] history list failed", err);
    return apiError("Couldn't load your history", 502);
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const id = new URL(request.url).searchParams.get("id") ?? undefined;
  if (id !== undefined && !UUID.test(id)) return apiError("Invalid id", 400);
  try {
    await clearHistory(auth.userId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("[ask-albright] history clear failed", err);
    return apiError("Couldn't clear your history", 502);
  }
}

const feedbackSchema = z.object({
  id: z.string().regex(UUID, "Invalid id"),
  rating: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
});

export async function PATCH(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(request, feedbackSchema);
  if (body instanceof NextResponse) return body;
  try {
    const found = await setFeedback(auth.userId, body.id, body.rating);
    if (!found) return apiError("Not found", 404);
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("[ask-albright] feedback save failed", err);
    return apiError("Couldn't save your rating", 502);
  }
}
