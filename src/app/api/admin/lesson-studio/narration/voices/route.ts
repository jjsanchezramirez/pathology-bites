import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/shared/utils/api/api-guard";
import { parseBody } from "@/shared/utils/api/parse-body";
import {
  TTS_MAX_LINES_PER_REQUEST,
  DEFAULT_TTS_MODEL,
  PREBUILT_VOICES,
  TTS_MODELS,
  deleteVoice,
  designVoice,
  listVoices,
  type VoiceOption,
} from "@/shared/services/gemini-tts";
import { whisperAvailable } from "@/shared/services/whisper-align";
import { log } from "@/shared/utils/logging";

export const maxDuration = 60;

/**
 * @swagger
 * /api/admin/lesson-studio/narration/voices:
 *   get:
 *     summary: List narration voices
 *     description: Lists Gemini voices for lesson narration (designed voices first, then Gemini's prebuilt voices), the available TTS models, and whether Whisper word timing is configured. Falls back to the prebuilt list if Gemini's voice listing can't be reached. Requires admin role.
 *     tags:
 *       - Admin - Lesson Studio
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Voices, models and timing options
 *   post:
 *     summary: Design a narration voice
 *     description: Creates and stores a Gemini "prompted" voice from a text description and returns its id for use in narration. Requires admin role.
 *     tags:
 *       - Admin - Lesson Studio
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [description]
 *             properties:
 *               description: { type: string, description: "What the voice should sound like" }
 *               displayName: { type: string }
 *               baseVoice: { type: string, description: "Prebuilt voice to start from" }
 *               gender: { type: string }
 *               pitch: { type: string, enum: [low, medium, high] }
 *               accent: { type: string }
 *     responses:
 *       200:
 *         description: The created voice
 *       502:
 *         description: Gemini refused or failed
 */

/**
 * GET: voices the narration panel can use (designed voices first, then
 * Gemini's prebuilt ones), the TTS models, and whether Whisper timing is on.
 */
export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  let voices: VoiceOption[];
  let warning: string | undefined;
  try {
    voices = await listVoices();
  } catch (error) {
    log.warn("[narration] ListVoices failed, using prebuilt list:", error);
    warning = error instanceof Error ? error.message : "Could not list voices";
    voices = PREBUILT_VOICES.map((id) => ({ id, label: id, type: "prebuilt" as const }));
  }
  return NextResponse.json({
    voices,
    models: TTS_MODELS,
    defaultModel: DEFAULT_TTS_MODEL,
    whisper: whisperAvailable(),
    /** Sentences per narration/generate request; longer lessons go in parts. */
    maxLinesPerRequest: TTS_MAX_LINES_PER_REQUEST,
    warning,
  });
}

const designSchema = z.object({
  description: z.string().trim().min(10).max(1000),
  displayName: z.string().trim().max(60).optional(),
  baseVoice: z.string().trim().max(60).optional(),
  gender: z.string().trim().max(30).optional(),
  pitch: z.enum(["low", "medium", "high"]).optional(),
  accent: z.string().trim().max(60).optional(),
});

/** POST: design and store a new voice from a description. */
export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(request, designSchema);
  if (body instanceof NextResponse) return body;
  try {
    const voice = await designVoice({ ...body, description: body.description as string });
    return NextResponse.json({ voice });
  } catch (error) {
    log.error("[narration] voice design failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Voice design failed" },
      { status: 502 }
    );
  }
}

const deleteSchema = z.object({ id: z.string().trim().min(1).max(100) });

/**
 * @swagger
 * /api/admin/lesson-studio/narration/voices:
 *   delete:
 *     summary: Delete a designed narration voice
 *     description: Deletes a voice created with "Design a new voice" from the Gemini account. Prebuilt Gemini voices can't be deleted. Requires admin role.
 *     tags:
 *       - Admin - Lesson Studio
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *             properties:
 *               id:
 *                 type: string
 *                 description: The designed voice's id (e.g. voice_abc123)
 *     responses:
 *       200:
 *         description: Voice deleted
 *       400:
 *         description: Invalid id, or a prebuilt voice
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin role required
 *       502:
 *         description: Gemini rejected the deletion
 */
export async function DELETE(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(request, deleteSchema);
  if (body instanceof NextResponse) return body;
  const prebuilt = (PREBUILT_VOICES as readonly string[]).map((v) => v.toLowerCase());
  if (prebuilt.includes(body.id.toLowerCase())) {
    return NextResponse.json({ error: "Prebuilt voices can't be deleted" }, { status: 400 });
  }
  try {
    await deleteVoice(body.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("[narration] voice deletion failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Voice deletion failed" },
      { status: 502 }
    );
  }
}
