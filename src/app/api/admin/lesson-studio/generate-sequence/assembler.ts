import type {
  ExplainerSequence,
  Segment,
  Keyframe,
  HighlightRegion,
  ArrowPointer,
  TextOverlay,
  CaptionChunk,
} from "@/shared/types/explainer";
import type { ImageInput } from "./prompt";
import type { VisionResult } from "./vision";
import type { CameraKeyframes } from "./camera";
import type { SegmentTiming } from "./timing";

// ---------------------------------------------------------------------------
// Deterministic sequence assembler
//
// Builds a valid ExplainerSequence from pre-computed data without any AI call.
// Used as a fallback when the assembly model fails or times out.
//
// What this produces:
//   - One segment per image with correct startTime/endTime from segmentTimings
//   - Camera keyframes copied directly from CameraKeyframes
//   - Annotation overlay (highlight or arrow) from VisionResult tool + position
//   - Text overlay with fade timing for microscopic/gross images
//   - Captions passed through unchanged
//   - Figures/tables: gentle Ken Burns at scale=1.1
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Rounding utilities
// ---------------------------------------------------------------------------

/**
 * Round segment-level timing to whole seconds for clean timeline boundaries.
 * Used for: segment startTime/endTime, transitionDuration
 */
function roundSegmentTiming(value: number): number {
  return Math.round(value);
}

/**
 * Round fine-grained timing to 0.01s (centiseconds) for smooth animations.
 * Used for: keyframe times, animation timings, text fade timings
 */
