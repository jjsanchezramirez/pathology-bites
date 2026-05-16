// Pass 2: Image analysis using Claude Sonnet for better spatial reasoning.
// Falls back to the existing Llama-based vision.ts on failure.

import { callClaudeVision } from "@/shared/services/claude-api";
import { LESSON_GEN_VISION_MODELS } from "@/shared/config/ai-models";
import type { VisionResult, AnnotationTool } from "../generate-sequence/vision";
import {
  normaliseMagnification,
  analyzeImages as llamaAnalyzeImages,
  deriveMicroscopicTool,
} from "../generate-sequence/vision";
import type { ImageInput } from "../generate-sequence/prompt";
import { callWithFallback } from "./fallback";

// ---------------------------------------------------------------------------
// Prompt — simplified for Claude's better spatial reasoning
// ---------------------------------------------------------------------------

function buildVisionPrompt(image: ImageInput): string {
  const category = image.category?.toLowerCase() ?? "unknown";
  const magLabel = image.magnification
    ? ({
        low: "low (4-10x)",
        medium: "medium (20x)",
        high: "high (40x)",
        very_high: "very high (60-100x)",
      }[image.magnification] ?? image.magnification)
    : "unknown";

  return `Analyse this pathology image and respond with ONLY a JSON object (no markdown fences).

Image metadata:
- Title: ${image.title || "(none)"}
- Description: ${image.description || "(none)"}
- Category: ${category}
${category === "microscopic" ? `- Magnification: ${magLabel}` : ""}

Respond with this JSON structure:
{
  "canSeeImage": true/false,
  "featurePosition": { "x": <0-100>, "y": <0-100> } or null,
  "suggestedLabel": "<3-5 word label for the key feature, no punctuation>",
  "annotationTool": "<one of: spotlight|circle|ellipse|rectangle|arrow|none>",
  "annotationReason": "<one sentence explaining why you chose this tool>",
  "objectPresent": true/false,
  "objectShape": "<circular|ovoid|irregular>" or null,
  "objectSize": "<large|medium|small>" or null
}

## Annotation tool guide:
- **spotlight**: Use for low-magnification busy fields where the feature is hard to locate among similar structures. Dims the surroundings.
- **circle**: Discrete round structures (follicle, granuloma, cyst).
- **ellipse**: Elongated structures (gland pair, duct, vessel cross-section).
- **rectangle**: Boxy/irregular regions, table cells, diagram labels.
- **arrow**: Very small or punctate structures (mitotic figure, single cell, small vessel). Also for pointing to a specific area within a larger structure.
- **none**: Overview/pattern images where the entire field is relevant — no single feature to highlight.

## Position guide:
x=0 is left edge, x=100 is right edge. y=0 is top, y=100 is bottom. Centre = {x:50, y:50}.
Position should point to the CENTER of the most important diagnostic feature.

## Object fields:
- objectPresent: Is there a discrete identifiable structure (with clear boundaries) as the key teaching feature?
- objectShape: circular (round), ovoid (elongated), or irregular
- objectSize: large (>50% of frame), medium (20-50%), small (<20%)`;
}

// ---------------------------------------------------------------------------
// Parse Claude's JSON response
// ---------------------------------------------------------------------------

