import "server-only";

// Gemini text-to-speech and voice listing/design, for lesson narration.
// Uses the same Google AI Studio key as the rest of the site (ai-keys.ts).

import { getApiKey } from "@/shared/config/ai-keys";
import { fetchWithTimeout } from "@/shared/utils/fetch-with-timeout";
import { decodeTtsAudio, type Pcm16 } from "@/shared/lesson/narration";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export const TTS_MODELS = [
  { id: "gemini-3.8-flash-tts", label: "Gemini 3.8 Flash TTS" },
  { id: "gemini-3.8-flash-lite-tts", label: "Gemini 3.8 Flash Lite TTS (cheapest)" },
  { id: "gemini-2.5-pro-preview-tts", label: "Gemini 2.5 Pro TTS (preview)" },
] as const;

export const DEFAULT_TTS_MODEL = "gemini-3.8-flash-tts";

/** Gemini's prebuilt voices, used when ListVoices can't be reached. */
export const PREBUILT_VOICES = [
  "Zephyr",
  "Puck",
  "Charon",
  "Kore",
  "Fenrir",
  "Leda",
  "Orus",
  "Aoede",
  "Callirrhoe",
  "Autonoe",
  "Enceladus",
  "Iapetus",
  "Umbriel",
  "Algieba",
  "Despina",
  "Erinome",
  "Algenib",
  "Rasalgethi",
  "Laomedeia",
  "Achernar",
  "Alnilam",
  "Schedar",
  "Gacrux",
  "Pulcherrima",
  "Achird",
  "Zubenelgenubi",
  "Vindemiatrix",
  "Sadachbia",
  "Sadaltager",
  "Sulafat",
];

export interface VoiceOption {
  id: string;
  label: string;
  type: "prebuilt" | "prompted" | "replicated";
  description?: string;
}

function key(): string {
  const k = getApiKey("google");
  if (!k) throw new Error("Gemini is not configured (no Google AI Studio key on the server).");
  return k;
}

function headers(): HeadersInit {
  return { "Content-Type": "application/json", "x-goog-api-key": key() };
}

async function errorText(res: Response): Promise<string> {
  try {
    const j = await res.json();
    return j?.error?.message ?? JSON.stringify(j).slice(0, 300);
  } catch {
    return res.statusText;
  }
}

