// Pass 5: Deterministic assembly.
// Builds a valid Lesson from the lesson plan + vision results.
// All decisions here are deterministic — no AI calls.
//
// What this handles (that the planner used to):
//   - Duration per image: proportional to transcript segment word count
//   - Annotations: from vision tool + position, sized by objectSize
//   - Camera: from camera.ts (proven, unchanged)
//   - Text labels: from vision suggestedLabel

import type {
  Lesson,
  Slide,
  SlideElement,
  ShapeElement,
  SpotlightElement,
  ArrowElement,
  TextElement,
  SvgElement,
  CameraElement,
  Timing,
} from "@/app/(admin)/admin/lesson-studio/model/types";
import { coverZoom } from "@/app/(admin)/admin/lesson-studio/model/slide-factory";
import type { ImageInput } from "../generate-sequence/prompt";
import type { VisionResult, AnnotationTool } from "../generate-sequence/vision";
import { computeCameraKeyframes, type CameraKeyframes } from "../generate-sequence/camera";
import type { SvgInput, LessonPlan, PlannedTextSlide, TranscriptAnalysis } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** @internal exported for testing */
export const TITLE_DURATION = 3;
const MIN_IMAGE_DURATION = 5;
const ZOOM_ANIMATION_DURATION = 2.0; // shared with camera.ts ZOOM_IN_HOLD timing

const BRAND_TEAL = "#14B8A6";
const BRAND_DARK_TEAL = "#0F766E";
const BRAND_BG = "#f0f9f8";
const MASCOT_SVG_URL =
  "https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/svg/20260418024420-dr-albright.svg";