function parseVisionJSON(raw: string, _image: ImageInput): VisionResult | null {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(cleaned);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      obj = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }

  const canSeeImage = obj.canSeeImage !== false;
  if (!canSeeImage) {
    return {
      canSeeImage: false,
      featurePosition: null,
      suggestedLabel: "",
      annotationTool: "none",
      annotationReason: "Model could not see the image.",
    };
  }

  // Parse position
  let featurePosition: { x: number; y: number } | null = null;
  if (obj.featurePosition && typeof obj.featurePosition === "object") {
    const pos = obj.featurePosition as Record<string, unknown>;
    const x = Number(pos.x);
    const y = Number(pos.y);
    if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
      featurePosition = { x, y };
    }
  }

  // Parse annotation tool
  const validTools: AnnotationTool[] = [
    "spotlight",
    "circle",
    "ellipse",
    "rectangle",
    "arrow",
    "none",
  ];
  let annotationTool: AnnotationTool = "none";
  if (
    typeof obj.annotationTool === "string" &&
    validTools.includes(obj.annotationTool as AnnotationTool)
  ) {
    annotationTool = obj.annotationTool as AnnotationTool;
  }

  // Safety: tool requires position
  if (annotationTool !== "none" && !featurePosition) {
    annotationTool = "none";
  }

  const suggestedLabel =
    typeof obj.suggestedLabel === "string"
      ? obj.suggestedLabel
          .replace(/[.,;:!?"']+$/, "")
          .trim()
          .slice(0, 50)
      : "";

  const annotationReason =
    typeof obj.annotationReason === "string" ? obj.annotationReason.slice(0, 200) : "";

  return {
    canSeeImage,
    featurePosition,
    suggestedLabel,
    annotationTool,
    annotationReason,
    objectPresent: obj.objectPresent === true ? true : obj.objectPresent === false ? false : null,
    objectShape: ["circular", "ovoid", "irregular"].includes(obj.objectShape as string)
      ? (obj.objectShape as "circular" | "ovoid" | "irregular")
      : null,
    objectSize: ["large", "medium", "small"].includes(obj.objectSize as string)
      ? (obj.objectSize as "large" | "medium" | "small")
      : null,
  };
}

// ---------------------------------------------------------------------------
// Deterministic tool override
// Uses v1's decision table + spotlight bias for consistency.
// ---------------------------------------------------------------------------

function overrideToolDeterministically(result: VisionResult, image: ImageInput): VisionResult {
  const category = image.category?.toLowerCase() ?? "";

  // Only override for microscopic/gross — figures/tables/diagrams get "none"
  if (category !== "microscopic" && category !== "gross") {
    return { ...result, annotationTool: "none", annotationReason: `${category} — no annotation` };
  }

  // No position = no annotation, just pan
  if (!result.featurePosition) {
    return { ...result, annotationTool: "none", annotationReason: "No feature position found" };
  }

  // Use v1 decision table for microscopic
  if (category === "microscopic") {
    let tool = deriveMicroscopicTool(
      result.objectPresent ?? null,
      result.objectShape ?? null,
      result.objectSize ?? null,
      image.magnification
    );

    // Spotlight bias: upgrade circle/ellipse to spotlight for more visual impact
    if (tool === "circle" || tool === "ellipse") {
      tool = "spotlight";
    }

    return {
      ...result,
      annotationTool: tool,
      annotationReason: `Deterministic: obj=${result.objectPresent ? "yes" : "no"}, shape=${result.objectShape ?? "n/a"}, size=${result.objectSize ?? "n/a"}, mag=${image.magnification ?? "?"} → ${tool} (spotlight bias)`,
    };
  }

  // Gross: spotlight if feature found, none otherwise
  return {
    ...result,
    annotationTool: result.objectPresent ? "spotlight" : "none",
    annotationReason: result.objectPresent
      ? "Gross specimen with focal feature → spotlight"
      : "Gross specimen overview → no annotation",
  };
}

// ---------------------------------------------------------------------------
// Single image analysis with fallback chain
// ---------------------------------------------------------------------------

async function analyzeOneImage(image: ImageInput): Promise<VisionResult> {
  const FALLBACK: VisionResult = {
    canSeeImage: false,
    featurePosition: null,
    suggestedLabel: "",
    annotationTool: "none",
    annotationReason: "Vision analysis failed.",
  };

  // Resolve magnification
  const resolvedMag = normaliseMagnification(
    image.magnification as string | null | undefined,
    `${image.title} ${image.description}`
  );
  const imageWithMag: ImageInput =
    resolvedMag !== image.magnification ? { ...image, magnification: resolvedMag } : image;

  const prompt = buildVisionPrompt(imageWithMag);

  try {
    const result = await callWithFallback(
      LESSON_GEN_VISION_MODELS,
      async (model, apiKey, provider) => {
        if (provider === "claude") {
          const res = await callClaudeVision(prompt, image.url, model, apiKey, {
            system: "You are an expert pathologist. Respond with only the JSON requested.",
            maxTokens: 800,
            temperature: 0.1,
            timeoutMs: 25_000,
          });
          const parsed = parseVisionJSON(res.content, imageWithMag);
          if (!parsed) throw new Error("Failed to parse Claude vision response");
          return parsed;
        }
        if (provider === "llama") {
          // Use existing Llama vision path
          const llamaResults = await llamaAnalyzeImages([imageWithMag], apiKey);
          return llamaResults[0] ?? FALLBACK;
        }
        if (provider === "google") {
          // Gemini vision
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { inline_data: undefined, file_data: undefined, text: undefined },
                      { text: prompt },
                    ],
                  },
                ],
                generationConfig: { temperature: 0.1, maxOutputTokens: 800 },
              }),
            }
          );
          // Gemini doesn't easily support image URLs in the same way; fall through
          if (!res.ok) throw new Error(`Gemini vision not supported for URL images`);
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          const parsed = parseVisionJSON(text, imageWithMag);
          if (!parsed) throw new Error("Failed to parse Gemini vision response");
          return parsed;
        }
        throw new Error(`Unsupported vision provider: ${provider}`);
      },
      `vision-v2[${image.title.slice(0, 30)}]`
    );
    // Override Claude's tool suggestion with deterministic decision table
    return overrideToolDeterministically(result, imageWithMag);
  } catch (err) {
    console.warn(`[vision-v2] All models failed for "${image.title}":`, err);
    return FALLBACK;
  }
}

// ---------------------------------------------------------------------------
// Public API: analyse all images in parallel
// ---------------------------------------------------------------------------

export async function analyzeImagesV2(images: ImageInput[]): Promise<VisionResult[]> {
  console.log(`[vision-v2] Analysing ${images.length} images...`);
  const results = await Promise.all(images.map((img) => analyzeOneImage(img)));
  const seen = results.filter((r) => r.canSeeImage).length;
  console.log(`[vision-v2] Done — ${seen}/${images.length} analysed successfully`);
  return results;
}
