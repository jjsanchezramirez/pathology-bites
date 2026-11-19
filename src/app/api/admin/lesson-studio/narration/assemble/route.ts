import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/shared/services/server";
import { requireAdmin } from "@/shared/utils/api/api-guard";
import { parseBody } from "@/shared/utils/api/parse-body";
import {
  deleteFromR2,
  generateAudioStoragePath,
  getFileContent,
  uploadToR2,
} from "@/shared/services/r2-storage";
import { transcribeWords, whisperAvailable } from "@/shared/services/whisper-align";
import {
  DEFAULT_PACING,
  assembleNarration,
  encodeWav,
  parseWav,
  refineWordTimings,
  splitClipBySentences,
  type ClipInput,
} from "@/shared/lesson/narration";
import type { LessonAudio } from "@/shared/lesson/types";
import type { Json } from "@/shared/types/supabase";
import { NARRATION_BUCKET, isNarrationClipKey } from "../clip-key";
import { log } from "@/shared/utils/logging";

// No Gemini calls here: the per-slide clips were made by /narration/speak.
export const maxDuration = 120;

const SAMPLE_RATE = 24000;

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  voice: z.string().trim().min(1).max(100),
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
        /** Clip from /narration/speak; required when the slide has lines. */
        clipKey: z.string().optional(),
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
 * /api/admin/lesson-studio/narration/assemble:
 *   post:
 *     summary: Build the lesson narration track from per-slide clips
 *     description: Takes the per-slide clips made by /narration/speak, cuts each into its sentences at the pauses, lays them out in slide order with fixed pacing, and stores one WAV track in the audio library (R2 + audio table, with word timings). Returns the track as a LessonAudio plus per-slide cues (new slide durations and each sentence's start/end). Word timings are estimated within each sentence, or refined with Whisper when requested and OPENAI_API_KEY is set. Requires admin role.
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
 *               voice: { type: string }
 *               align: { type: string, enum: [estimate, whisper] }
 *               slides:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     slideId: { type: string }
 *                     duration: { type: number }
 *                     clipKey: { type: string }
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
 *         description: A narrated slide has no clip yet
 *       502:
 *         description: Storage or database failure
 */
export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(request, schema);
  if (body instanceof NextResponse) return body;

  const narrated = body.slides.filter((s) => s.lines.length > 0);
  if (!narrated.length) {
    return NextResponse.json({ error: "No script to narrate yet." }, { status: 400 });
  }
  const missing = narrated.find((s) => !s.clipKey || !isNarrationClipKey(s.clipKey));
  if (missing) {
    return NextResponse.json(
      { error: `Slide ${missing.slideId} has not been spoken yet.` },
      { status: 400 }
    );
  }

  let storagePath: string | null = null;
  try {
    const clips: ClipInput[] = [];
    for (const s of narrated) {
      const bytes = await getFileContent(NARRATION_BUCKET, s.clipKey as string);
      if (!bytes) {
        return NextResponse.json(
          { error: `The clip for slide ${s.slideId} is missing; generate again.` },
          { status: 400 }
        );
      }
      const lines = s.lines as { id: string; text: string }[];
      const pieces = splitClipBySentences(
        parseWav(bytes),
        lines.map((l) => l.text)
      );
      lines.forEach((l, i) =>
        clips.push({ slideId: s.slideId, lineId: l.id, text: l.text, pcm: pieces[i] })
      );
    }

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
        timingNote = "The track is too long for Whisper, so word times are estimated.";
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
      bucket: NARRATION_BUCKET,
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
      await deleteFromR2(storagePath, NARRATION_BUCKET).catch(() => {});
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
    log.error("[narration] assemble failed:", error);
    if (storagePath) await deleteFromR2(storagePath, NARRATION_BUCKET).catch(() => {});
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Narration failed" },
      { status: 502 }
    );
  }
}
