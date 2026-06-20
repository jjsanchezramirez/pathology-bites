// Pass 1: Transcript analysis.
// Reads the full transcript + image metadata and extracts:
// - Episode title (2-4 words)
// - Topic segments (one per image, ordered)
// - Text slide suggestions (0-3)
// Word counts are computed deterministically — NOT by AI.

import { callClaudeText } from "@/shared/services/claude-api";
import { TEXT_FALLBACK_CHAIN } from "@/shared/config/ai-models";
import { callWithFallback } from "@/shared/services/ai-fallback";
import type { ImageInput } from "../generate-sequence/prompt";
import type { TranscriptAnalysis } from "./types";
import { log } from "@/shared/utils/logging";

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildPrompt(transcript: string, images: ImageInput[], audioDuration: number): string {
  const imageList = images
    .map(
      (img, i) =>
        `[${i}] "${img.title}" — ${img.description || "no description"} (${img.category ?? "unknown"})`
    )
    .join("\n");

  return `You are analysing the transcript of a short educational pathology video (${audioDuration.toFixed(0)}s, ${images.length} images).

## Transcript
${transcript}

## Images available (${images.length} total)
${imageList}

## Your task
Produce a JSON object with this structure:

{
  "episodeTitle": "2-4 words, title case (e.g. 'Castleman Disease', 'Acute Inflammation')",
  "overallTheme": "One sentence describing the lesson",
  "segments": [
    {
      "text": "the portion of transcript for this segment",
      "topic": "short topic label, 3-8 words"
    }
  ],
  "suggestedTextSlideInsertions": [
    {
      "afterSegmentIndex": 0,
      "purpose": "title | summary | transition | definition",
      "suggestedTitle": "3-8 words, title case",
      "suggestedBullets": ["bullet 1", "bullet 2"]
    }
  ]
}

## Rules
- episodeTitle MUST be 2-4 words. NOT a sentence. Examples: "Castleman Disease", "Granulomatous Inflammation", "Reed-Sternberg Cells".
- Split transcript into exactly ${images.length} segments — one per image, in narrative order.
- Each segment.text should be the exact portion of transcript text for that segment.
- Suggest 0-3 text slide insertions for titles, summaries, or definitions.
- A "summary" slide at the end with 2-3 key takeaways is recommended.

Respond with ONLY the JSON — no explanation, no markdown fences.`;
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

/** @internal exported for testing */
export function parseTranscriptResponse(
  raw: string,
  _numImages: number
): TranscriptAnalysis | null {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(parsed.segments) || parsed.segments.length === 0) return null;
  if (typeof parsed.overallTheme !== "string") return null;

  // Ensure episodeTitle is short
  let episodeTitle = typeof parsed.episodeTitle === "string" ? parsed.episodeTitle : "";
  if (!episodeTitle || episodeTitle.length > 40) {
    episodeTitle = deriveShortTitle(String(parsed.overallTheme || episodeTitle));
  }

  // Compute word counts deterministically
  const segments = (parsed.segments as { text?: string; topic?: string }[]).map((s) => {
    const text = String(s.text || "");
    return {
      text,
      topic: String(s.topic || "").slice(0, 60),
      wordCount: text.split(/\s+/).filter(Boolean).length,
    };
  });

  return {
    segments,
    suggestedTextSlideInsertions: Array.isArray(parsed.suggestedTextSlideInsertions)
      ? parsed.suggestedTextSlideInsertions
      : [],
    episodeTitle,
    overallTheme: String(parsed.overallTheme),
  };
}

// ---------------------------------------------------------------------------
// Short title extraction
// ---------------------------------------------------------------------------

/** @internal exported for testing */
export function deriveShortTitle(text: string): string {
  if (!text) return "Pathology Bite";
  const words = text.trim().split(/\s+/);
  if (words.length <= 4) return text.trim();
  const beforePunct = text.split(/[,\-–:;]/)[0].trim();
  const punctWords = beforePunct.split(/\s+/);
  if (punctWords.length <= 5) return beforePunct;
  return punctWords.slice(0, 4).join(" ");
}

// ---------------------------------------------------------------------------
// Fallback: simple transcript split without AI
// ---------------------------------------------------------------------------

/** @internal exported for testing */
export function fallbackAnalysis(transcript: string, images: ImageInput[]): TranscriptAnalysis {
  const words = transcript.split(/\s+/).filter(Boolean);
  const wordsPerImage = Math.max(1, Math.floor(words.length / Math.max(1, images.length)));

  const segments = images.map((img, i) => {
    const startWord = i * wordsPerImage;
    const endWord = i === images.length - 1 ? words.length : (i + 1) * wordsPerImage;
    const text = words.slice(startWord, endWord).join(" ");
    return {
      text,
      topic: img.title.split(/[-–,]/)[0].trim().slice(0, 40) || `Slide ${i + 1}`,
      wordCount: endWord - startWord,
    };
  });

  return {
    segments,
    suggestedTextSlideInsertions: [],
    episodeTitle: deriveShortTitle(images[0]?.title || "Pathology Bite"),
    overallTheme: images[0]?.title || "Pathology lesson",
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function analyzeTranscript(
  transcript: string,
  images: ImageInput[],
  audioDuration: number,
  modelOverride?: string
): Promise<TranscriptAnalysis> {
  if (!transcript.trim()) {
    return fallbackAnalysis(transcript, images);
  }

  const prompt = buildPrompt(transcript, images, audioDuration);

  try {
    const result = await callWithFallback(
      TEXT_FALLBACK_CHAIN,
      async (model, apiKey, provider) => {
        if (provider === "claude") {
          const res = await callClaudeText(prompt, model, apiKey, {
            system:
              "You are a precise educational content analyst. Return only valid JSON — no explanation.",
            maxTokens: 2048,
            temperature: 0.2,
          });
          return res.content;
        }
        if (provider === "llama") {
          const res = await fetch("https://api.llama.com/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: "Return only valid JSON — no explanation." },
                { role: "user", content: prompt },
              ],
              max_completion_tokens: 2048,
              temperature: 0.2,
            }),
          });
          if (!res.ok) throw new Error(`Llama API ${res.status}`);
          const data = await res.json();
          return (
            data.completion_message?.content?.text ?? data.choices?.[0]?.message?.content ?? ""
          );
        }
        if (provider === "google") {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
              }),
            }
          );
          if (!res.ok) throw new Error(`Gemini API ${res.status}`);
          const data = await res.json();
          return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        }
        throw new Error(`Unsupported provider: ${provider}`);
      },
      "transcript-analysis",
      { modelOverride }
    );

    const parsed = parseTranscriptResponse(result, images.length);
    if (parsed) return parsed;

    log.warn("[transcript-analysis] Could not parse AI response, using fallback");
    return fallbackAnalysis(transcript, images);
  } catch (err) {
    log.warn("[transcript-analysis] All models failed:", err);
    return fallbackAnalysis(transcript, images);
  }
}
