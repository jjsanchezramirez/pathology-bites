import "server-only";

// Optional: word timestamps from OpenAI Whisper, used only to sharpen the
// estimated word times of generated narration. Off unless OPENAI_API_KEY is
// set on the server (and OPENAI_ENABLED is not "false"). Never required:
// narration works without it.

import { getApiKey, hasApiKey } from "@/shared/config/ai-keys";
import { fetchWithTimeout } from "@/shared/utils/fetch-with-timeout";
import type { WordTiming } from "@/shared/lesson/types";

export function whisperAvailable(): boolean {
  return hasApiKey("openai");
}

export async function transcribeWords(wav: Uint8Array, prompt?: string): Promise<WordTiming[]> {
  const apiKey = getApiKey("openai");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set or OpenAI is switched off");
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "narration.wav");
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("language", "en");
  // The script as a prompt steers spelling of medical terms.
  if (prompt) form.append("prompt", prompt.slice(0, 900));
  const res = await fetchWithTimeout(
    "https://api.openai.com/v1/audio/transcriptions",
    { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form },
    120_000,
    undefined,
    "Whisper"
  );
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json())?.error?.message ?? msg;
    } catch {
      /* keep status text */
    }
    throw new Error(`Whisper failed: ${msg}`);
  }
  const json = (await res.json()) as {
    words?: Array<{ word: string; start: number; end: number }>;
  };
  return (json.words ?? []).map((w) => ({ text: w.word.trim(), start: w.start, end: w.end }));
}
