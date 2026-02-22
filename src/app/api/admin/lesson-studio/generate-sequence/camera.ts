import type { VisionResult } from "./vision";
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
//   - x=0, y=0, scale=1.0 = no pan, full image visible (may show letterboxing)
//   - Initial scale uses calculateCoverZoom to fill viewport (no black spaces)
//   - scale range: 0.5x–2.0x (clamped); zoom-in target max 1.6x
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

  /** Full-image starting anchor (zoom-to-fit to cover viewport, x=0, y=0) */
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
function maxSafePan(scale: number): number {
  return ((scale - 1) / scale) * 50;
}

/**
 * Clamp a value to [-limit, +limit].
 */
function clamp(value: number, limit: number): number {
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
function featureToCameraPan(featurePos: number, scale: number): number {
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
function kenBurnsDriftFor(segmentIndex: number): CameraAnchor {
  return DRIFT_PRESETS[segmentIndex % DRIFT_PRESETS.length];
}

// ---------------------------------------------------------------------------
// Zoom calculation
// ---------------------------------------------------------------------------

/**
 * Calculate zoom to cover the viewport (16:9 aspect ratio) with no black spaces.
 * Returns a scale value where:
 * - scale > 1 means we see LESS of the image (zoomed in)
 * - scale < 1 means we see MORE of the image (zoomed out)
 * - scale = 1 means no zoom (100%)
 *
 * The calculation ensures the image covers (fills) the 16:9 viewport
 * without any letterboxing or pillarboxing (no black spaces).
 */
function calculateCoverZoom(imageWidth: number, imageHeight: number): number {
  const viewportAspectRatio = 16 / 9; // 1.777...
  const imageAspectRatio = imageWidth / imageHeight;

  // Calculate zoom needed to make the image cover (fill) the viewport
  let zoom: number;
  if (imageAspectRatio > viewportAspectRatio) {
    // Image is wider than viewport (e.g., 21:9 vs 16:9)
    // Need to fit by height → zoom IN to crop the sides
    zoom = imageAspectRatio / viewportAspectRatio;
  } else {
    // Image is taller than viewport (e.g., 4:3 vs 16:9)
    // Need to fit by width → zoom IN to crop top/bottom
    zoom = viewportAspectRatio / imageAspectRatio;
  }

  // Clamp between 0.5x and 2x, then round UP to 2 decimal places
  const clamped = Math.max(0.5, Math.min(zoom, 2));
  return Math.ceil(clamped * 100) / 100;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Determine if an image should use Ken Burns drift or zoom-to-feature animation.
 *
 * Decision rules (evaluated in order):
 * 1. Figures/tables → neither (model controls camera)
 * 2. No vision data OR model couldn't see image → Ken Burns
 * 3. annotationTool === "none" → Ken Burns (overview image, no specific feature)
 * 4. annotationTool !== "none" BUT no position → Ken Burns (safety fallback)
 * 5. annotationTool !== "none" AND has position → zoom-to-feature
 *
 * @returns true if should use Ken Burns, false if should zoom to feature
 */
function shouldUseKenBurns(image: ImageInput, vision: VisionResult | undefined): boolean {
  const category = image.category?.toLowerCase() ?? "";

  // Rule 1: Figures/tables handled separately (no animation)
  if (category === "figure" || category === "table") {
    return false; // Neither Ken Burns nor zoom — static
  }

  // Rule 2: No vision data or model couldn't see the image
  if (!vision || !vision.canSeeImage) {
    return true;
  }

  // Rule 3: Explicit "none" tool means overview image (no annotation needed)
  if (vision.annotationTool === "none") {
    return true;
  }

  // Rule 4: Tool requires annotation but position is missing (safety fallback)
  if (!vision.featurePosition) {
    return true;
  }

  // Rule 5: Has annotation tool AND position → zoom to feature
  return false;
}

/**
 * Pre-compute concrete camera keyframe values for one image segment.
 *
 * @param image         The image (used for category check and dimensions)
 * @param vision        Vision result for this image (may be undefined)
 * @param segmentIndex  Position of this segment (0-based), used for Ken Burns cycling
 * @returns             Concrete keyframe anchors ready to embed in the prompt
 */
function computeCameraKeyframes(
  image: ImageInput,
  vision: VisionResult | undefined,
  segmentIndex: number
): CameraKeyframes {
  // Calculate initial zoom to fill viewport with no black spaces
  const initialZoom = calculateCoverZoom(image.width, image.height);
  const wide: CameraAnchor = { scale: initialZoom, x: 0, y: 0 };
  const category = image.category?.toLowerCase() ?? "";

  // Figures and tables: no animation (model handles camera freely)
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

  // Use centralized decision logic
  const useKenBurns = shouldUseKenBurns(image, vision);

  if (useKenBurns) {
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

  // Zoom-to-feature: compute camera position centered on annotation
  // (We know vision.featurePosition exists due to shouldUseKenBurns logic)
  const camX = featureToCameraPan(vision!.featurePosition!.x, ZOOM_SCALE);
  const camY = featureToCameraPan(vision!.featurePosition!.y, ZOOM_SCALE);
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

// ---------------------------------------------------------------------------
// Batch helper
// ---------------------------------------------------------------------------

export function computeAllCameraKeyframes(
  images: ImageInput[],
  visionResults: VisionResult[]
): CameraKeyframes[] {
  return images.map((img, i) => computeCameraKeyframes(img, visionResults[i], i));
}
