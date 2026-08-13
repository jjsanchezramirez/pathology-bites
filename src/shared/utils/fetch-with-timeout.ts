/**
 * `fetch` with a hard deadline.
 *
 * An unbounded outbound fetch inside a serverless handler is the single most
 * expensive bug shape this codebase has hit: a hung provider consumes the whole
 * invocation and the request dies with a generic 500 instead of failing over.
 * That was ~40% of WSI question generations until the Google/Mistral calls got
 * timeouts (see ai-providers.ts).
 *
 * Lives here rather than in ai-providers so the audio/transcription path can
 * share one implementation instead of growing a second copy that drifts.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  signal: AbortSignal | undefined,
  label: string
): Promise<Response> {
  // A caller-owned signal wins: it already encodes the caller's own deadline.
  if (signal) return fetch(url, { ...init, signal });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`${label} timeout after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
