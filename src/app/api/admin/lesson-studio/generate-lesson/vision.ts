// Per-image vision for the lesson generator: where the key feature is, what to
// call it, and how to point at it. Runs every image through the shared vision
// fallback chain with one JSON prompt; the model's choice of pointer is then
// replaced by a deterministic decision table (magnification × object shape ×
// size), which proved steadier than trusting the model.

import { runVisionTask } from "@/shared/services/ai-fallback";
import { log } from "@/shared/utils/logging";

/** One library image as the generator sees it. */
export interface ImageInput {
  url: string;
  title: string;
  description: string;
  category: string; // "microscopic" | "gross" | "figure" | "table" | ...
  /** Microscopic magnification level — guides the pointer choice. */
  magnification?: "low" | "medium" | "high" | "very_high" | null;
  width: number;
  height: number;
}

export type AnnotationTool =
  | "spotlight" // Dims surroundings — low-mag busy fields where feature is hard to locate
  | "circle" // Circular discrete structure — round follicle, granuloma
  | "ellipse" // Elongated discrete structure — twinned GCs, oval gland pair
  | "rectangle" // Boxy/irregular region — table cell, labelled diagram region
  | "arrow" // Very small or punctate structure — mitotic figure, vessel, single cell
  | "none"; // Overview/pattern image — text overlay is sufficient

export type ObjectShape = "circular" | "ovoid" | "irregular";
export type ObjectSize = "large" | "medium" | "small";

export interface VisionResult {
  /** Whether the vision model could actually see and interpret the image. */
  canSeeImage: boolean;
  /** Position of the single most important feature, in 0–100 viewport coords. */
  featurePosition: { x: number; y: number } | null;
  /** Concise label for the feature (≤5 words). */
  suggestedLabel: string;
  /** Which annotation tool is most appropriate for this image. */
  annotationTool: AnnotationTool;
  /** One-sentence justification for the tool choice. */
  annotationReason: string;
  // --- Microscopic-specific fields ---
  /** Whether a discrete object/structure is present (Q0 for microscopic). */
  objectPresent?: boolean | null;
  /** Geometric shape of the identified object (Q0b). */
  objectShape?: ObjectShape | null;
  /** Relative size of the object in the frame (Q0c). */
  objectSize?: ObjectSize | null;
}

// ---------------------------------------------------------------------------
// Normalise magnification from DB string ("10x", "40x", …) or free text
// ---------------------------------------------------------------------------

type MagnificationEnum = ImageInput["magnification"];

/**
 * Convert a raw DB magnification string (e.g. "10x", "40x") or a free-text
 * description/title that mentions magnification keywords into the canonical
 * "low" | "medium" | "high" | "very_high" enum used by the decision table.
 *
 * DB numeric mapping:
 *   2x, 4x, 5x                → low
 *   10x                       → low   (scanning / overview power)
 *   20x                       → medium
 *   40x, 50x                  → high
 *   60x, 100x                 → very_high
 *
 * Text heuristics (applied to title + description when DB value is absent):
 *   "low power" / "low mag" / "×4" / "×10"                      → low
 *   "medium power" / "intermediate" / "×20"                      → medium
 *   "high power" / "high mag" / "hpf" / "×40" / "×60"           → high
 *   "oil immersion" / "×100"                                     → very_high
 */
export function normaliseMagnification(
  dbValue: string | null | undefined,
  fallbackText?: string
): MagnificationEnum {
  // 1. Try numeric DB value first
  if (dbValue) {
    const lower = dbValue.toLowerCase().trim();
    const xMatch = lower.match(/^(\d+)x$/);
    if (xMatch) {
      const n = parseInt(xMatch[1], 10);
      if (n <= 10) return "low";
      if (n <= 20) return "medium";
      if (n <= 60) return "high";
      return "very_high"; // 100x+
    }
    // Already in enum form (e.g. passed directly from vision-test)
    if (["low", "medium", "high", "very_high"].includes(lower)) {
      return lower as MagnificationEnum;
    }
  }

  // 2. Text-based fallback — scan title + description
  if (fallbackText) {
    const t = fallbackText.toLowerCase();
    // Very high (oil immersion, 100x) — check before "high" to avoid partial match
    if (/oil.?immersion|×\s*100|\b100\s*x\b/.test(t)) return "very_high";
    // High
    if (/high.?power|high.?mag|h\.?p\.?f\.?|hpf|×\s*40|×\s*60|\b40\s*x\b|\b60\s*x\b/.test(t))
      return "high";
    // Medium
    if (/medium.?power|intermediate.?mag|×\s*20|\b20\s*x\b/.test(t)) return "medium";
    // Low
    if (
      /low.?power|low.?mag|scanning.?power|overview|×\s*[245]|×\s*10|\b[245]\s*x\b|\b10\s*x\b/.test(
        t
      )
    )
      return "low";
  }

  return null;
}

