import type { ImageInput } from "./prompt";

// ---------------------------------------------------------------------------
// Vision result — one area of interest per image
// ---------------------------------------------------------------------------

export type AnnotationTool =
  | "spotlight" // Dims surroundings — low-mag busy fields where feature is hard to locate
  | "circle" // Circular discrete structure — round follicle, granuloma
  | "ellipse" // Elongated discrete structure — twinned GCs, oval gland pair
  | "rectangle" // Boxy/irregular region — table cell, labelled diagram region
  | "arrow" // Very small or punctate structure — mitotic figure, vessel, single cell
  | "none"; // Overview/pattern image — text overlay is sufficient

export type ObjectShape = "circular" | "ovoid" | "irregular";
export type ObjectSize = "large" | "medium" | "small";

export interface AnnotationShape {
  /** Shape type matching the tool */
  type: "circle" | "ellipse" | "rectangle";
  /** Width as % of viewport (0–100) */
  width: number;
  /** Height as % of viewport (0–100) */
  height: number;
}

export interface VisionResult {
  /** Whether Llama could actually see and interpret the image. */
  canSeeImage: boolean;
  /** Position of the single most important feature, in 0–100 viewport coords. */
  featurePosition: { x: number; y: number } | null;
  /** Concise label for the feature (≤5 words). */
  suggestedLabel: string;
  /** Which annotation tool is most appropriate for this image. */
  annotationTool: AnnotationTool;
  /** Shape details when tool is circle/ellipse/rectangle. */
  annotationShape?: AnnotationShape | null;
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
// Parse helpers
// ---------------------------------------------------------------------------

function parseXY(text: string): { x: number; y: number } | null {
  const m = text.match(/x\s*[=:]\s*(\d+(?:\.\d+)?)\s*%?,?\s*y\s*[=:]\s*(\d+(?:\.\d+)?)\s*%?/i);
  if (m) {
    const x = parseFloat(m[1]);
    const y = parseFloat(m[2]);
    if (x >= 0 && x <= 100 && y >= 0 && y <= 100) return { x, y };
  }
  return null;
}

function parseAnnotationShape(lines: string[]): AnnotationShape | null {
  for (const line of lines) {
    const wm = line.match(/w(?:idth)?\s*[=:]\s*(\d+(?:\.\d+)?)/i);
    const hm = line.match(/h(?:eight)?\s*[=:]\s*(\d+(?:\.\d+)?)/i);
    if (wm && hm) {
      const width = parseFloat(wm[1]);
      const height = parseFloat(hm[1]);
      if (width > 0 && width <= 100 && height > 0 && height <= 100) {
        const lower = line.toLowerCase();
        let type: AnnotationShape["type"] = "circle";
        if (/\bellipse\b/.test(lower) || Math.abs(width / height - 1) > 0.25) type = "ellipse";
        if (/\brectangle\b|\bsquare\b/.test(lower)) type = "rectangle";
        return { type, width, height };
      }
    }
  }
  return null;
}

function parseObjectPresent(text: string): boolean | null {
  const lower = text.toLowerCase();
  // Look for explicit yes/no near Q0
  if (/\byes\b/.test(lower)) return true;
  if (/\bno\b/.test(lower)) return false;
  return null;
}

function parseObjectShape(text: string): ObjectShape | null {
  const lower = text.toLowerCase();
  if (/\bcircular\b|\bround\b/.test(lower)) return "circular";
  if (/\bovoid\b|\boval\b|\belliptical\b/.test(lower)) return "ovoid";
  if (/\birregular\b/.test(lower)) return "irregular";
  return null;
}

function parseObjectSize(text: string): ObjectSize | null {
  const lower = text.toLowerCase();
  if (/\blarge\b/.test(lower)) return "large";
  if (/\bmedium\b/.test(lower)) return "medium";
  if (/\bsmall\b/.test(lower)) return "small";
  return null;
}

// ---------------------------------------------------------------------------
// Normalise magnification from DB string ("10x", "40x", …) or free text
// ("low magnification", "high power field", etc.) to the ImageInput enum.
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

function deriveMicroscopicTool(
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
// Build prompt per image category
// ---------------------------------------------------------------------------

function buildMicroscopicPrompt(image: ImageInput): string {
  const magLabel = image.magnification
    ? {
        low: "low magnification (e.g. ×4–×10 — overview of architecture)",
        medium: "medium magnification (e.g. ×20 — balance of architecture and cytology)",
        high: "high magnification (e.g. ×40 — cellular detail)",
        very_high: "very high magnification (e.g. ×60–×100 — subcellular/nuclear detail)",
      }[image.magnification]
    : "unknown magnification";

  return `Pathology image metadata:
- Title: ${image.title || "(none)"}
- Description: ${image.description || "(none)"}
- Category: microscopic
- Magnification: ${magLabel}

This is a histologic/microscopic image. Answer each question on its own numbered line.

1. Can you see and interpret this image? (yes/no + one-sentence reason)

2. What is the single most important visual feature in this image?

3. Is there a discrete, identifiable object or structure present as the key teaching feature?
   Answer: yes or no
   (A discrete structure has clear boundaries — a follicle, granuloma, vessel, cell cluster, gland pair, etc.
    Answer "no" if the image conveys an overall tissue pattern, architectural impression, or diffuse change with no single focal structure to highlight.)

3a. [Only if Q3 = yes] What is the geometric shape of that structure?
   Choose ONE: circular | ovoid | irregular

3b. [Only if Q3 = yes] What is the relative size of that structure within the image frame?
   large — occupies more than half the frame (>50%)
   medium — occupies roughly one-fifth to one-half (20–50%)
   small — occupies less than one-fifth (<20%)

4. Based on Q3/3a/3b and the magnification, choose the annotation tool:
   - No discrete object, any magnification                   → none (pan/zoom only, no overlay)
   - Object present, low mag,   circular/ovoid               → spotlight
   - Object present, low mag,   irregular                    → arrow
   - Object present, other mag, medium/large, circular/ovoid → circle (or ellipse if ovoid)
   - Object present, other mag, small,        circular/ovoid → arrow
   - Object present, other mag, medium/large, irregular      → none (pan/zoom only)
   - Object present, other mag, small,        irregular      → spotlight
   State: tool = <choice> — one sentence of reasoning.

5. Position and size of the annotation target:
   If tool is circle or ellipse: x=<0–100>, y=<0–100>, w=<width as % of image>, h=<height as % of image>
   If tool is arrow:    x=<0–100>, y=<0–100>, w=0, h=0
   If tool is spotlight: x=<0–100>, y=<0–100>, w=<radius as % of image>, h=<radius as % of image>
   If tool is none:     x=50, y=50, w=0, h=0

6. Suggested text overlay label (5 words or fewer, naming the key feature or variant shown).`;
}

// Gross prompt intentionally omitted — gross images skip the vision pass for now.

// ---------------------------------------------------------------------------
// Parse vision response — category-aware
// ---------------------------------------------------------------------------

function parseVisionResponse(raw: string, image: ImageInput): Omit<VisionResult, "canSeeImage"> {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // --- Parse Q3: object present ---
  let objectPresent: boolean | null = null;
  for (const line of lines) {
    if (/^3[.)]/i.test(line) && !/^3a|^3b/i.test(line)) {
      objectPresent = parseObjectPresent(line);
      if (objectPresent !== null) break;
    }
  }
  // Fallback: scan whole text
  if (objectPresent === null) {
    const q3Block = raw.match(/^3[.)][^\n]*/im)?.[0] ?? "";
    objectPresent = parseObjectPresent(q3Block);
  }

