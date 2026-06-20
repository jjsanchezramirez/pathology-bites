import type { CaptionChunk } from "@/shared/types/explainer";
import type { ImageInput } from "./prompt";
import { computeSegmentTimings, type SegmentTiming } from "./timing";
import { TEXT_FALLBACK_CHAIN } from "@/shared/config/ai-models";
import { callWithFallback } from "@/shared/services/ai-fallback";
import { callClaudeText } from "@/shared/services/claude-api";
import { log } from "@/shared/utils/logging";

const SEGMENTER_TIMEOUT_MS = 20_000;
const MIN_SEGMENT_DURATION = 3.0;

const SEGMENTER_SYSTEM =
  "You are a precise transcript analyser. Return only the JSON array requested — no explanation.";

/** @internal exported for debug routes */
export async function callTextProvider(
  prompt: string,
  model: string,
  apiKey: string,
  provider: string,
  signal: AbortSignal
): Promise<string> {
  if (provider === "claude") {
    const res = await callClaudeText(prompt, model, apiKey, {
      system: SEGMENTER_SYSTEM,
      maxTokens: 200,
      temperature: 0.1,
      timeoutMs: SEGMENTER_TIMEOUT_MS,
    });
    return res.content;
  }

  if (provider === "llama") {
    const r = await fetch("https://api.llama.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SEGMENTER_SYSTEM },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 200,
        temperature: 0.1,
      }),
    });
    if (!r.ok)
      throw new Error(`Llama API ${r.status} ${await r.text().then((t) => t.slice(0, 100))}`);
    const data = await r.json();
    return data.completion_message?.content?.text ?? data.choices?.[0]?.message?.content ?? "";
  }

  if (provider === "mistral") {
    const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SEGMENTER_SYSTEM },
          { role: "user", content: prompt },
        ],
        max_tokens: 200,
        temperature: 0.1,
      }),
    });
    if (!r.ok)
      throw new Error(`Mistral API ${r.status} ${await r.text().then((t) => t.slice(0, 100))}`);
    const data = await r.json();
    return data.choices?.[0]?.message?.content ?? "";
  }

  if (provider === "google") {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${SEGMENTER_SYSTEM}\n\n${prompt}` }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
        }),
      }
    );
    if (!r.ok)
      throw new Error(`Gemini API ${r.status} ${await r.text().then((t) => t.slice(0, 100))}`);
    const data = await r.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

// ---------------------------------------------------------------------------
// AI-based segment timing
//
// Rather than keyword overlap, ask the model to read the full transcript and
// image metadata and identify exactly which caption index marks the start of
// each image's segment. Much more accurate for:
//   - Images whose keywords don't appear verbatim in the transcript
//   - Transitions that happen mid-sentence
//   - Cases where one image dominates most of the narration
//
// The model returns a JSON array of caption indices (0-based), one per image
// (index 0 is always 0 — first image always starts at caption 0).
//
// On any failure (timeout, parse error, implausible output) we fall back to
// the keyword-overlap computeSegmentTimings().
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildSegmenterPrompt(images: ImageInput[], captions: CaptionChunk[]): string {
  const imageList = images
    .map(
      (img, i) =>
        `[${i}] ${img.title}${img.description ? ` — ${img.description}` : ""} (${img.category ?? "unknown"})`
    )
    .join("\n");

  const captionList = captions
    .map((c, i) => `[${i}] ${c.start.toFixed(2)}s–${c.end.toFixed(2)}s: "${c.text}"`)
    .join("\n");

  return `You are given a list of pathology images and a timed caption transcript.
Your task: identify the caption index at which the narration FIRST begins discussing each image.

## Images (${images.length} total)
${imageList}

## Caption chunks (${captions.length} total, 0-indexed)
${captionList}

## Rules
- Image 0 always starts at caption index 0.
- For each subsequent image (1, 2, …), find the caption index where the speaker FIRST shifts to discussing that image.
- Choose the earliest caption where the narration mentions content clearly matching that image's title or description.
- If unsure, prefer later rather than earlier (give the previous image more time).
- Each image must get at least one caption chunk.

## Output
Respond with ONLY a JSON array of ${images.length} integers (one per image, in order).
Example for 3 images: [0, 4, 11]
No explanation, no prose — just the JSON array.`;
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

/** @internal exported for testing */
export function parseSegmenterResponse(
  raw: string,
  numImages: number,
  numCaptions: number
): number[] | null {
  // Extract a JSON array from the response
  const match = raw.match(/\[[\s\S]*?\]/);
  if (!match) return null;

  let arr: unknown;
  try {
    arr = JSON.parse(match[0]);
  } catch {
    return null;
  }

  if (!Array.isArray(arr) || arr.length !== numImages) return null;

  // Validate: all integers, in range, strictly non-decreasing, first is 0
  const indices: number[] = [];
  for (const v of arr) {
    const n = typeof v === "number" ? Math.round(v) : parseInt(String(v), 10);
    if (isNaN(n) || n < 0 || n >= numCaptions) return null;
    indices.push(n);
  }

  if (indices[0] !== 0) return null;
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] <= indices[i - 1]) return null; // must be strictly increasing
  }

  return indices;
}

// ---------------------------------------------------------------------------
// Convert caption indices → SegmentTiming[], enforcing min duration
// ---------------------------------------------------------------------------

/** @internal exported for testing */
export function indicesToTimings(
  captionStartIndices: number[],
  captions: CaptionChunk[],
  totalDuration: number
): SegmentTiming[] {
  const numImages = captionStartIndices.length;
  const rawTimings: SegmentTiming[] = captionStartIndices.map((startIdx, i) => {
    const startTime = captions[startIdx]?.start ?? 0;
    const endTime =
      i < numImages - 1
        ? (captions[captionStartIndices[i + 1]]?.start ?? totalDuration)
        : totalDuration;
    return { startTime, endTime };
  });

  // Forward pass: enforce minimum duration
  const timings: SegmentTiming[] = [];
  let cursor = 0;

  for (let i = 0; i < numImages; i++) {
    const start = cursor;
    let end = rawTimings[i].endTime;

    // Clamp: ensure minimum duration
    const minEnd = start + MIN_SEGMENT_DURATION;
    // Ensure room for remaining images
    const remainingImages = numImages - i - 1;
    const maxEnd = totalDuration - remainingImages * MIN_SEGMENT_DURATION;
    end = Math.max(minEnd, Math.min(maxEnd, end));

    timings.push({
      startTime: Math.round(start),
      endTime: Math.round(end),
    });
    cursor = end;
  }

  // Ensure last segment ends exactly at totalDuration
  timings[timings.length - 1].endTime = totalDuration;

  return timings;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Use an AI call to determine segment timings by reading the full transcript
 * and image metadata. Falls back to keyword-overlap on any error.
 *
 * @param images        Ordered list of images
 * @param captions      Timed caption chunks
 * @param totalDuration Total audio duration in seconds
 * @param apiKey        Meta Llama API key
 * @returns             Segment timings (absolute startTime/endTime)
 */
export async function segmentByAI(
  images: ImageInput[],
  captions: CaptionChunk[],
  totalDuration: number,
  _legacyApiKey: string,
  modelOverride?: string
): Promise<SegmentTiming[]> {
  // _legacyApiKey kept for caller compat — provider keys now looked up per-model
  void _legacyApiKey;

  if (images.length <= 1 || captions.length === 0) {
    return computeSegmentTimings(images, captions, totalDuration);
  }

  log.debug(`[segmenter] Input images for segmentation:`);
  images.forEach((img, i) => {
    log.debug(`  [${i}] ${img.title} — ${img.category}, mag: ${img.magnification ?? "null"}`);
  });
  log.debug(`[segmenter] ${captions.length} captions, ${totalDuration.toFixed(1)}s duration`);

  const prompt = buildSegmenterPrompt(images, captions);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEGMENTER_TIMEOUT_MS);

  try {
    const raw = await callWithFallback(
      TEXT_FALLBACK_CHAIN,
      (model, apiKey, provider) =>
        callTextProvider(prompt, model, apiKey, provider, controller.signal),
      "segmenter",
      { modelOverride }
    );
    clearTimeout(timeoutId);

    const indices = parseSegmenterResponse(raw, images.length, captions.length);
    if (!indices) {
      log.warn(`[segmenter] Could not parse response "${raw.slice(0, 120)}" — falling back`);
      return computeSegmentTimings(images, captions, totalDuration);
    }

    log.debug(`[segmenter] AI transition indices: [${indices.join(", ")}]`);
    return indicesToTimings(indices, captions, totalDuration);
  } catch (err) {
    clearTimeout(timeoutId);
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`[segmenter] All models failed: ${msg} — falling back to keyword scorer`);
    return computeSegmentTimings(images, captions, totalDuration);
  }
}
