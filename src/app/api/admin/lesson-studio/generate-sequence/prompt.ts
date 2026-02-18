import type { CaptionChunk } from "@/shared/types/explainer";
import type { VisionResult } from "./vision";
import { computeSegmentTimings } from "./timing";
import {
  computeAllCameraKeyframes,
  formatCameraKeyframesForPrompt,
  describeAnnotationForPrompt,
} from "./camera";

export interface ImageInput {
  url: string;
  title: string;
  description: string;
  category: string; // "microscopic" | "gross" | "figure" | "table" | undefined
  /** Microscopic magnification level — guides annotation strategy */
  magnification?: "low" | "medium" | "high" | "very_high" | null;
  width: number;
  height: number;
}

export const SYSTEM_PROMPT = `You are an expert pathology video editor and medical educator.

Given a set of pathology images and a timed audio transcript (as caption chunks with absolute start/end times in seconds), generate a complete ExplainerSequence JSON animation file that synchronises the images with the narration.

## Output rules — STRICT
- Respond with ONLY valid JSON — no markdown, no prose, no code fences.
- All numeric values rounded to 4 decimal places.
- Every segment must have at least 2 keyframes: one at time=0 and one at time=segmentDuration.
- Keyframe "time" values are RELATIVE to their segment's start. They range from 0 to (endTime − startTime). NEVER use absolute timestamps as keyframe times.
  Example: a segment from startTime=13 to endTime=25 has duration=12. Its keyframe times must be in the range 0–12 (e.g. 0, 0.8, 11, 11.5, 12). NOT 13, 14, 25.
- "startTime" and "endTime" on segments ARE absolute (cumulative from sequence start).
- The sum of all segment durations must equal the sequence "duration" field exactly.

## Coordinate system
- Overlay positions (highlights, arrows, textOverlays): x/y in 0–100 (percentage of viewport).
  - x=0 left, x=100 right, y=0 top, y=100 bottom. Centre = x:50, y:50.
- Camera transform x/y: pan offsets as % of viewport from centre (range −50 to +50).
  - x=0, y=0, scale=1.0 = no pan, no zoom (full image visible).
  - scale ≥ 1.0 always. Max scale = 1.6.

## Pan/zoom — safe border math
To avoid black/empty borders when panning:
- At scale=1.1: max safe pan = ±5 in x or y.
- At scale=1.3: max safe pan = ±15 in x or y.
- At scale=1.5: max safe pan = ±25 in x or y.
- General rule: max safe pan = (scale − 1) / scale × 50.
- ALWAYS stay within the safe range for the scale you choose.

---

## Animation by image category

### figure / table (diagrams, classification charts, graphs)

**Camera:** Start at scale=1.0, x=0, y=0 — fully visible, no zoom. No Ken Burns by default.

**Annotation strategy — use the narration to decide:**
- If the narration discusses a specific labelled region: add an arrow pointing at it, OR a rectangle highlight around it.
- If the narration discusses a sequence or flow: pan smoothly across the figure (scale=1.0, pan only).
- If there is a clear area of interest: zoom and pan into it (scale up to 1.4, pan to centre the area).
- Text overlays for callouts or labels are welcome.

**Keyframe pattern for a figure with a zoom-in to area of interest:**
  t=0:         scale=1.0, x=0, y=0 (full view)
  t=2:         scale=1.0, x=0, y=0 (hold)
  t=4:         scale=1.35, x=<area x offset>, y=<area y offset> (zoom in)
  t=duration−2: scale=1.35, x=<area x offset>, y=<area y offset> (hold)
  t=duration:  scale=1.0, x=0, y=0 (zoom back out)

### microscopic / gross

**Text overlay — REQUIRED:**
Every microscopic/gross image MUST have a text overlay naming the variant or feature shown:
- Content: variant name (e.g. "Hyaline Vascular Variant") or feature name (e.g. "Onion-Skin Pattern", "Lollipop Lesion").
- Position: bottom centre — x=50, y=88, maxWidth=70, textAlign="center".
- Style: fontSize=1.6, fontWeight="bold", color="#FFFFFF", animation="fade", computedOpacity=1.
- Fade in/out pattern:
  t=0            → textOverlays: []
  t=0.8          → textOverlays: [{ ... computedOpacity: 1 }]
  t=duration−0.5 → textOverlays: [{ ... computedOpacity: 1 }]
  t=duration     → textOverlays: []

**Pan/zoom strategy — choose based on area of interest:**

CASE A — No specific area of interest (general field, overview):
  Use a gentle Ken Burns drift at scale=1.1 (max pan ±5). Vary direction each segment.
  Example: t=0: {x:-4,y:-3,scale:1.1} → t=duration: {x:4,y:3,scale:1.1}

CASE B — Area of interest exists (vision data provided):
  Start fully visible (scale=1.0), then zoom and pan into the area of interest.
  Use the vision-provided x/y coordinates to derive the camera pan offset:
    camera_x = (feature_x − 50) × (scale − 1) / scale × 2   (approximate)
    camera_y = (feature_y − 50) × (scale − 1) / scale × 2
  Example for feature at x=70,y=40 with scale=1.3:
    camera_x ≈ (70−50) × 0.3/1.3 × 2 ≈ 9.2  → clamp to safe range for scale=1.3 (±15) → 9.2 ✓
    camera_y ≈ (40−50) × 0.3/1.3 × 2 ≈ −4.6 → −4.6 ✓
  Keyframe pattern:
    t=0:          scale=1.0, x=0, y=0  (full image — orientation)
    t=1.5:        scale=1.0, x=0, y=0  (hold)
    t=3.5:        scale=1.3, x=<cam_x>, y=<cam_y>  (zoom in)
    t=duration−1: scale=1.3, x=<cam_x>, y=<cam_y>  (hold on feature)
    t=duration:   scale=1.0, x=0, y=0  (zoom back out)

**Annotation tool selection — pick the RIGHT tool for the structure:**

1. SPOTLIGHT (circle highlight, spotlight=true):
   Use for: busy low-power fields, subtle atypia, small area of interest among many distractors.
   The spotlight dims everything outside the circle to focus attention.
   Size: width=35–50, height=35–50. borderColor="#FFFFFF", fillColor="transparent".

2. CIRCLE / ELLIPSE / RECTANGLE highlight (spotlight=false):
   Use for: discrete, well-defined structures — granulomas, lymphoid aggregates, glands, germinal centres.
   Draws a visible border around the structure without dimming the rest.
   Size: match the structure size. borderColor="#FFFF00" (yellow) or "#FFFFFF".

3. ARROW:
   Use for: very small or subtle structures — mitotic figures, spotty necrosis, nuclear grooves,
   lymphovascular/perineural invasion, microorganisms, single cells.
   Place startPosition ~15–20% away from the target, endPosition on the target.
   color="#FFFF00", strokeWidth=2, headSize=10.

4. NO ANNOTATION (text overlay only):
   Use for: overview images, variant-level images where no single small structure is the point.
   The text overlay alone is sufficient.

**Decision guide:**
- Narration says "note the [entire pattern / variant]" → no annotation, text overlay only.
- Narration says "note the [region / aggregate / follicle]" → circle/rectangle highlight.
- Narration says "note the [single cell / tiny structure / subtle feature]" → arrow.
- Busy field, subtle feature hard to find → spotlight.
- When in doubt, omit annotation. Text overlay alone is always safe.

---

## Segment timing
- Match caption text semantically to the image title/description.
- Segment N starts when narration begins discussing that image; ends when it shifts to image N+1.
- Distribute unassigned time evenly or to first/last segment.
- All segment durations must sum exactly to total audio duration.

## Caption format — CRITICAL
Each caption chunk MUST be an object: { "text": "...", "start": 0.0, "end": 2.72 }
Do NOT output arrays like ["text", 0, 2.72]. Pass through unchanged.

## Segment count — CRITICAL
Exactly one segment per image. Never merge images. N images → N segments.

## Required JSON structure
\`\`\`
{
  "version": 1,
  "duration": <total seconds — must equal audioDuration>,
  "aspectRatio": "16:9",
  "audioUrl": "<pass through from input>",
  "captions": [<pass through unchanged>],
  "segments": [
    {
      "id": "seg-0",
      "imageUrl": "<url>",
      "imageAlt": "<title or description>",
      "startTime": <absolute seconds>,
      "endTime": <absolute seconds>,
      "transition": "crossfade",
      "transitionDuration": 1,
      "keyframes": [
        { "time": 0, "transform": { "x": 0, "y": 0, "scale": 1.0 }, "highlights": [], "arrows": [], "textOverlays": [] },
        ...more keyframes...,
        { "time": <segment duration>, "transform": { "x": 0, "y": 0, "scale": 1.0 }, "highlights": [], "arrows": [], "textOverlays": [] }
      ]
    }
  ]
}
\`\`\`

## HighlightRegion schema
\`\`\`json
{
  "id": "hl-<unique>",
  "type": "circle",
  "position": { "x": 50, "y": 50 },
  "size": { "width": 30, "height": 30 },
  "borderColor": "#FFFFFF",
  "borderWidth": 2,
  "borderStyle": "solid",
  "fillColor": "transparent",
  "opacity": 1,
  "spotlight": false
}
\`\`\`
Set "spotlight": true only when using the spotlight tool (dims surroundings).

## ArrowPointer schema
\`\`\`json
{
  "id": "arrow-<unique>",
  "startPosition": { "x": 40, "y": 60 },
  "endPosition": { "x": 50, "y": 50 },
  "color": "#FFFF00",
  "strokeWidth": 2,
  "opacity": 1,
  "headSize": 10,
  "direction": "down"
}
\`\`\`
startPosition and endPosition must be different. direction = where arrowhead points.

## TextOverlay schema
\`\`\`json
{
  "id": "txt-<unique>",
  "text": "Onion-skin pattern",
  "position": { "x": 50, "y": 88 },
  "fontSize": 1.6,
  "fontWeight": "bold",
  "color": "#FFFFFF",
  "maxWidth": 70,
  "textAlign": "center",
  "animation": "fade",
  "computedOpacity": 1
}
\`\`\`
`;