  // --- Parse Q3a: shape ---
  let objectShape: ObjectShape | null = null;
  for (const line of lines) {
    if (/^3a[.)]/i.test(line)) {
      objectShape = parseObjectShape(line);
      break;
    }
  }

  // --- Parse Q3b: size ---
  let objectSize: ObjectSize | null = null;
  for (const line of lines) {
    if (/^3b[.)]/i.test(line)) {
      objectSize = parseObjectSize(line);
      break;
    }
  }

  // --- Parse feature position (Q5) ---
  let featurePosition: { x: number; y: number } | null = null;
  for (const line of lines) {
    const pos = parseXY(line);
    if (pos) {
      featurePosition = pos;
      break;
    }
  }

  // --- Parse suggested label (Q6) ---
  let suggestedLabel = "";
  for (const line of lines) {
    if (/^6[.)]/i.test(line) || /suggested.*label|text.*overlay/i.test(line)) {
      const cleaned = line
        .replace(/^6[.)]\s*/i, "")
        .replace(/suggested (text )?label[:\s]*/i, "")
        .replace(/^["']|["']$/g, "")
        .trim();
      if (cleaned.length > 0 && cleaned.length < 60) {
        suggestedLabel = cleaned;
        break;
      }
    }
  }
  if (!suggestedLabel) {
    const quoted = raw.match(/"([^"]{3,40})"/);
    if (quoted) suggestedLabel = quoted[1];
  }

  // --- Parse model's tool choice (Q4) — used only for annotationReason text ---
  let modelToolReason = "";
  for (const line of lines) {
    if (/^4[.)]/i.test(line) || /\btool\b.*=|tool choice|annotation tool/i.test(line)) {
      modelToolReason = line
        .replace(/^4[.)]\s*/i, "")
        .trim()
        .slice(0, 200);
      break;
    }
  }

  // --- Always derive tool deterministically from Q3/3a/3b + magnification ---
  const annotationTool = deriveMicroscopicTool(
    objectPresent,
    objectShape,
    objectSize,
    image.magnification
  );
  const annotationReason =
    modelToolReason ||
    `Derived: object=${objectPresent ? "yes" : "no"}, shape=${objectShape ?? "n/a"}, size=${objectSize ?? "n/a"}, mag=${image.magnification ?? "unknown"} → ${annotationTool}.`;

  // --- Extract shape dimensions (Q5) for shape-based tools ---
  const annotationShape = ["circle", "ellipse", "spotlight"].includes(annotationTool)
    ? parseAnnotationShape(lines)
    : null;

  // --- Safety: if tool requires position but none found → fall back to none ---
  let finalTool = annotationTool;
  let finalReason = annotationReason;
  if (finalTool !== "none" && !featurePosition) {
    finalReason = "No reliable position found — skipping annotation.";
    finalTool = "none";
  }

  return {
    featurePosition,
    suggestedLabel,
    annotationTool: finalTool,
    annotationShape,
    annotationReason: finalReason,
    objectPresent,
    objectShape,
    objectSize,
  };
}