function roundFineTiming(value: number): number {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// Overlay builders
// ---------------------------------------------------------------------------

function buildHighlight(
  id: string,
  tool: "spotlight" | "circle" | "ellipse" | "rectangle",
  position: { x: number; y: number }
): HighlightRegion {
  const base = {
    id,
    position,
    borderWidth: 2,
    borderStyle: "solid" as const,
    fillColor: "transparent",
    opacity: 1,
  };

  switch (tool) {
    case "spotlight":
      return {
        ...base,
        type: "circle",
        size: { width: 40, height: 40 },
        borderColor: "#FFFFFF",
        spotlight: true,
      };
    case "circle":
      return {
        ...base,
        type: "circle",
        size: { width: 25, height: 25 },
        borderColor: "#FFFF00",
        spotlight: false,
      };
    case "ellipse":
      return {
        ...base,
        type: "oval",
        size: { width: 30, height: 20 },
        borderColor: "#FFFF00",
        spotlight: false,
      };
    case "rectangle":
      return {
        ...base,
        type: "rectangle",
        size: { width: 35, height: 20 },
        borderColor: "#FFFF00",
        spotlight: false,
      };
  }
}

function buildArrow(id: string, position: { x: number; y: number }): ArrowPointer {
  // Place tail ~15% away from target, preferring to come from top-right
  const offsetX = position.x > 50 ? -15 : 15;
  const offsetY = position.y > 50 ? -15 : 15;
  const startX = Math.max(5, Math.min(95, position.x + offsetX));
  const startY = Math.max(5, Math.min(95, position.y + offsetY));

  const dx = position.x - startX;
  const dy = position.y - startY;
  let direction: ArrowPointer["direction"] = "down";
  if (Math.abs(dx) > Math.abs(dy)) {
    direction = dx > 0 ? "right" : "left";
  } else {
    direction = dy > 0 ? "down" : "up";
  }

  return {
    id,
    startPosition: { x: startX, y: startY },
    endPosition: position,
    color: "#FFFF00",
    strokeWidth: 2,
    opacity: 1,
    headSize: 10,
    direction,
  };
}

function buildTextOverlay(id: string, label: string): TextOverlay {
  return {
    id,
    text: label,
    position: { x: 50, y: 88 },
    fontSize: 1.6,
    fontWeight: "bold",
    color: "#FFFFFF",
    maxWidth: 70,
    textAlign: "center",
    animation: "fade",
    computedOpacity: 1,
  };
}

// ---------------------------------------------------------------------------
// Text overlay timing calculation
// ---------------------------------------------------------------------------

/**
 * Calculate text overlay timing values for TimeBasedText.
 *
 * Strategy:
 * - Fade in early (10% of duration, max 0.8s)
 * - Guarantee minimum 1.5s at full opacity
 * - Fade transitions take 0.5s each
 *
 * Returns timing values that match the TimeBasedText interface:
 * - start: when fade-in begins
 * - duration: time at full opacity (excludes fade time)
 * - fadeTime: duration of fade-in/fade-out transitions
 */
function calculateTextTiming(
  segmentDuration: number
): { start: number; duration: number; fadeTime: number } {
  const fadeTime = 0.5; // Fixed fade transition duration
  const start = roundFineTiming(Math.min(0.8, segmentDuration * 0.1));

  // Text should be visible for at least 1.5s at full opacity
  const minFullOpacityDuration = 1.5;

  // Calculate when fade-out should start to end 0.5s before segment ends
  const idealFadeOutStart = roundFineTiming(segmentDuration - fadeTime - 0.5);

  // Ensure minimum display time
  const earliestFadeOutStart = roundFineTiming(start + fadeTime + minFullOpacityDuration);

  // Use the later of the two
  const fadeOutStart = Math.max(earliestFadeOutStart, idealFadeOutStart);

  // Duration is the time between end of fade-in and start of fade-out
  const duration = roundFineTiming(fadeOutStart - start - fadeTime);

  return { start, duration, fadeTime };
}

// ---------------------------------------------------------------------------
// Keyframe builder for one segment
// ---------------------------------------------------------------------------

function buildKeyframes(
  camera: CameraKeyframes,
  duration: number,
  vision: VisionResult | undefined,
  isMicroOrGross: boolean,
  label: string,
  segIdx: number
): Keyframe[] {
  const empty = {
    highlights: [] as HighlightRegion[],
    arrows: [] as ArrowPointer[],
    textOverlays: [] as TextOverlay[],
  };

  const hlId = `hl-${segIdx}`;
  const arrowId = `arrow-${segIdx}`;
  const txtId = `txt-${segIdx}`;

  // Build annotation overlays (only when camera has a target to zoom to)
  // Trust camera.hasTarget — it already evaluated all Ken Burns rules
  let annotationHighlights: HighlightRegion[] = [];
  let annotationArrows: ArrowPointer[] = [];
  if (isMicroOrGross && camera.hasTarget && vision?.featurePosition && vision.annotationTool !== "none") {
    const pos = vision.featurePosition;
    if (vision.annotationTool === "arrow") {
      annotationArrows = [buildArrow(arrowId, pos)];
    } else {
      annotationHighlights = [
        buildHighlight(
          hlId,
          vision.annotationTool as "spotlight" | "circle" | "ellipse" | "rectangle",
          pos
        ),
      ];
    }
  }

  const textOverlay = isMicroOrGross && label ? buildTextOverlay(txtId, label) : null;
  const textTiming = calculateTextTiming(duration);

  // Calculate critical text timing points
  const fadeInComplete = roundFineTiming(textTiming.start + textTiming.fadeTime);
  const fadeOutStart = roundFineTiming(fadeInComplete + textTiming.duration);
  const fadeOutComplete = roundFineTiming(fadeOutStart + textTiming.fadeTime);

  // Helper: generates the 3 essential text keyframes for any camera path
  // This ensures consistent timing recovery regardless of camera movement
  const buildTextKeyframes = (transform: { x: number; y: number; scale: number }) => {
    if (!textOverlay) return [];
    return [
      {
        time: fadeInComplete,
        transform,
        highlights: [],
        arrows: [],
        textOverlays: [{ ...textOverlay, computedOpacity: 1 }],
      },
      {
        time: fadeOutStart,
        transform,
        highlights: [],
        arrows: [],
        textOverlays: [{ ...textOverlay, computedOpacity: 1 }],
      },
      {
        time: fadeOutComplete,
        transform,
        highlights: [],
        arrows: [],
        textOverlays: [{ ...textOverlay, computedOpacity: 0 }],
      },
    ];
  };

  // --- Zoom-in path ---
  if (camera.hasTarget) {
    const holdStart = roundFineTiming(camera.zoomInStartTime);
    const zoomArrival = roundFineTiming(holdStart + 2.0);
    const holdEnd = roundFineTiming(Math.max(zoomArrival + 0.5, duration - camera.zoomOutDuration));
    const w = camera.wide;
    const z = camera.zoomed;

    const kfs: Keyframe[] = [
      { time: 0, transform: { x: w.x, y: w.y, scale: w.scale }, ...empty },
      {
        time: holdStart,
        transform: { x: w.x, y: w.y, scale: w.scale },
        highlights: [],
        arrows: [],
        textOverlays: [],
      },
      {
        time: zoomArrival,
        transform: { x: z.x, y: z.y, scale: z.scale },
        highlights: annotationHighlights,
        arrows: annotationArrows,
        textOverlays: [],
      },
      {
        time: holdEnd,
        transform: { x: z.x, y: z.y, scale: z.scale },
        highlights: annotationHighlights,
        arrows: annotationArrows,
        textOverlays: [],
      },
    ];

    // Add text keyframes using consistent 3-keyframe structure
    kfs.push(...buildTextKeyframes(z));

    kfs.push({ time: duration, transform: { x: w.x, y: w.y, scale: w.scale }, ...empty });
    return kfs;
  }

  // --- Ken Burns path ---
  if (camera.kenBurnsDrift) {
    const d = camera.kenBurnsDrift;
    const w = camera.wide;

    const kfs: Keyframe[] = [{ time: 0, transform: { x: w.x, y: w.y, scale: w.scale }, ...empty }];

    // Add text keyframes using consistent 3-keyframe structure
    // Note: Ken Burns drifts, so we use the end position for text
    kfs.push(...buildTextKeyframes(d));

    kfs.push({ time: duration, transform: { x: d.x, y: d.y, scale: d.scale }, ...empty });
    return kfs;
  }

  // --- Figure/table or no camera data — static wide shot ---
  const w = camera.wide;
  const kfs: Keyframe[] = [{ time: 0, transform: { x: w.x, y: w.y, scale: w.scale }, ...empty }];

  // Add text keyframes using consistent 3-keyframe structure
  kfs.push(...buildTextKeyframes(w));

  kfs.push({ time: duration, transform: { x: w.x, y: w.y, scale: w.scale }, ...empty });
  return kfs;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a complete ExplainerSequence from pre-computed data without any AI call.
 * Used as fallback when the assembly model fails or times out.
 */
export function assembleSequenceDeterministically(
  images: ImageInput[],
  captions: CaptionChunk[],
  audioDuration: number,
  audioUrl: string,
  visionResults: VisionResult[],
  segmentTimings: SegmentTiming[],
  cameraKeyframes: CameraKeyframes[]
): ExplainerSequence {
  const segments: Segment[] = images.map((img, i) => {
    const timing = segmentTimings[i];
    const vision = visionResults[i];
    const camera = cameraKeyframes[i];
    const duration = timing.endTime - timing.startTime;
    const isMicroOrGross = img.category === "microscopic" || img.category === "gross";

    const label =
      vision?.suggestedLabel ||
      img.title.split(/[-–,]/)[0].trim().slice(0, 40) ||
      img.description.split(/[-–,]/)[0].trim().slice(0, 40);

    const keyframes = buildKeyframes(camera, duration, vision, isMicroOrGross, label, i);

    return {
      id: `seg-${i}`,
      imageUrl: img.url,
      imageAlt: img.title || img.description,
      startTime: roundSegmentTiming(timing.startTime),
      endTime: roundSegmentTiming(timing.endTime),
      transition: "crossfade",
      transitionDuration: roundSegmentTiming(1),
      keyframes,
    };
  });

  return {
    version: 1,
    duration: audioDuration,
    aspectRatio: "16:9",
    audioUrl,
    captions,
    segments,
  };
}
