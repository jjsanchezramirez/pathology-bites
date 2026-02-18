import type { VisionResult, AnnotationTool } from "./vision";
import type { ImageInput } from "./prompt";

// ---------------------------------------------------------------------------
// Camera keyframe pre-computation
//
// Given a vision result for a single image, returns concrete keyframe anchor
// values (scale, camera x/y, zoom-in time, hold time) that the assembly
// model can copy directly into the JSON without doing geometry itself.
//
// Coordinate conventions (matching the ExplainerPlayer):
//   - Camera x/y: pan offset as % of viewport from centre, range −50 to +50
//   - x=0, y=0, scale=1.0 = no pan, full image visible
//   - scale >= 1.0 always; max 1.6
//   - Safe pan range at a given scale: max_pan = (scale − 1) / scale × 50
// ---------------------------------------------------------------------------

export interface CameraAnchor {
  /** Zoom scale (1.0 = no zoom) */
  scale: number;
  /** Camera pan X offset (% of viewport, 0 = centre) */
  x: number;
  /** Camera pan Y offset (% of viewport, 0 = centre) */
  y: number;
}

export interface CameraKeyframes {
  /**
   * Whether this image has a specific area of interest to zoom into.
   * false = use gentle Ken Burns drift (no target).
   */
  hasTarget: boolean;

  /** Full-image starting anchor (scale=1, x=0, y=0) */
  wide: CameraAnchor;

  /**
   * Zoomed-in anchor centred on the feature.
   * Equals wide when hasTarget=false (use Ken Burns drift instead).
   */
  zoomed: CameraAnchor;

  /**
   * How many seconds into the segment to start the zoom-in animation.
   * 0 if no zoom (Ken Burns drift starts immediately).
   */
  zoomInStartTime: number;

  /**
   * How many seconds before segment end to begin the zoom-out animation.
   * 0 if no zoom.
   */
  zoomOutDuration: number;