// ---------------------------------------------------------------------------
// Single image vision call
// ---------------------------------------------------------------------------

async function analyzeOneImage(image: ImageInput, apiKey: string): Promise<VisionResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  const FALLBACK: VisionResult = {
    canSeeImage: false,
    featurePosition: null,
    suggestedLabel: "",
    annotationTool: "none",
    annotationReason: "Vision call failed.",
  };

  // Skip vision pass for figures, tables, and gross images — handled elsewhere
  const category = image.category?.toLowerCase() ?? "";
  if (category === "figure" || category === "table" || category === "gross") {
    clearTimeout(timeoutId);
    return {
      canSeeImage: true,
      featurePosition: null,
      suggestedLabel: "",
      annotationTool: "none",
      annotationReason: `${category} — vision pass skipped.`,
    };
  }

  // Resolve magnification: normalise DB string / infer from text if missing
  const resolvedMag = normaliseMagnification(
    image.magnification as string | null | undefined,
    `${image.title} ${image.description}`
  );
  const imageWithMag: ImageInput =
    resolvedMag !== image.magnification ? { ...image, magnification: resolvedMag } : image;

  // Build prompt (microscopic only for now)
  const promptText = buildMicroscopicPrompt(imageWithMag);

  let response: Response;
  try {
    response = await fetch("https://api.llama.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "Llama-4-Scout-17B-16E-Instruct-FP8",
        messages: [
          {
            role: "system",
            content:
              "You are an expert pathologist with strong visual analysis skills. Be concise and precise. Answer each numbered question on its own line. If you cannot see the image, say so on line 1.",
          },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: image.url } },
              { type: "text", text: promptText },
            ],
          },
        ],
        max_completion_tokens: 600,
        temperature: 0.1,
      }),
    });
    clearTimeout(timeoutId);
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn(`[vision] Failed for ${image.url.slice(-40)}: ${error}`);
    return FALLBACK;
  }

  if (!response.ok) {
    console.warn(`[vision] API error ${response.status} for ${image.url.slice(-40)}`);
    return FALLBACK;
  }

  const data = await response.json();
  const content: string =
    data.completion_message?.content?.text || data.choices?.[0]?.message?.content || "";

  if (!content) return FALLBACK;

  // Check if model could see the image (Q1 answer)
  const q1Line =
    content.split("\n").find((l) => /^1[.)]/i.test(l.trim())) ?? content.split("\n")[0];
  const q1Lower = q1Line.toLowerCase();
  const canSeeImage =
    !q1Lower.includes("no,") &&
    !q1Lower.includes("cannot") &&
    !q1Lower.includes("can't") &&
    !q1Lower.includes("unable") &&
    (q1Lower.includes("yes") || content.length > 100);

  if (!canSeeImage) {
    return {
      ...FALLBACK,
      canSeeImage: false,
      annotationReason: "Model could not interpret the image.",
    };
  }

  const parsed = parseVisionResponse(content, imageWithMag);
  return { canSeeImage, ...parsed };
}

// ---------------------------------------------------------------------------
// Public: analyse all images in parallel
// ---------------------------------------------------------------------------

export async function analyzeImages(images: ImageInput[], apiKey: string): Promise<VisionResult[]> {
  console.log(`[vision] Analysing ${images.length} images in parallel…`);
  const results = await Promise.all(images.map((img) => analyzeOneImage(img, apiKey)));
  const seen = results.filter((r) => r.canSeeImage).length;
  const toolCounts = results.reduce(
    (acc, r) => {
      acc[r.annotationTool] = (acc[r.annotationTool] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  console.log(
    `[vision] Done — ${seen}/${images.length} seen, tools: ${JSON.stringify(toolCounts)}`
  );
  return results;
}
