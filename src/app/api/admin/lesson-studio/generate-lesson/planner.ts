// Pass 3: Lesson planning (simplified).
// Decides: slide order + text slide content + SVG placement.
// Annotations, camera, durations are all handled deterministically by the assembler.

import { callClaudeText } from "@/shared/services/claude-api";
import { TEXT_FALLBACK_CHAIN } from "@/shared/config/ai-models";
import { callWithFallback } from "@/shared/services/ai-fallback";
import type { ImageInput } from "../generate-sequence/prompt";
import type {
  SvgInput,
  TranscriptAnalysis,
  LessonPlan,
  PlannedTextSlide,
  PlannedSvgPlacement,
} from "./types";

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildPlannerPrompt(
  transcriptAnalysis: TranscriptAnalysis,
  images: ImageInput[],
  audioDuration: number,
  svgs: SvgInput[]
): string {
  const imageDescriptions = images
    .map(
      (img, i) =>
        `[${i}] "${img.title}" — ${img.description || "no description"} (${img.category ?? "unknown"})`
    )
    .join("\n");

  const transcriptSummary = transcriptAnalysis.segments
    .map((s, i) => `[${i}] "${s.topic}" — ${s.wordCount} words`)
    .join("\n");

  const svgSection =
    svgs.length > 0
      ? `\n## SVGs provided by user (${svgs.length})\n${svgs.map((s, i) => `[${i}] "${s.name}"`).join("\n")}\n`
      : "";

  const svgJsonExample =
    svgs.length > 0
      ? `,
  "svgPlacements": [
    { "svgIndex": 0, "onSlide": 2, "position": { "x": 80, "y": 20 }, "widthPercent": 15 }
  ]`
      : "";

  const svgRules =
    svgs.length > 0
      ? `\n- svgPlacements: optional. Place user SVGs on slides where they add meaning. svgIndex is the SVG's index (0–${svgs.length - 1}), onSlide is the image order position (0–${images.length - 1}). Position in 0–100 canvas %. widthPercent defaults to 15.`
      : "";

  return `You are designing a short educational pathology video (${audioDuration.toFixed(0)}s, ${images.length} images).

## Theme: ${transcriptAnalysis.overallTheme}

## Transcript segments (${transcriptAnalysis.segments.length})
${transcriptSummary}

## Images (${images.length})
${imageDescriptions}
${svgSection}
## Your task
Match images to transcript segments and decide where to insert text-only slides.

Respond with ONLY a JSON object:

{
  "imageOrder": [2, 0, 1, 3],
  "textSlides": [
    {
      "type": "text-only",
      "insertBeforeImage": 0,
      "title": "Key Features",
      "bullets": ["Point one", "Point two", "Point three"],
      "backgroundColor": "#1a1a2e",
      "duration": 5
    }
  ]${svgJsonExample}
}

## Rules
- imageOrder: array of image indices in the order they should appear. Each index 0–${images.length - 1} must appear exactly once.
- Match each image to the transcript segment that best describes it.
- textSlides: 0-2 text slides to insert. insertBeforeImage is the position in imageOrder (0 = before first image, ${images.length} = after last).
- A summary slide at the end (insertBeforeImage: ${images.length}) with 2-3 takeaways is recommended.
- Text slide duration: 4-6 seconds. backgroundColor: "#1a1a2e" (dark) or "#f8fafc" (light).
- Keep bullets concise: max 8 words each, max 3 bullets.${svgRules}

Respond with ONLY the JSON — no explanation.`;
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

/** @internal exported for testing */
export function parsePlanResponse(raw: string, numImages: number): LessonPlan | null {
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

  // Validate imageOrder
  if (!Array.isArray(parsed.imageOrder)) return null;
  const order = parsed.imageOrder as number[];
  if (order.length !== numImages) return null;

  // Validate all indices present
  const seen = new Set(order);
  if (seen.size !== numImages) return null;
  for (let i = 0; i < numImages; i++) {
    if (!seen.has(i)) return null;
  }

  // Parse text slides
  const textSlides: PlannedTextSlide[] = [];
  if (Array.isArray(parsed.textSlides)) {
    for (const ts of parsed.textSlides as Record<string, unknown>[]) {
      if (typeof ts.title !== "string" || !Array.isArray(ts.bullets)) continue;
      textSlides.push({
        type: "text-only",
        insertBeforeImage: Math.max(0, Math.min(numImages, Number(ts.insertBeforeImage) || 0)),
        title: String(ts.title).slice(0, 60),
        bullets: (ts.bullets as string[]).slice(0, 3).map((b) => String(b).slice(0, 60)),
        backgroundColor: typeof ts.backgroundColor === "string" ? ts.backgroundColor : "#1a1a2e",
        duration: Math.max(3, Math.min(8, Number(ts.duration) || 5)),
      });
    }
  }

  // Parse SVG placements
  const svgPlacements: PlannedSvgPlacement[] = [];
  if (Array.isArray(parsed.svgPlacements)) {
    for (const sp of parsed.svgPlacements as Record<string, unknown>[]) {
      const idx = Number(sp.svgIndex);
      const onSlide = Number(sp.onSlide);
      const pos = sp.position as { x?: number; y?: number } | undefined;
      if (
        !isNaN(idx) &&
        !isNaN(onSlide) &&
        pos &&
        typeof pos.x === "number" &&
        typeof pos.y === "number"
      ) {
        svgPlacements.push({
          svgIndex: idx,
          onSlide,
          position: { x: pos.x, y: pos.y },
          widthPercent: Number(sp.widthPercent) || undefined,
        });
      }
    }
  }

  return { imageOrder: order, textSlides, svgPlacements };
}

// ---------------------------------------------------------------------------
// Fallback: simple sequential order
// ---------------------------------------------------------------------------

function fallbackPlan(numImages: number): LessonPlan {
  return {
    imageOrder: Array.from({ length: numImages }, (_, i) => i),
    textSlides: [],
    svgPlacements: [],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function planLesson(
  transcriptAnalysis: TranscriptAnalysis,
  images: ImageInput[],
  audioDuration: number,
  svgs: SvgInput[] = [],
  modelOverride?: string
): Promise<LessonPlan> {
  const prompt = buildPlannerPrompt(transcriptAnalysis, images, audioDuration, svgs);

  try {
    const raw = await callWithFallback(
      TEXT_FALLBACK_CHAIN,
      async (model, apiKey, provider) => {
        if (provider === "claude") {
          const res = await callClaudeText(prompt, model, apiKey, {
            system: "You are an expert educational video designer. Return only valid JSON.",
            maxTokens: 1024,
            temperature: 0.2,
            timeoutMs: 20_000,
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
                {
                  role: "system",
                  content: "You are an expert video designer. Return only valid JSON.",
                },
                { role: "user", content: prompt },
              ],
              max_completion_tokens: 1024,
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
                generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
              }),
            }
          );
          if (!res.ok) throw new Error(`Gemini API ${res.status}`);
          const data = await res.json();
          return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        }
        throw new Error(`Unsupported provider: ${provider}`);
      },
      "planner",
      { modelOverride }
    );

    const parsed = parsePlanResponse(raw, images.length);
    if (parsed) return parsed;

    console.warn("[planner] Could not parse AI response, using fallback");
    return fallbackPlan(images.length);
  } catch (err) {
    console.warn("[planner] All models failed:", err);
    return fallbackPlan(images.length);
  }
}