// Annotation sizes by objectSize (width, height in % of canvas)
/** @internal exported for testing */
export const ANNOTATION_SIZES: Record<string, { w: number; h: number }> = {
  large: { w: 40, h: 40 },
  medium: { w: 28, h: 28 },
  small: { w: 18, h: 18 },
  default: { w: 25, h: 25 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function fullTiming(duration: number): Timing {
  return { start: 0, fadeIn: 0, hold: duration, fadeOut: 0 };
}

// ---------------------------------------------------------------------------
// Duration computation (deterministic from word counts)
// ---------------------------------------------------------------------------

/** @internal exported for testing */
export function computeImageDurations(
  segments: TranscriptAnalysis["segments"],
  imageOrder: number[],
  audioDuration: number,
  textSlideTotalDuration: number
): number[] {
  const availableDuration = audioDuration - TITLE_DURATION - textSlideTotalDuration;
  const totalWords = segments.reduce((sum, s) => sum + s.wordCount, 0) || 1;

  // Each image gets duration proportional to its segment's word count
  const rawDurations = imageOrder.map((imgIdx) => {
    const segment = segments[imgIdx] ?? segments[0];
    return Math.max(MIN_IMAGE_DURATION, (segment.wordCount / totalWords) * availableDuration);
  });

  // Scale to exactly fill available duration
  const rawTotal = rawDurations.reduce((a, b) => a + b, 0);
  const scale = availableDuration / (rawTotal || 1);
  const scaled = rawDurations.map((d) => Math.max(MIN_IMAGE_DURATION, Math.round(d * scale)));

  // Adjust last slide to absorb rounding error
  const scaledTotal = scaled.reduce((a, b) => a + b, 0);
  scaled[scaled.length - 1] += Math.round(availableDuration) - scaledTotal;

  return scaled;
}

// ---------------------------------------------------------------------------
// Annotation builder (from vision, not planner)
// ---------------------------------------------------------------------------

/** @internal exported for testing */
export function buildAnnotation(vision: VisionResult, timing: Timing): SlideElement | null {
  if (!vision.canSeeImage || !vision.featurePosition || vision.annotationTool === "none") {
    return null;
  }

  const pos = vision.featurePosition;
  const sizeKey = vision.objectSize ?? "default";
  const size = ANNOTATION_SIZES[sizeKey] ?? ANNOTATION_SIZES.default;

  const tool: AnnotationTool = vision.annotationTool;

  if (tool === "spotlight") {
    return {
      id: uid("spot"),
      kind: "spotlight",
      shape: vision.objectShape === "ovoid" ? "oval" : "circle",
      rect: {
        x: pos.x - size.w / 2,
        y: pos.y - size.h / 2,
        w: size.w,
        h: size.h,
        rotation: 0,
      },
      dimOpacity: 0.6,
      timing,
    } as SpotlightElement;
  }

  if (tool === "arrow") {
    const offsetX = pos.x > 50 ? -18 : 18;
    const offsetY = pos.y > 50 ? -18 : 18;
    return {
      id: uid("arrow"),
      kind: "arrow",
      from: {
        x: Math.max(5, Math.min(95, pos.x + offsetX)),
        y: Math.max(5, Math.min(95, pos.y + offsetY)),
      },
      to: { x: pos.x, y: pos.y },
      color: "#FFFF00",
      strokeWidth: 2.5,
      headSize: 10,
      timing,
    } as ArrowElement;
  }

  // rectangle or oval
  const shape = tool === "rectangle" ? "rectangle" : "oval";
  return {
    id: uid("shape"),
    kind: "shape",
    shape,
    rect: {
      x: pos.x - size.w / 2,
      y: pos.y - size.h / 2,
      w: size.w,
      h: shape === "oval" ? size.h * 0.7 : size.h,
      rotation: 0,
    },
    stroke: { color: "#FFFF00", width: 2.5, style: "solid" },
    timing,
  } as ShapeElement;
}

// ---------------------------------------------------------------------------
// Timing helpers
// ---------------------------------------------------------------------------

function annotationTiming(camera: CameraKeyframes, slideDuration: number): Timing {
  if (camera.hasTarget) {
    const zoomInEnd = camera.zoomInStartTime + ZOOM_ANIMATION_DURATION;
    const holdEnd = Math.max(zoomInEnd + 0.5, slideDuration - camera.zoomOutDuration);
    const hold = Math.max(0.5, holdEnd - zoomInEnd - 0.8);
    return { start: zoomInEnd, fadeIn: 0.4, hold, fadeOut: 0.4 };
  }
  const start = Math.min(1.5, slideDuration * 0.15);
  const hold = Math.max(1, slideDuration - start - 0.8 - 0.4);
  return { start, fadeIn: 0.4, hold, fadeOut: 0.4 };
}

function labelTiming(camera: CameraKeyframes, slideDuration: number): Timing {
  const ann = annotationTiming(camera, slideDuration);
  return {
    start: ann.start + 0.3,
    fadeIn: 0.4,
    hold: Math.max(1, ann.hold - 0.3),
    fadeOut: 0.4,
  };
}

// ---------------------------------------------------------------------------
// Background image element
// ---------------------------------------------------------------------------

/** @internal exported for testing */
export function buildBackground(
  img: ImageInput,
  slideId: string,
  duration: number
): { element: SlideElement; coverScale: number } {
  const canvasAspect = 16 / 9;
  const imgAspect = img.width && img.height ? img.width / img.height : 1;
  let w = 100;
  let h = (w * canvasAspect) / imgAspect;
  if (h < 100) {
    h = 100;
    w = (h * imgAspect) / canvasAspect;
  }
  return {
    element: {
      id: `image-bg-${slideId}`,
      kind: "image",
      imageUrl: img.url,
      rect: { x: 50 - w / 2, y: 50 - h / 2, w, h, rotation: 0 },
      opacity: 1,
      timing: fullTiming(duration),
    } as SlideElement,
    coverScale: coverZoom(img.width, img.height),
  };
}

// ---------------------------------------------------------------------------
// Camera element
// ---------------------------------------------------------------------------

/** @internal exported for testing */
export function buildCamera(camera: CameraKeyframes, slideDuration: number): CameraElement | null {
  if (!camera.hasTarget) return null;
  const zoomed = camera.zoomed;
  return {
    id: uid("cam"),
    kind: "camera",
    to: { x: zoomed.x + 50, y: zoomed.y + 50, scale: zoomed.scale },
    persistent: false,
    timing: {
      start: camera.zoomInStartTime,
      fadeIn: ZOOM_ANIMATION_DURATION,
      hold: Math.max(
        0.5,
        slideDuration - camera.zoomInStartTime - ZOOM_ANIMATION_DURATION - camera.zoomOutDuration
      ),
      fadeOut: camera.zoomOutDuration,
    },
  };
}

// ---------------------------------------------------------------------------
// Text label
// ---------------------------------------------------------------------------

/** @internal exported for testing */
export function buildTextLabel(label: string, timing: Timing): TextElement {
  return {
    id: uid("text"),
    kind: "text",
    text: label,
    rect: { x: 10, y: 82, w: 80, h: 12, rotation: 0 },
    fontSize: 1.6,
    fontWeight: "bold",
    color: "#FFFFFF",
    background: "rgba(0,0,0,0.5)",
    align: "center",
    timing,
  };
}

// ---------------------------------------------------------------------------
// Title slide (branded)
// ---------------------------------------------------------------------------

/** @internal exported for testing */
export function buildTitleSlide(episodeTitle: string, duration: number): Slide {
  const slideId = uid("slide");
  const elements: SlideElement[] = [
    {
      id: uid("text"),
      kind: "text",
      text: "Pathology Bites",
      rect: { x: 10, y: 5, w: 40, h: 10, rotation: 0 },
      fontSize: 2.2,
      fontWeight: "bold",
      color: BRAND_TEAL,
      align: "left",
      shadow: false,
      timing: { start: 0, fadeIn: 0.3, hold: duration - 0.6, fadeOut: 0.3 },
    } as TextElement,
    {
      id: uid("text"),
      kind: "text",
      text: episodeTitle,
      rect: { x: 5, y: 32, w: 55, h: 20, rotation: 0 },
      fontSize: 3.2,
      fontWeight: "bold",
      color: BRAND_DARK_TEAL,
      align: "left",
      shadow: false,
      timing: { start: 0.3, fadeIn: 0.4, hold: duration - 1.0, fadeOut: 0.3 },
    } as TextElement,
    {
      id: uid("text"),
      kind: "text",
      text: "Quick Lessons in Pathology",
      rect: { x: 5, y: 55, w: 55, h: 8, rotation: 0 },
      fontSize: 1.4,
      fontWeight: "normal",
      color: "#6B7280",
      align: "left",
      shadow: false,
      timing: { start: 0.5, fadeIn: 0.3, hold: duration - 1.1, fadeOut: 0.3 },
    } as TextElement,
    {
      id: uid("text"),
      kind: "text",
      text: "Pathology Bites \u2022 Medical Education Series",
      rect: { x: 3, y: 88, w: 50, h: 6, rotation: 0 },
      fontSize: 1.0,
      fontWeight: "normal",
      color: "#9CA3AF",
      align: "left",
      shadow: false,
      timing: { start: 0.6, fadeIn: 0.3, hold: duration - 1.2, fadeOut: 0.3 },
    } as TextElement,
    {
      id: uid("svg"),
      kind: "svg",
      svgUrl: MASCOT_SVG_URL,
      svgName: "Dr. Albright",
      rect: { x: 62, y: 8, w: 35, h: 85, rotation: 0 },
      shadow: false,
      timing: { start: 0.2, fadeIn: 0.4, hold: duration - 0.9, fadeOut: 0.3 },
    } as SvgElement,
  ];

  return {
    id: slideId,
    backgroundColor: BRAND_BG,
    imageCategory: "blank",
    duration,
    transitionIn: { kind: "fade-to-black", duration: 0.5 },
    initialFraming: { x: 50, y: 50, scale: 1 },
    elements,
  };
}

// ---------------------------------------------------------------------------
// Text-only slide
// ---------------------------------------------------------------------------

/** @internal exported for testing */
export function buildTextSlide(planned: PlannedTextSlide): Slide {
  const slideId = uid("slide");
  const isDark = planned.backgroundColor !== "#ffffff" && planned.backgroundColor !== "#f8fafc";
  const textColor = isDark ? "#ffffff" : "#1a1a2e";
  const bulletColor = isDark ? "#e0e0e0" : "#333333";
  const bullets = planned.bullets.slice(0, 3); // hard cap at 3

  const elements: SlideElement[] = [
    {
      id: uid("text"),
      kind: "text",
      text: planned.title,
      rect: { x: 10, y: bullets.length > 0 ? 15 : 35, w: 80, h: 20, rotation: 0 },
      fontSize: 2.4,
      fontWeight: "bold",
      color: textColor,
      align: "center",
      shadow: false,
      timing: { start: 0, fadeIn: 0.4, hold: planned.duration - 0.8, fadeOut: 0.4 },
    } as TextElement,
  ];

  bullets.forEach((bullet, i) => {
    elements.push({
      id: uid("text"),
      kind: "text",
      text: `\u2022 ${bullet}`,
      rect: { x: 12, y: 40 + i * 14, w: 76, h: 12, rotation: 0 },
      fontSize: 1.4,
      fontWeight: "normal",
      color: bulletColor,
      align: "left",
      shadow: false,
      timing: {
        start: 0.3 + i * 0.3,
        fadeIn: 0.3,
        hold: Math.max(1, planned.duration - 0.9 - i * 0.3),
        fadeOut: 0.3,
      },
    } as TextElement);
  });

  return {
    id: slideId,
    backgroundColor: planned.backgroundColor,
    imageCategory: "blank",
    duration: planned.duration,
    transitionIn: { kind: "fade-to-black", duration: 0.8 },
    initialFraming: { x: 50, y: 50, scale: 1 },
    elements,
  };
}

// ---------------------------------------------------------------------------
// Image slide (deterministic annotations from vision)
// ---------------------------------------------------------------------------

/** @internal exported for testing */
export function buildImageSlide(
  image: ImageInput,
  vision: VisionResult | undefined,
  duration: number,
  segmentIndex: number
): Slide {
  const slideId = uid("slide");
  const elements: SlideElement[] = [];

  // 1. Background image
  const { element: bgEl, coverScale } = buildBackground(image, slideId, duration);
  elements.push(bgEl);

  // 2. Camera (deterministic)
  const cameraKf = computeCameraKeyframes(image, vision, segmentIndex);
  const cameraEl = buildCamera(cameraKf, duration);
  if (cameraEl) elements.push(cameraEl);

  // 3. Annotation (0 or 1, from vision — NOT from planner)
  if (vision) {
    const ann = buildAnnotation(vision, annotationTiming(cameraKf, duration));
    if (ann) elements.push(ann);
  }

  // 4. Text label (from vision suggestedLabel)
  const label = vision?.suggestedLabel || "";
  if (label) {
    elements.push(buildTextLabel(label, labelTiming(cameraKf, duration)));
  }

  const category = (image.category as string)?.toLowerCase() ?? undefined;

  return {
    id: slideId,
    imageCategory:
      category === "microscopic" ||
      category === "gross" ||
      category === "figure" ||
      category === "table" ||
      category === "diagram"
        ? (category as Slide["imageCategory"])
        : undefined,
    imageWidth: image.width,
    imageHeight: image.height,
    duration,
    transitionIn: { kind: "crossfade", duration: 1 },
    initialFraming: { x: 50, y: 50, scale: coverScale },
    elements,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function assembleLesson(
  plan: LessonPlan,
  images: ImageInput[],
  visionResults: VisionResult[],
  transcriptAnalysis: TranscriptAnalysis,
  svgs: SvgInput[],
  audioUrl: string,
  audioTitle: string | undefined,
  audioDuration: number,
  transcript: string
): Lesson {
  const episodeTitle = transcriptAnalysis.episodeTitle || audioTitle || "Pathology Bite";

  // Calculate text slide total duration for budget
  const textSlideTotalDuration = plan.textSlides.reduce((sum, ts) => sum + ts.duration, 0);

  // Compute per-image durations from word counts
  const imageDurations = computeImageDurations(
    transcriptAnalysis.segments,
    plan.imageOrder,
    audioDuration,
    textSlideTotalDuration
  );

  // Index SVG placements by slide position for quick lookup
  const svgsBySlide = new Map<number, typeof plan.svgPlacements>();
  for (const sp of plan.svgPlacements) {
    if (sp.svgIndex < 0 || sp.svgIndex >= svgs.length) continue;
    const list = svgsBySlide.get(sp.onSlide) ?? [];
    list.push(sp);
    svgsBySlide.set(sp.onSlide, list);
  }

  // Build slides in order: title → interleaved images + text slides
  const slides: Slide[] = [buildTitleSlide(episodeTitle, TITLE_DURATION)];

  // Sort text slides by insertion point
  const sortedTextSlides = [...plan.textSlides].sort(
    (a, b) => a.insertBeforeImage - b.insertBeforeImage
  );

  for (let i = 0; i < plan.imageOrder.length; i++) {
    // Insert any text slides before this image position
    for (const ts of sortedTextSlides) {
      if (ts.insertBeforeImage === i) {
        slides.push(buildTextSlide(ts));
      }
    }

    const imgIdx = plan.imageOrder[i];
    const image = images[imgIdx];
    if (!image) continue;
    const vision = visionResults[imgIdx];
    const slide = buildImageSlide(image, vision, imageDurations[i], i);

    // Add SVGs placed on this slide
    const placements = svgsBySlide.get(i) ?? [];
    for (const sp of placements) {
      const svg = svgs[sp.svgIndex];
      if (!svg) continue;
      const w = sp.widthPercent ?? 15;
      slide.elements.push({
        id: uid("svg"),
        kind: "svg",
        svgUrl: svg.url,
        svgAssetId: svg.assetId,
        svgName: svg.name,
        rect: {
          x: sp.position.x - w / 2,
          y: sp.position.y - w / 2,
          w,
          h: w,
          rotation: 0,
        },
        timing: {
          start: Math.min(0.5, imageDurations[i] * 0.1),
          fadeIn: 0.3,
          hold: Math.max(1, imageDurations[i] - 1.1),
          fadeOut: 0.3,
        },
      } as SvgElement);
    }

    slides.push(slide);
  }

  // Insert text slides after last image
  for (const ts of sortedTextSlides) {
    if (ts.insertBeforeImage >= plan.imageOrder.length) {
      slides.push(buildTextSlide(ts));
    }
  }

  return {
    id: null,
    title: episodeTitle,
    description: "",
    aspectRatio: "16:9",
    audio: {
      url: audioUrl,
      title: audioTitle,
      transcript,
      duration: audioDuration,
    },
    slides,
  };
}
