import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { getUserIdFromHeaders } from "@/shared/utils/auth/auth-helpers";
import { log } from "@/shared/utils/logging";

/**
 * @swagger
 * /api/admin/audio/align:
 *   post:
 *     summary: Forced-align an audio file's transcript into word timestamps
 *     description: >-
 *       Runs speech transcription with word-level timestamps over the audio file
 *       and stores the result in `audio.word_timings`. Used to drive accurate /
 *       karaoke captions. Admin only. Requires OPENAI_API_KEY to be configured.
 *     tags:
 *       - Admin - Audio
 *     responses:
 *       200: { description: Aligned }
 *       400: { description: Missing audioId or audio has no URL }
 *       401: { description: Authentication required }
 *       403: { description: Administrator privileges required }
 *       501: { description: Transcription provider not configured }
 *       500: { description: Alignment failed }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    const { data: userData, error: roleError } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();
    if (roleError || userData?.role !== "admin") {
      return NextResponse.json({ error: "Administrator privileges required." }, { status: 403 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Transcription provider not configured (set OPENAI_API_KEY)." },
        { status: 501 }
      );
    }

    const { audioId } = await request.json();
    if (!audioId) {
      return NextResponse.json({ error: "audioId is required." }, { status: 400 });
    }

    const { data: audio, error: audioError } = await supabase
      .from("audio")
      .select("id, url")
      .eq("id", audioId)
      .single();
    if (audioError || !audio?.url) {
      return NextResponse.json({ error: "Audio not found or has no URL." }, { status: 400 });
    }

    // Fetch the audio bytes and send to Whisper for word-level timestamps.
    const audioResp = await fetch(audio.url);
    if (!audioResp.ok) {
      return NextResponse.json(
        { error: `Failed to fetch audio (${audioResp.status}).` },
        { status: 500 }
      );
    }
    const audioBlob = await audioResp.blob();

    const form = new FormData();
    form.append("file", audioBlob, "audio.mp3");
    form.append("model", "whisper-1");
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");

    const whisperResp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!whisperResp.ok) {
      const detail = await whisperResp.text().catch(() => "");
      log.error("Whisper alignment failed:", whisperResp.status, detail);
      return NextResponse.json(
        { error: `Transcription failed (${whisperResp.status}).` },
        { status: 500 }
      );
    }
    const result = (await whisperResp.json()) as {
      words?: { word: string; start: number; end: number }[];
    };
    const wordTimings = (result.words ?? []).map((w) => ({
      text: w.word,
      start: w.start,
      end: w.end,
    }));

    const { error: updateError } = await supabase
      .from("audio")
      .update({ word_timings: wordTimings })
      .eq("id", audioId);
    if (updateError) {
      return NextResponse.json(
        { error: `Failed to save timings: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, wordCount: wordTimings.length });
  } catch (error) {
    log.error("Audio alignment error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Alignment failed: ${message}` }, { status: 500 });
  }
}
