// Shared math helpers used across the lesson-studio editor.

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

// ---- Frame quantization ----------------------------------------------------
// All authored time values snap to 30 fps so the exporter (24/30/60 fps) can
// hit every authored keyframe exactly.

const EDITOR_FPS = 12;
export const FRAME_DURATION = 1 / EDITOR_FPS;

/** Snap a time value (seconds) to the nearest authoring frame. */
export const snapToFrame = (s: number): number => Math.round(s / FRAME_DURATION) * FRAME_DURATION;

// ---- Timecode display (24 fps) ---------------------------------------------
// Display uses 24 fps so every authoring frame (12 fps) lands on an even
// display frame (0, 2, 4, …). Format: S:FF  e.g. "2:05" = 2 sec + frame 5.

const DISPLAY_FPS = 24;

/** Convert seconds to "S:FF" timecode string at DISPLAY_FPS. */
export function secsToTimecode(secs: number): string {
  const totalFrames = Math.round(Math.max(0, secs) * DISPLAY_FPS);
  const s = Math.floor(totalFrames / DISPLAY_FPS);
  const f = totalFrames % DISPLAY_FPS;
  return `${s}:${String(f).padStart(2, "0")}`;
}

/** Parse "S:FF" timecode back to seconds, or null if invalid.
 *  Also accepts a bare integer (e.g. "10") which is treated as seconds. */
export function timecodeToSecs(tc: string): number | null {
  const trimmed = tc.trim();

  // Bare integer → treat as whole seconds (e.g. "10" → 10:00 → 10 s)
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  const m = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (!m) return null;
  const s = parseInt(m[1], 10);
  const f = parseInt(m[2], 10);
  if (f < 0 || f >= DISPLAY_FPS) return null;
  return s + f / DISPLAY_FPS;
}