/** Custom voices first (as the API orders them), then prebuilt. */
export async function listVoices(): Promise<VoiceOption[]> {
  const out: VoiceOption[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 10; page++) {
    const url = `${BASE}/voices?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const res = await fetchWithTimeout(
      url,
      { headers: headers() },
      15_000,
      undefined,
      "ListVoices"
    );
    if (!res.ok) throw new Error(`ListVoices failed: ${await errorText(res)}`);
    const json = (await res.json()) as {
      voices?: Array<{
        id?: string;
        name?: string;
        type?: string;
        display_name?: string;
        displayName?: string;
        prompted?: { description?: string; input?: string };
      }>;
      next_page_token?: string;
      nextPageToken?: string;
    };
    for (const v of json.voices ?? []) {
      const id = v.id ?? v.name?.replace(/^voices\//, "");
      if (!id) continue;
      const type = (v.type as VoiceOption["type"]) ?? "prebuilt";
      out.push({
        id,
        label: v.display_name ?? v.displayName ?? id,
        type,
        description: v.prompted?.description ?? v.prompted?.input,
      });
    }
    pageToken = json.next_page_token ?? json.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

/** Create and store a designed ("prompted") voice. Returns its id. */
export async function designVoice(input: {
  description: string;
  displayName?: string;
  baseVoice?: string;
  gender?: string;
  pitch?: "low" | "medium" | "high";
  accent?: string;
}): Promise<VoiceOption> {
  const body = {
    voice: {
      type: "prompted",
      ...(input.displayName ? { display_name: input.displayName } : {}),
      prompted: {
        input: input.description,
        ...(input.baseVoice ? { base_voice: input.baseVoice } : {}),
        ...(input.gender ? { gender: input.gender } : {}),
        ...(input.pitch ? { pitch: input.pitch } : {}),
        ...(input.accent ? { accent: input.accent } : {}),
      },
    },
    store: true,
  };
  const res = await fetchWithTimeout(
    `${BASE}/voices`,
    { method: "POST", headers: headers(), body: JSON.stringify(body) },
    60_000,
    undefined,
    "CreateVoice"
  );
  if (!res.ok) throw new Error(`Voice design failed: ${await errorText(res)}`);
  const v = (await res.json()) as { id?: string; name?: string; display_name?: string };
  const id = v.id ?? v.name?.replace(/^voices\//, "");
  if (!id) throw new Error("Voice design returned no id");
  return {
    id,
    label: v.display_name ?? input.displayName ?? id,
    type: "prompted",
    description: input.description,
  };
}

/**
 * Delete a stored voice (one made with designVoice). Gemini keeps designed voices
 * until deleted, so without this they only ever accumulate. Prebuilt voices
 * can't be deleted; Gemini rejects those.
 */
export async function deleteVoice(id: string): Promise<void> {
  const res = await fetchWithTimeout(
    `${BASE}/voices/${encodeURIComponent(id)}`,
    { method: "DELETE", headers: headers() },
    20_000,
    undefined,
    "DeleteVoice"
  );
  if (!res.ok) throw new Error(`Voice deletion failed: ${await errorText(res)}`);
}

// ---- Rate limit -----------------------------------------------------------------
// Gemini TTS on the site's tier allows 10 requests a minute. Narration speaks
// one request per sentence, so requests are spaced out here instead of firing
// at once and failing with 429. Override with GEMINI_TTS_RPM if the tier changes.

const TTS_RPM = Math.max(1, Number(process.env.GEMINI_TTS_RPM) || 10);
const TTS_SPACING_MS = Math.ceil(60_000 / TTS_RPM) + 150;

/**
 * Sentences one narration request may speak inside the route's 300 s budget
 * (280 s of speaking at one request per slot). Longer lessons are narrated in
 * several requests, a few slides at a time (see batchNarration).
 */
export const TTS_MAX_LINES_PER_REQUEST = Math.max(1, Math.floor(280_000 / TTS_SPACING_MS));
let nextSlotAt = 0;

/** Wait for the next free request slot (per server instance). */
async function takeSlot(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextSlotAt);
  nextSlotAt = at + TTS_SPACING_MS;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

/** Seconds Gemini asks us to wait in a 429 body ("retryDelay": "23s"), if any. */
export function retryDelaySeconds(message: string): number | null {
  const m =
    /"?retryDelay"?\s*:\s*"?(\d+(?:\.\d+)?)s/.exec(message) ??
    /retry in (\d+(?:\.\d+)?)s/i.exec(message);
  return m ? Number(m[1]) : null;
}

/**
 * Speak one sentence. The text is read verbatim; `style` steers delivery
 * (pace, tone) without being spoken.
 */
export async function synthesize(
  text: string,
  opts: { voice: string; style?: string; model?: string; signal?: AbortSignal }
): Promise<Pcm16> {
  const model = opts.model ?? DEFAULT_TTS_MODEL;
  const part: Record<string, unknown> = { text };
  if (opts.style?.trim()) part.speech_metadata = { style: opts.style.trim() };
  const body = {
    contents: [{ role: "user", parts: [part] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { voice: opts.voice } },
    },
  };
  let lastErr: unknown;
  const attempts = 4;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await takeSlot();
      const res = await fetchWithTimeout(
        `${BASE}/models/${model}:generateContent`,
        { method: "POST", headers: headers(), body: JSON.stringify(body) },
        60_000,
        opts.signal,
        "Gemini TTS"
      );
      if (res.status === 429 || res.status >= 500) {
        const text = await errorText(res);
        lastErr = new Error(`Gemini TTS ${res.status}: ${text}`);
        if (attempt === attempts - 1) break;
        const asked = res.status === 429 ? retryDelaySeconds(text) : null;
        const waitMs = Math.min(60_000, asked != null ? asked * 1000 + 250 : 2000 * 2 ** attempt);
        // Hold every other request back too, so the limit can recover.
        nextSlotAt = Math.max(nextSlotAt, Date.now() + waitMs);
        continue;
      }
      if (!res.ok) {
        // 4xx other than 429 won't improve on retry (bad voice id, bad model, quota off).
        const e = new Error(`Gemini TTS failed: ${await errorText(res)}`);
        (e as Error & { fatal?: boolean }).fatal = true;
        throw e;
      }
      const json = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
        }>;
      };
      const inline = json.candidates?.[0]?.content?.parts?.find(
        (p) => p.inlineData?.data
      )?.inlineData;
      if (!inline?.data) throw new Error("Gemini TTS returned no audio");
      return decodeTtsAudio(new Uint8Array(Buffer.from(inline.data, "base64")), inline.mimeType);
    } catch (err) {
      lastErr = err;
      if ((err as { fatal?: boolean }).fatal || attempt === attempts - 1) break;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Run `fn` over `items` with at most `limit` in flight, preserving order. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, i: number) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
