// Where per-slide narration clips are cached (one WAV per slide script).

export const NARRATION_BUCKET = "pathology-bites-audio";
const PREFIX = "narration-cache/";

export function narrationClipKey(hash: string): string {
  return `${PREFIX}${hash}.wav`;
}

/** Only keys this feature made may be read back by the assemble step. */
export function isNarrationClipKey(key: string): boolean {
  return /^narration-cache\/[a-f0-9]{64}\.wav$/.test(key);
}
