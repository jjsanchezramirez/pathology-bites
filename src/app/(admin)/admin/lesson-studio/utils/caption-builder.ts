import type { CaptionChunk } from "@/shared/types/explainer";

/**
 * Build a flat list of caption chunks from a transcript using uniform word timing.
 * Times are absolute (seconds from sequence start).
 *
 * @param transcript - The full transcript text
 * @param totalDuration - Total duration in seconds for the entire transcript
 * @returns Array of caption chunks with text, start, and end times
 */
export function buildCaptionChunks(transcript: string, totalDuration: number): CaptionChunk[] {
  const CHUNK_SIZE = 5; // Number of words per caption chunk
  const words = transcript.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0 || totalDuration <= 0) {
    return [];
  }

  // Calculate uniform duration per word
  const wordDuration = totalDuration / words.length;
  const chunks: CaptionChunk[] = [];

  // Build chunks of CHUNK_SIZE words each
  for (let i = 0; i < words.length; i += CHUNK_SIZE) {
    const chunkWords = words.slice(i, i + CHUNK_SIZE);
    chunks.push({
      text: chunkWords.join(" "),
      start: i * wordDuration,
      end: (i + chunkWords.length) * wordDuration,
    });
  }

  return chunks;
}
