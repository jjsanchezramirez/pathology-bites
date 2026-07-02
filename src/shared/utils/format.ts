// src/shared/utils/format.ts
// Shared display formatters (previously copy-pasted per admin table).

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** mm:ss, or "Unknown" for missing/zero durations. */
export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds === 0) return "Unknown";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
