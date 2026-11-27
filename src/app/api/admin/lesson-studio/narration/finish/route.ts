import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/shared/services/server";
import { requireAdmin } from "@/shared/utils/api/api-guard";
import { parseBody } from "@/shared/utils/api/parse-body";
import {
  bulkDeleteFromR2,
  deleteFromR2,
  generateAudioStoragePath,
  getFileContent,
  uploadToR2,
} from "@/shared/services/r2-storage";
import { encodeMp3 } from "@/shared/services/mp3";
import { transcribeWords, whisperAvailable } from "@/shared/services/whisper-align";
import { joinNarrationParts, parseWav, refineWordTimings } from "@/shared/lesson/narration";
import { NARRATION_BUCKET, isNarrationPartKey } from "@/shared/lesson/narration-parts";
import type { LessonAudio, WordTiming } from "@/shared/lesson/types";
import type { Json } from "@/shared/types/supabase";
import { log } from "@/shared/utils/logging";

// Download the parts, join, encode MP3, optional Whisper, upload, record.
export const maxDuration = 120;

const WHISPER_MAX_BYTES = 24 * 1024 * 1024;

const word = z.object({ text: z.string(), start: z.number(), end: z.number() });

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  voice: z.string().trim().min(1).max(100),
  align: z.enum(["estimate", "whisper"]).default("estimate"),
  session: z.string().uuid(),
  parts: z
    .array(
      z.object({
        key: z.string().max(200),
        transcript: z.string().max(20_000),
        wordTimings: z.array(word).max(10_000),
      })
    )
    .min(1)
    .max(200),
});

/**
 * @swagger
 * /api/admin/lesson-studio/narration/finish:
 *   post:
 *     summary: Join narration parts into the lesson's track
 *     description: Joins the parts made by narration/generate (in order), encodes one MP3, optionally refines word timings with Whisper, stores it in the audio library (R2 + audio table), deletes the parts, and returns the LessonAudio. Requires admin role.
 *     tags:
 *       - Admin - Lesson Studio
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: "{ audio: LessonAudio, timingNote? }"
 *       400:
 *         description: A part key that doesn't belong to this session
 *       502:
 *         description: A part is missing, or storage, Whisper or database failure
 */
export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(request, schema);
  if (body instanceof NextResponse) return body;

  const keys = body.parts.map((p) => p.key);
  if (!keys.every((k) => isNarrationPartKey(k, body.session))) {
    return NextResponse.json({ error: "Unknown narration part." }, { status: 400 });
  }

  let storagePath: string | null = null;
  try {
    const parts = await Promise.all(
      body.parts.map(async (p) => {
        const bytes = await getFileContent(NARRATION_BUCKET, p.key);
        if (!bytes) throw new Error("A narration part is missing; narrate again.");
        // Validated by the schema; parseBody widens the inferred type.
        const wordTimings = p.wordTimings as WordTiming[];
        return { pcm: parseWav(bytes), wordTimings, transcript: p.transcript };
      })
    );
    const track = joinNarrationParts(parts);
    const mp3 = encodeMp3(track.pcm);

    let wordTimings = track.wordTimings;
    let timingSource: LessonAudio["timingSource"] = "estimated";
    let timingNote: string | undefined;
    if (body.align === "whisper") {
      if (!whisperAvailable()) {
        timingNote = "Whisper isn't set up on the server, so word times are estimated.";
      } else if (mp3.length > WHISPER_MAX_BYTES) {
        timingNote = "Track is too long for Whisper, so word times are estimated.";
      } else {
        try {
          const heard = await transcribeWords(mp3, track.transcript, "mp3");
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

    storagePath = generateAudioStoragePath(`${body.title} narration`, "mp3");
    const upload = await uploadToR2(Buffer.from(mp3), storagePath, {
      contentType: "audio/mpeg",
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
        file_type: "audio/mpeg",
        file_size_bytes: mp3.length,
        duration_seconds: track.duration,
        generated_text: track.transcript,
        word_timings: wordTimings as unknown as Json,
        created_by: auth.userId,
      })
      .select("id")
      .single();
    if (dbError) throw new Error(`Failed to save audio record: ${dbError.message}`);
    storagePath = null;

    // The parts have done their job.
    await bulkDeleteFromR2(keys, NARRATION_BUCKET).catch((e) =>
      log.warn("[narration] part cleanup failed:", e)
    );

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
    return NextResponse.json({ audio, timingNote });
  } catch (error) {
    log.error("[narration] finish failed:", error);
    if (storagePath) await deleteFromR2(storagePath, NARRATION_BUCKET).catch(() => {});
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Narration failed" },
      { status: 502 }
    );
  }
}
