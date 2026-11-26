import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/shared/utils/api/api-guard";
import { parseBody } from "@/shared/utils/api/parse-body";
import { uploadToR2 } from "@/shared/services/r2-storage";
import { TTS_MAX_LINES_PER_REQUEST, mapLimit, synthesize } from "@/shared/services/gemini-tts";
import {
  DEFAULT_PACING,
  assembleNarration,
  encodeWav,
  trimSilence,
  type ClipInput,
} from "@/shared/lesson/narration";
import { NARRATION_BUCKET, narrationPartKey } from "@/shared/lesson/narration-parts";
import { log } from "@/shared/utils/logging";

// One TTS call per sentence, spaced to Gemini's per-minute limit (about 6 s
// apart on the 10-a-minute tier), so one request speaks at most
// TTS_MAX_LINES_PER_REQUEST sentences. The studio narrates longer lessons in
// several of these requests, then joins them with narration/finish.
// 300 s needs Fluid Compute (`"fluid": true` in vercel.json).
export const maxDuration = 300;

const SAMPLE_RATE = 24000;
const MAX_CHARS = 12_000;

const schema = z.object({
  voice: z.string().trim().min(1).max(100),
  style: z.string().trim().max(500).optional(),
  model: z.string().trim().max(80).optional(),
  /** Groups the parts of one narration run (client-generated). */
  session: z.string().uuid(),
  /** This part's position in the run, from 0. */
  part: z.number().int().min(0).max(199),
  pacing: z
    .object({
      leadIn: z.number().min(0).max(5),
      gap: z.number().min(0).max(5),
      tail: z.number().min(0).max(5),
    })
    .partial()
    .optional(),
  slides: z
    .array(
      z.object({
        slideId: z.string().min(1),
        /** Current slide length; used as silence for slides with no script. */
        duration: z.number().min(0).max(600),
        lines: z.array(
          z.object({ id: z.string().min(1), text: z.string().trim().min(1).max(1000) })
        ),
      })
    )
    .min(1)
    .max(200),
});

/**
 * @swagger
 * /api/admin/lesson-studio/narration/generate:
 *   post:
 *     summary: Narrate one part of a lesson with Gemini
 *     description: Speaks each slide's narration lines with Gemini TTS (one call per sentence) and lays them out with fixed pauses into one part of the narration track, kept in R2 until narration/finish joins the parts. Returns the part's key, its per-slide cues (slide durations and each line's start/end, slide-relative) and its word timings (relative to the part). A lesson longer than maxLinesPerRequest sentences (see narration/voices) is sent as several parts, whole slides each. Requires admin role.
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
 *             required: [voice, session, part, slides]
 *             properties:
 *               voice: { type: string, description: "Prebuilt voice name or designed voice id" }
 *               style: { type: string, description: "Delivery instructions (not spoken)" }
 *               model: { type: string, example: "gemini-3.8-flash-tts" }
 *               session: { type: string, format: uuid }
 *               part: { type: integer }
 *               slides:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     slideId: { type: string }
 *                     duration: { type: number }
 *                     lines:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           text: { type: string }
 *     responses:
 *       200:
 *         description: "{ part: { key, duration, transcript, wordTimings }, slides: cues }"
 *       400:
 *         description: No script, or too many sentences for one part
 *       502:
 *         description: Gemini or storage failure
 */
export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(request, schema);
  if (body instanceof NextResponse) return body;

  const jobs = body.slides.flatMap((s) =>
    s.lines.map((l) => ({ slideId: s.slideId, lineId: l.id, text: l.text }))
  );
  if (jobs.length > TTS_MAX_LINES_PER_REQUEST) {
    return NextResponse.json(
      {
        error: `Too many sentences for one part (${jobs.length}); the limit is ${TTS_MAX_LINES_PER_REQUEST}.`,
      },
      { status: 400 }
    );
  }
  const chars = jobs.reduce((n, j) => n + j.text.length, 0);
  if (chars > MAX_CHARS) {
    return NextResponse.json({ error: `Part too long (${chars} characters).` }, { status: 400 });
  }

  try {
    const started = Date.now();
    const clips: ClipInput[] = await mapLimit(jobs, 2, async (job) => {
      const pcm = await synthesize(job.text, {
        voice: body.voice,
        style: body.style,
        model: body.model,
      });
      return { ...job, pcm: trimSilence(pcm) };
    });
    log.info(`[narration] part ${body.part}: ${clips.length} lines in ${Date.now() - started}ms`);

    const track = assembleNarration(
      body.slides.map((s) => s.slideId),
      clips,
      Object.fromEntries(body.slides.map((s) => [s.slideId, s.duration])),
      { ...DEFAULT_PACING, ...body.pacing },
      SAMPLE_RATE
    );
    const key = narrationPartKey(body.session, body.part);
    await uploadToR2(Buffer.from(encodeWav(track.pcm)), key, {
      contentType: "audio/wav",
      cacheControl: "no-store",
      bucket: NARRATION_BUCKET,
      metadata: { uploadedBy: auth.userId, uploadedAt: new Date().toISOString() },
    });

    return NextResponse.json({
      part: {
        key,
        duration: track.duration,
        transcript: track.transcript,
        wordTimings: track.wordTimings,
      },
      slides: track.slides,
    });
  } catch (error) {
    log.error("[narration] part failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Narration failed" },
      { status: 502 }
    );
  }
}