  /**
   * For Ken Burns (no target): suggested gentle drift endpoint.
   * Null when hasTarget=true.
   */
  kenBurnsDrift: CameraAnchor | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ZOOM_SCALE = 1.3; // Standard zoom-in scale
const ZOOM_IN_HOLD = 1.5; // Hold wide before zooming in (seconds)
const ZOOM_OUT_DURATION = 1.0; // Zoom back out at segment end (seconds)
const KEN_BURNS_SCALE = 1.1; // Gentle drift scale
const KEN_BURNS_MAX_PAN = 4; // Max pan at scale=1.1 (safe: (1.1−1)/1.1*50 ≈ 4.5)

/**
 * Compute max safe pan offset for a given scale.
 * Formula: (scale - 1) / scale * 50
 */
export function maxSafePan(scale: number): number {
  return ((scale - 1) / scale) * 50;
}

/**
 * Clamp a value to [-limit, +limit].
 */
export function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

/**
 * Convert a viewport feature position (0–100, where 50=centre) to a camera
 * pan offset at the given zoom scale.
 *
 * Logic: when zoomed in at `scale`, panning by `p` shifts the image by
 * p * scale / 50 viewport widths. To centre feature at position `fx`:
 *   pan = (fx - 50) * (scale - 1) / scale * 2
 *
 * The result is clamped to the safe pan range so borders never appear.
 */
export function featureToCameraPan(featurePos: number, scale: number): number {
  const raw = ((featurePos - 50) * (scale - 1)) / scale;
  return clamp(raw, maxSafePan(scale));
}

// ---------------------------------------------------------------------------
// Ken Burns drift generator
// ---------------------------------------------------------------------------

// 8 gentle drift directions — varied to avoid repetition across segments
const DRIFT_PRESETS: CameraAnchor[] = [
  { scale: KEN_BURNS_SCALE, x: -KEN_BURNS_MAX_PAN, y: -KEN_BURNS_MAX_PAN }, // ↖
  { scale: KEN_BURNS_SCALE, x: KEN_BURNS_MAX_PAN, y: -KEN_BURNS_MAX_PAN }, //  ↗
  { scale: KEN_BURNS_SCALE, x: KEN_BURNS_MAX_PAN, y: KEN_BURNS_MAX_PAN }, //   ↘
  { scale: KEN_BURNS_SCALE, x: -KEN_BURNS_MAX_PAN, y: KEN_BURNS_MAX_PAN }, //  ↙
  { scale: KEN_BURNS_SCALE, x: 0, y: -KEN_BURNS_MAX_PAN }, //                  ↑
  { scale: KEN_BURNS_SCALE, x: 0, y: KEN_BURNS_MAX_PAN }, //                   ↓
  { scale: KEN_BURNS_SCALE, x: -KEN_BURNS_MAX_PAN, y: 0 }, //                  ←
  { scale: KEN_BURNS_SCALE, x: KEN_BURNS_MAX_PAN, y: 0 }, //                   →
];

/**
 * Pick a Ken Burns drift endpoint for segment index `segmentIndex`.
 * Uses the index to cycle through presets deterministically.
 */
export function kenBurnsDriftFor(segmentIndex: number): CameraAnchor {
  return DRIFT_PRESETS[segmentIndex % DRIFT_PRESETS.length];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Pre-compute concrete camera keyframe values for one image segment.
 *
 * @param image         The image (used for category check)
 * @param vision        Vision result for this image (may be undefined)
 * @param segmentIndex  Position of this segment (0-based), used for Ken Burns cycling
 * @returns             Concrete keyframe anchors ready to embed in the prompt
 */
export function computeCameraKeyframes(
  image: ImageInput,
  vision: VisionResult | undefined,
  segmentIndex: number
): CameraKeyframes {
  const wide: CameraAnchor = { scale: 1.0, x: 0, y: 0 };

  // Figures and tables: no zoom animation (model handles these freely)
  const category = image.category?.toLowerCase() ?? "";
  if (category === "figure" || category === "table") {
    return {
      hasTarget: false,
      wide,
      zoomed: wide,
      zoomInStartTime: 0,
      zoomOutDuration: 0,
      kenBurnsDrift: null,
    };
  }

  // No vision result, or model couldn't see the image, or tool is none with no position
  const hasUsableTarget =
    vision?.canSeeImage && vision.featurePosition !== null && vision.annotationTool !== "none";

  if (!hasUsableTarget || !vision?.featurePosition) {
    // Ken Burns drift — gentle pan across the image
    return {
      hasTarget: false,
      wide,
      zoomed: wide,
      zoomInStartTime: 0,
      zoomOutDuration: 0,
      kenBurnsDrift: kenBurnsDriftFor(segmentIndex),
    };
  }

  // Compute zoomed-in anchor centred on the feature
  const camX = featureToCameraPan(vision.featurePosition.x, ZOOM_SCALE);
  const camY = featureToCameraPan(vision.featurePosition.y, ZOOM_SCALE);
  const zoomed: CameraAnchor = {
    scale: ZOOM_SCALE,
    x: Math.round(camX * 100) / 100,
    y: Math.round(camY * 100) / 100,
  };

  return {
    hasTarget: true,
    wide,
    zoomed,
    zoomInStartTime: ZOOM_IN_HOLD,
    zoomOutDuration: ZOOM_OUT_DURATION,
    kenBurnsDrift: null,
  };
}

/**
 * Describe camera keyframes as a concise string block for the assembly prompt.
 * The model is told to copy these values directly — no geometry required.
 */
export function formatCameraKeyframesForPrompt(
  kf: CameraKeyframes,
  segmentDuration: number
): string {
  if (!kf.hasTarget && kf.kenBurnsDrift) {
    // Ken Burns: drift from centre to drift endpoint over the whole segment
    const d = kf.kenBurnsDrift;
    return (
      `  Camera keyframes (Ken Burns drift — copy exactly):\n` +
      `    t=0:              scale=${kf.wide.scale.toFixed(1)}, x=${kf.wide.x}, y=${kf.wide.y}\n` +
      `    t=${segmentDuration.toFixed(2)}: scale=${d.scale.toFixed(1)}, x=${d.x}, y=${d.y}`
    );
  }

  if (kf.hasTarget) {
    const holdStart = kf.zoomInStartTime;
    const holdEnd = Math.max(holdStart + 0.5, segmentDuration - kf.zoomOutDuration);
    const w = kf.wide;
    const z = kf.zoomed;
    return (
      `  Camera keyframes (zoom to feature — copy exactly):\n` +
      `    t=0:                    scale=${w.scale.toFixed(1)}, x=${w.x}, y=${w.y}  (full image)\n` +
      `    t=${holdStart.toFixed(2)}:               scale=${w.scale.toFixed(1)}, x=${w.x}, y=${w.y}  (hold wide)\n` +
      `    t=${(holdStart + 2).toFixed(2)}:               scale=${z.scale.toFixed(1)}, x=${z.x}, y=${z.y}  (zoom in)\n` +
      `    t=${holdEnd.toFixed(2)}: scale=${z.scale.toFixed(1)}, x=${z.x}, y=${z.y}  (hold on feature)\n` +
      `    t=${segmentDuration.toFixed(2)}: scale=${w.scale.toFixed(1)}, x=${w.x}, y=${w.y}  (zoom out)`
    );
  }

  // Figure/table — no camera instruction, model decides
  return `  Camera: model discretion (figure/table)`;
}

// ---------------------------------------------------------------------------
// Batch helper
// ---------------------------------------------------------------------------

export function computeAllCameraKeyframes(
  images: ImageInput[],
  visionResults: VisionResult[]
): CameraKeyframes[] {
  return images.map((img, i) => computeCameraKeyframes(img, visionResults[i], i));
}

// ---------------------------------------------------------------------------
// Annotation tool → recommended overlay description for prompt
// ---------------------------------------------------------------------------

export function describeAnnotationForPrompt(
  tool: AnnotationTool,
  position: { x: number; y: number } | null,
  label: string
): string {
  if (tool === "none" || !position) {
    return `  Annotation: none — text overlay only`;
  }
  const pos = `x=${position.x.toFixed(0)}, y=${position.y.toFixed(0)}`;
  switch (tool) {
    case "spotlight":
      return `  Annotation: spotlight at ${pos}, w=40, h=40 — label: "${label}"`;
    case "circle":
      return `  Annotation: circle highlight at ${pos}, w=25, h=25, borderColor="#FFFF00" — label: "${label}"`;
    case "ellipse":
      return `  Annotation: ellipse highlight at ${pos}, w=30, h=20, borderColor="#FFFF00" — label: "${label}"`;
    case "arrow":
      return `  Annotation: arrow pointing to ${pos}, color="#FFFF00" — label: "${label}"`;
    case "rectangle":
      return `  Annotation: rectangle highlight at ${pos}, w=35, h=20, borderColor="#FFFF00" — label: "${label}"`;
  }
}
