// Caption derivation. Real word-level timing (from forced alignment) is preferred;
// uniform word timing is the fallback for audio without alignment data.

import type { CaptionChunk } from "@/shared/types/explainer";
import type { LessonAudio, WordTiming } from "./types";

const CHUNK_SIZE = 5; // words per caption chunk

/** Uniform fallback: split a transcript into evenly-timed chunks. */
export function buildCaptionChunks(
  transcript: string,
  totalDuration: number,
  chunkSize = CHUNK_SIZE
): CaptionChunk[] {
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || totalDuration <= 0) return [];
  const wordDuration = totalDuration / words.length;
  const chunks: CaptionChunk[] = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunkWords = words.slice(i, i + chunkSize);
    chunks.push({
      text: chunkWords.join(" "),
      start: i * wordDuration,
      end: (i + chunkWords.length) * wordDuration,
    });
  }
  return chunks;
}

/** Accurate path: group aligned words into chunks, preserving per-word timing. */
export function buildCaptionsFromWords(
  words: WordTiming[],
  chunkSize = CHUNK_SIZE
): CaptionChunk[] {
  const chunks: CaptionChunk[] = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    const slice = words.slice(i, i + chunkSize);
    if (slice.length === 0) continue;
    chunks.push({
      text: slice.map((w) => w.text).join(" "),
      start: slice[0].start,
      end: slice[slice.length - 1].end,
      words: slice,
    });
  }
  return chunks;
}

/** Captions for a lesson's audio: word-aligned when available, else uniform. */
export function captionsForAudio(audio: LessonAudio | null | undefined): CaptionChunk[] {
  if (!audio) return [];
  if (audio.wordTimings && audio.wordTimings.length > 0) {
    return buildCaptionsFromWords(audio.wordTimings);
  }
  if (audio.transcript && audio.duration && audio.duration > 0) {
    return buildCaptionChunks(audio.transcript, audio.duration);
  }
  return [];
}
