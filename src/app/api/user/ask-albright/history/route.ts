// src/app/api/user/ask-albright/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { clearHistory, listHistory } from "@/features/user/ask-albright/lib/history";
import { requireUser } from "@/shared/utils/api/api-guard";
import { apiError } from "@/shared/utils/api/parse-body";
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