export function buildUserPrompt(
  images: ImageInput[],
  captions: CaptionChunk[],
  audioDuration: number,
  audioUrl: string,
  visionResults?: VisionResult[],
  preComputedTimings?: ReturnType<typeof computeSegmentTimings>
): string {
  // Use pre-computed timings if provided (from AI segmenter), otherwise compute from keywords
  const timings = preComputedTimings ?? computeSegmentTimings(images, captions, audioDuration);

  // Pre-compute camera keyframes from vision data
  const cameraKeyframes = computeAllCameraKeyframes(images, visionResults ?? []);

  const imageList = images
    .map((img, i) => {
      const t = timings[i];
      const dur = t.endTime - t.startTime;
      const vision = visionResults?.[i];
      const camera = cameraKeyframes[i];
      const isMicroOrGross = img.category === "microscopic" || img.category === "gross";

      // Label: use vision suggestion if available, else derive from title
      const label =
        vision?.suggestedLabel ||
        img.title.split(/[-–,]/)[0].trim().slice(0, 40) ||
        img.description.split(/[-–,]/)[0].trim().slice(0, 40);

      // Annotation description (pre-computed tool + position)
      const annotationLine =
        isMicroOrGross && vision
          ? describeAnnotationForPrompt(vision.annotationTool, vision.featurePosition, label)
          : `  Annotation: none — ${img.category === "figure" || img.category === "table" ? "figure/table, model discretion" : "no vision data"}`;

      // Camera keyframes (pre-computed)
      const cameraLine = formatCameraKeyframesForPrompt(camera, dur);

      // Relevant captions for this segment (for context — model does not set timing)
      const segCaptions = captions
        .filter((c) => c.end > t.startTime && c.start < t.endTime)
        .map((c) => `    [${c.start.toFixed(2)}s→${c.end.toFixed(2)}s] "${c.text}"`)
        .join("\n");

      return `seg-${i}  [${t.startTime.toFixed(2)}s → ${t.endTime.toFixed(2)}s]  (${dur.toFixed(2)}s)  ${img.category || "unknown"}
  URL: ${img.url}
  Label: "${label}"
${annotationLine}
${cameraLine}
  Text overlay: ${isMicroOrGross ? `REQUIRED — "${label}" at x=50, y=88, fade in at t=0.8s, fade out at t=${(dur - 0.5).toFixed(2)}s` : "optional"}
  Relevant captions:
${segCaptions || "    (none in this window)"}`;
    })
    .join("\n\n");

  return `## Segments (${images.length} total — produce EXACTLY ${images.length} segments)

Timing is PRE-COMPUTED and FIXED. Do NOT adjust startTime/endTime values.
Camera keyframes are PRE-COMPUTED. Copy them exactly into the keyframes array.
Your job: assemble the JSON, set annotation overlays at the given positions, add text overlay fade timing, and handle figure/table animation freely.

${imageList}

## All captions (pass through UNCHANGED as objects)

${captions.map((c) => `  { "text": "${c.text.replace(/"/g, '\\"')}", "start": ${c.start}, "end": ${c.end} }`).join("\n")}

## Task
audioUrl: ${audioUrl}
Total duration (exact): ${audioDuration.toFixed(4)}s

Rules:
- CRITICAL: keyframe "time" values are RELATIVE to their segment start (0 → segmentDuration). Never use absolute timestamps.
- startTime/endTime on segments are absolute seconds — copy them from above EXACTLY.
- Captions: pass through all ${captions.length} chunks unchanged as objects { "text", "start", "end" }.
- For each segment: use the pre-computed camera keyframes as-is. Do not invent different pan/zoom values.
- For microscopic/gross: add the specified annotation overlay AND the text overlay with fade timing.
- For figure/table: animate freely (pan, zoom, arrows, rectangles) based on the caption context.
- Output ONLY the JSON object, nothing else.`;
}
