import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/shared/services/server";
import { requireAdmin } from "@/shared/utils/api/api-guard";
import { parseBody } from "@/shared/utils/api/parse-body";
import { deleteFromR2, generateAudioStoragePath, uploadToR2 } from "@/shared/services/r2-storage";
import { mapLimit, synthesize } from "@/shared/services/gemini-tts";
import { transcribeWords, whisperAvailable } from "@/shared/services/whisper-align";
import {
  DEFAULT_PACING,
  assembleNarration,
  encodeWav,
  refineWordTimings,
  trimSilence,
  type ClipInput,
} from "@/shared/lesson/narration";
import type { LessonAudio } from "@/shared/lesson/types";
import type { Json } from "@/shared/types/supabase";
import { log } from "@/shared/utils/logging";

// One TTS call per sentence, four at a time. A 2-minute lesson is ~20
// sentences, which finishes well inside this budget.
export const maxDuration = 300;

const SAMPLE_RATE = 24000;
const MAX_LINES = 150;
const MAX_CHARS = 12_000;

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  voice: z.string().trim().min(1).max(100),
  style: z.string().trim().max(500).optional(),
  model: z.string().trim().max(80).optional(),
  align: z.enum(["estimate", "whisper"]).default("estimate"),
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
 *     summary: Generate lesson narration with Gemini
 *     description: Speaks each slide's narration lines with Gemini TTS (one call per sentence), assembles one WAV track in slide order, stores it in the audio library (R2 + audio table), and returns the track with per-slide cues (new slide durations and each line's start/end) and word timings (estimated per sentence, or refined with Whisper when requested and configured). Requires admin role.
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
 *             required: [title, voice, slides]
 *             properties:
 *               title: { type: string }
 *               voice: { type: string, description: "Prebuilt voice name or designed voice id" }
 *               style: { type: string, description: "Delivery instructions (not spoken)" }
 *               model: { type: string, example: "gemini-3.8-flash-tts" }
 *               align: { type: string, enum: [estimate, whisper] }
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
 *         description: Narration track (LessonAudio) plus per-slide cues
 *       400:
 *         description: No script, or script too long
 *       502:
 *         description: Gemini, storage or database failure
 */

/**
 * POST: narrate a lesson. Speaks each script line with Gemini, builds one WAV
 * track in slide order, stores it in the audio library, and returns the track
 * plus per-slide cues (new slide durations and each line's start/end) for the
 * editor to retime slides and elements.
 */
export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(request, schema);
  if (body instanceof NextResponse) return body;

  const jobs = body.slides.flatMap((s) =>
    s.lines.map((l) => ({ slideId: s.slideId, lineId: l.id, text: l.text }))
  );
  if (!jobs.length)
    return NextResponse.json({ error: "No script to narrate yet." }, { status: 400 });
  if (jobs.length > MAX_LINES) {
    return NextResponse.json(
      { error: `Too many lines (${jobs.length}); the limit is ${MAX_LINES}.` },
      { status: 400 }
    );
  }
  const chars = jobs.reduce((n, j) => n + j.text.length, 0);
  if (chars > MAX_CHARS) {
    return NextResponse.json({ error: `Script too long (${chars} characters).` }, { status: 400 });
  }

  let storagePath: string | null = null;
  try {
    const started = Date.now();
    const clips: ClipInput[] = await mapLimit(jobs, 4, async (job) => {
      const pcm = await synthesize(job.text, {
        voice: body.voice,
        style: body.style,
        model: body.model,
      });
      return { ...job, pcm: trimSilence(pcm) };
    });
    log.info(`[narration] ${clips.length} lines spoken in ${Date.now() - started}ms`);

    const pacing = { ...DEFAULT_PACING, ...body.pacing };
    const fallback = Object.fromEntries(body.slides.map((s) => [s.slideId, s.duration]));
    const track = assembleNarration(
      body.slides.map((s) => s.slideId),
      clips,
      fallback,
      pacing,
      SAMPLE_RATE
    );
    const wav = encodeWav(track.pcm);

    let wordTimings = track.wordTimings;
    let timingSource: LessonAudio["timingSource"] = "estimated";
    let timingNote: string | undefined;
    if (body.align === "whisper") {
      if (!whisperAvailable()) {
        timingNote = "Whisper isn't set up on the server, so word times are estimated.";
      } else if (wav.length > 24 * 1024 * 1024) {
        timingNote = "Track is too long for Whisper, so word times are estimated.";
      } else {
        try {
          const heard = await transcribeWords(wav, track.transcript);
          const refined = refineWordTimings(track.wordTimings, heard);
          wordTimings = refined.timings;
          timingSource = "whisper";
          timingNote = `Whisper matched ${refined.matched} of ${track.wordTimings.length} words.`;
        } catch (error) {
          log.warn("[narration] Whisper failed, keeping estimates:", error);
          timingNote = "Whisper failed, so word times are estimated.";
        }
      }
    }

    storagePath = generateAudioStoragePath(`${body.title} narration`, "wav");
    const upload = await uploadToR2(Buffer.from(wav), storagePath, {
      contentType: "audio/wav",
      cacheControl: "public, max-age=31536000, immutable",
      bucket: "pathology-bites-audio",
      metadata: {
        uploadedBy: auth.userId,
        uploadedAt: new Date().toISOString(),
        voice: body.voice.replace(/[^\x20-\x7E]/g, "_"),
      },
    });

    const supabase = await createClient();
    const { data: row, error: dbError } = await supabase
      .from("audio")
      .insert({
        url: upload.url,
        storage_path: storagePath,
        title: `${body.title} (narration)`,
        description: `Gemini narration, voice ${body.voice}`,
        file_type: "audio/wav",
        file_size_bytes: wav.length,
        duration_seconds: track.duration,
        generated_text: track.transcript,
        word_timings: wordTimings as unknown as Json,
        created_by: auth.userId,
      })
      .select("id")
      .single();
    if (dbError) {
      await deleteFromR2(storagePath, "pathology-bites-audio").catch(() => {});
      storagePath = null;
      throw new Error(`Failed to save audio record: ${dbError.message}`);
    }
    storagePath = null;

    const audio: LessonAudio = {
      url: upload.url,
      title: `${body.title} (narration)`,
      transcript: track.transcript,
      duration: track.duration,
      wordTimings,
      timingSource,
      voice: body.voice,
      audioId: row.id,
    };
    return NextResponse.json({ audio, slides: track.slides, timingNote });
  } catch (error) {
    log.error("[narration] generation failed:", error);
    if (storagePath) await deleteFromR2(storagePath, "pathology-bites-audio").catch(() => {});
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Narration failed" },
      { status: 502 }
    );
  }
}
