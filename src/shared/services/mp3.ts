// MP3 encoding for narration tracks (server side). Mono speech at 48 kb/s is
// about an eighth of the WAV it replaces and indistinguishable for a voice.
//
// LAME adds roughly 50 ms of priming silence at the start, which players do
// play; sentence cues land that much early, well inside the 0.1 s that elements
// already lead their sentence by.

import { Mp3Encoder } from "@breezystack/lamejs";
import type { Pcm16 } from "@/shared/lesson/narration";

const FRAME = 1152;

export const NARRATION_KBPS = 48;

export function encodeMp3(pcm: Pcm16, kbps = NARRATION_KBPS): Uint8Array {
  const encoder = new Mp3Encoder(1, pcm.sampleRate, kbps);
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < pcm.samples.length; i += FRAME) {
    const out = encoder.encodeBuffer(pcm.samples.subarray(i, i + FRAME));
    if (out.length) chunks.push(out);
  }
  const tail = encoder.flush();
  if (tail.length) chunks.push(tail);
  const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    bytes.set(c, o);
    o += c.length;
  }
  return bytes;
}
