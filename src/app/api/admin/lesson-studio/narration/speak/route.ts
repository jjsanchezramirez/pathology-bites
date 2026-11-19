import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { requireAdmin } from "@/shared/utils/api/api-guard";
import { parseBody } from "@/shared/utils/api/parse-body";
import { getFileContent, uploadToR2 } from "@/shared/services/r2-storage";
import { DEFAULT_TTS_MODEL, RateLimitError, synthesize } from "@/shared/services/gemini-tts";
import { encodeWav, parseWav } from "@/shared/lesson/narration";
import { NARRATION_BUCKET, narrationClipKey } from "../clip-key";
import { log } from "@/shared/utils/logging";

export const maxDuration = 120;

/** Asked of the voice on every slide, so sentence breaks are easy to find. */
const PAUSE_HINT = "Leave a short, clear pause between sentences.";

const schema = z.object({
  voice: z.string().trim().min(1).max(100),
  style: z.string().trim().max(500).optional(),
  model: z.string().trim().max(80).optional(),
  sentences: z.array(z.string().trim().min(1).max(1000)).min(1).max(40),
});

/**
 * @swagger
 * /api/admin/lesson-studio/narration/speak:
 *   post:
 *     summary: Speak one slide's narration with Gemini
 *     description: Speaks one slide's sentences in a single Gemini TTS request and stores the clip in R2, keyed by a hash of the text, voice, delivery and model. A clip that already exists is reused without calling Gemini, so an interrupted run resumes where it stopped and unchanged slides are never re-spoken. Returns 429 with retryAfter (seconds) when Gemini's per-minute limit is hit. Requires admin role.
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
 *             required: [voice, sentences]
 *             properties:
 *               voice: { type: string }
 *               style: { type: string }
 *               model: { type: string }
 *               sentences: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Clip key, whether it was cached, and its length in seconds
 *       429:
 *         description: Gemini rate limit; retry after retryAfter seconds
 *       502:
 *         description: Gemini or storage failure
 */
export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(request, schema);
  if (body instanceof NextResponse) return body;

  const model = body.model || DEFAULT_TTS_MODEL;
  const style = [body.style?.trim(), PAUSE_HINT].filter(Boolean).join(" ");
  const sentences = body.sentences as string[];
  const key = narrationClipKey(
    createHash("sha256")
      .update(JSON.stringify({ v: 1, model, voice: body.voice, style, sentences }))
      .digest("hex")
  );

  try {
    const existing = await getFileContent(NARRATION_BUCKET, key);
    if (existing && existing.length > 44) {
      const clip = parseWav(existing);
      return NextResponse.json({
        key,
        cached: true,
        duration: clip.samples.length / clip.sampleRate,
      });
    }

    const pcm = await synthesize(sentences.join(" "), { voice: body.voice, style, model });
    const wav = encodeWav(pcm);
    await uploadToR2(Buffer.from(wav), key, {
      contentType: "audio/wav",
      cacheControl: "private, max-age=0",
      bucket: NARRATION_BUCKET,
      metadata: { uploadedBy: auth.userId, purpose: "narration-clip" },
    });
    return NextResponse.json({
      key,
      cached: false,
      duration: pcm.samples.length / pcm.sampleRate,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Gemini's per-minute limit was reached.", retryAfter: error.retryAfter },
        { status: 429, headers: { "Retry-After": String(error.retryAfter) } }
      );
    }
    log.error("[narration] speak failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Speech failed" },
      { status: 502 }
    );
  }
}
