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

  // Build annotation overlays
  let annotationHighlights: HighlightRegion[] = [];
  let annotationArrows: ArrowPointer[] = [];
  if (isMicroOrGross && vision?.featurePosition && vision.annotationTool !== "none") {
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
  const fadeIn = Math.min(0.8, duration * 0.1);
  const fadeOut = Math.max(fadeIn + 0.5, duration - 0.5);

  // --- Zoom-in path ---
  if (camera.hasTarget) {
    const holdStart = camera.zoomInStartTime;
    const zoomArrival = holdStart + 2.0;
    const holdEnd = Math.max(zoomArrival + 0.5, duration - camera.zoomOutDuration);
    const w = camera.wide;
    const z = camera.zoomed;

    const kfs: Keyframe[] = [
      { time: 0, transform: { x: w.x, y: w.y, scale: w.scale }, ...empty },
      {
        time: fadeIn,
        transform: { x: w.x, y: w.y, scale: w.scale },
        highlights: [],
        arrows: [],
        textOverlays: textOverlay ? [{ ...textOverlay, computedOpacity: 1 }] : [],
      },
      {
        time: holdStart,
        transform: { x: w.x, y: w.y, scale: w.scale },
        highlights: [],
        arrows: [],
        textOverlays: textOverlay ? [{ ...textOverlay, computedOpacity: 1 }] : [],
      },
      {
        time: zoomArrival,
        transform: { x: z.x, y: z.y, scale: z.scale },
        highlights: annotationHighlights,
        arrows: annotationArrows,
        textOverlays: textOverlay ? [{ ...textOverlay, computedOpacity: 1 }] : [],
      },
      {
        time: holdEnd,
        transform: { x: z.x, y: z.y, scale: z.scale },
        highlights: annotationHighlights,
        arrows: annotationArrows,
        textOverlays: textOverlay ? [{ ...textOverlay, computedOpacity: 1 }] : [],
      },
    ];

    if (textOverlay && fadeOut < duration) {
      kfs.push({
        time: fadeOut,
        transform: { x: w.x, y: w.y, scale: w.scale },
        highlights: [],
        arrows: [],
        textOverlays: [{ ...textOverlay, computedOpacity: 0 }],
      });
    }

    kfs.push({ time: duration, transform: { x: w.x, y: w.y, scale: w.scale }, ...empty });
    return kfs;
  }

  // --- Ken Burns path ---
  if (camera.kenBurnsDrift) {
    const d = camera.kenBurnsDrift;
    const w = camera.wide;

    const kfs: Keyframe[] = [
      { time: 0, transform: { x: w.x, y: w.y, scale: w.scale }, ...empty },
    ];

    if (textOverlay) {
      kfs.push({
        time: fadeIn,
        transform: { x: w.x, y: w.y, scale: w.scale },
        highlights: [],
        arrows: [],
        textOverlays: [{ ...textOverlay, computedOpacity: 1 }],
      });

      if (fadeOut < duration) {
        kfs.push({
          time: fadeOut,
          transform: { x: d.x, y: d.y, scale: d.scale },
          highlights: [],
          arrows: [],
          textOverlays: [{ ...textOverlay, computedOpacity: 0 }],
        });
      }
    }

    kfs.push({ time: duration, transform: { x: d.x, y: d.y, scale: d.scale }, ...empty });
    return kfs;
  }

  // --- Figure/table or no camera data — static wide shot ---
  const w = camera.wide;
  const kfs: Keyframe[] = [
    { time: 0, transform: { x: w.x, y: w.y, scale: w.scale }, ...empty },
  ];

  if (textOverlay) {
    kfs.push({
      time: fadeIn,
      transform: { x: w.x, y: w.y, scale: w.scale },
      highlights: [],
      arrows: [],
      textOverlays: [{ ...textOverlay, computedOpacity: 1 }],
    });
    if (fadeOut < duration) {
      kfs.push({
        time: fadeOut,
        transform: { x: w.x, y: w.y, scale: w.scale },
        highlights: [],
        arrows: [],
        textOverlays: [{ ...textOverlay, computedOpacity: 0 }],
      });
    }
  }

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
      startTime: timing.startTime,
      endTime: timing.endTime,
      transition: "crossfade",
      transitionDuration: 1,
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