// ---------------------------------------------------------------------------
// Derive tool from object properties + magnification (microscopic/gross)
//
// Decision table:
//   No object, any mag                                  → none  (pan/zoom only)
//   Object, low mag,   circular/ovoid                   → spotlight + zoom-in
//   Object, low mag,   irregular                        → arrow + zoom-in
//   Object, other mag, medium/large, circular/ovoid     → circle / ellipse
//   Object, other mag, small,        circular/ovoid     → arrow
//   Object, other mag, medium/large, irregular          → none  (pan/zoom only)
//   Object, other mag, small,        irregular          → spotlight + zoom-in
// ---------------------------------------------------------------------------

/** @internal exported for testing */
export function deriveMicroscopicTool(
  objectPresent: boolean | null,
  objectShape: ObjectShape | null,
  objectSize: ObjectSize | null,
  magnification: ImageInput["magnification"]
): AnnotationTool {
  // No discrete object → simple pan/zoom, no annotation overlay
  if (!objectPresent) return "none";

  const isLowMag = magnification === "low";
  const isSmall = objectSize === "small";
  const isMediumOrLarge = objectSize === "medium" || objectSize === "large";
  const isRound = objectShape === "circular" || objectShape === "ovoid";
  const isIrregular = objectShape === "irregular";

  // Low mag + circular/ovoid → spotlight (draw attention within busy architecture)
  if (isLowMag && isRound) return "spotlight";

  // Low mag + irregular → arrow (point to the oddly-shaped feature)
  if (isLowMag && isIrregular) return "arrow";

  // Higher mag + medium/large + circular/ovoid → shape outline
  if (!isLowMag && isMediumOrLarge && isRound) {
    return objectShape === "ovoid" ? "ellipse" : "circle";
  }

  // Higher mag + small + circular/ovoid → arrow (too small for a shape)
  if (!isLowMag && isSmall && isRound) return "arrow";

  // Higher mag + medium/large + irregular → pan/zoom only
  if (!isLowMag && isMediumOrLarge && isIrregular) return "none";

  // Higher mag + small + irregular → spotlight (subtle, hard to find)
  if (!isLowMag && isSmall && isIrregular) return "spotlight";

  // Fallback
  return "none";
}

// ---------------------------------------------------------------------------
// Prompt
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
// Parse the model's JSON response
// ---------------------------------------------------------------------------

/** @internal exported for testing */
export function parseVisionJSON(raw: string, _image: ImageInput): VisionResult | null {
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
// The decision table below, plus a bias toward spotlights.
// ---------------------------------------------------------------------------

/** @internal exported for testing */
export function overrideToolDeterministically(
  result: VisionResult,
  image: ImageInput
): VisionResult {
  const category = image.category?.toLowerCase() ?? "";

  // Only override for microscopic/gross — figures/tables/diagrams get "none"
  if (category !== "microscopic" && category !== "gross") {
    return { ...result, annotationTool: "none", annotationReason: `${category} — no annotation` };
  }

  // No position = no annotation, just pan
  if (!result.featurePosition) {
    return { ...result, annotationTool: "none", annotationReason: "No feature position found" };
  }

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

async function analyzeOneImage(image: ImageInput, modelOverride?: string): Promise<VisionResult> {
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
    const { parsed: result } = await runVisionTask("lesson-vision", prompt, image.url, {
      system: "You are an expert pathologist. Respond with only the JSON requested.",
      label: `lesson-vision[${image.title.slice(0, 30)}]`,
      modelOverride,
      // Parsing inside the attempt is what makes fallback meaningful: a model
      // that answers but returns unparseable JSON hands off to the next one.
      parse: (content) => {
        const p = parseVisionJSON(content, imageWithMag);
        if (!p) throw new Error("Failed to parse vision response");
        return p;
      },
    });
    // Override the model's tool suggestion with deterministic decision table
    return overrideToolDeterministically(result, imageWithMag);
  } catch (err) {
    log.warn(`[lesson-vision] All models failed for "${image.title}":`, err);
    return FALLBACK;
  }
}

// ---------------------------------------------------------------------------
// Public API: analyse all images in parallel
// ---------------------------------------------------------------------------

export async function analyzeImages(
  images: ImageInput[],
  modelOverride?: string
): Promise<VisionResult[]> {
  log.debug(`[lesson-vision] Analysing ${images.length} images...`);
  const results = await Promise.all(images.map((img) => analyzeOneImage(img, modelOverride)));
  const seen = results.filter((r) => r.canSeeImage).length;
  log.debug(`[lesson-vision] Done — ${seen}/${images.length} analysed successfully`);
  return results;
}
