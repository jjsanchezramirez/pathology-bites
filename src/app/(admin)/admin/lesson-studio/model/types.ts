// Editor-side data model for the lesson studio.
// All spatial coordinates are in 0–100 percentage space on a 16:9 canvas.
// Conversion to the player's -50..50 transform space happens only in to-sequence.ts.

export type ImageCategory = "microscopic" | "gross" | "figure" | "table" | "diagram" | "blank";

/** Axis-aligned box + rotation. x,y = top-left corner, in 0–100 percent. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number; // degrees, clockwise, around rect center
}

/**
 * Four-phase timing window (seconds, segment-local):
 *   start → fadeIn → hold (fully visible) → fadeOut → invisible.
 * Total visible span = fadeIn + hold + fadeOut. End time = start + that total.
 */
export interface Timing {
  start: number;
  fadeIn: number;
  hold: number;
  fadeOut: number;
}

export type Point = { x: number; y: number };

/**
 * Spatial keyframe for an element with a rect. `time` is segment-local,
 * measured in seconds relative to the element's `timing.start`. The first
 * waypoint should be at time 0. With fewer than 2 waypoints, no motion occurs.
 */
export interface Waypoint {
  time: number;
  rect: Rect;
}

/** Spatial keyframe for an arrow element (uses from/to points, not a rect). */
export interface ArrowWaypoint {
  time: number;
  from: Point;
  to: Point;
}

export type ElementKind =
  | "shape"
  | "spotlight"
  | "arrow"
  | "text"
  | "svg"
  | "image"
  | "zoom"
  | "pan";

interface ElementBase {
  id: string;
  kind: ElementKind;
  timing: Timing;
  /** Base opacity 0–1 (multiplied by computed fade opacity at render time). Default 1. */
  opacity?: number;
}

export type ShapeKind = "rectangle" | "circle" | "oval";

export interface ShapeElement extends ElementBase {
  kind: "shape";
  shape: ShapeKind;
  rect: Rect;
  stroke: {
    color: string;
    width: number;
    style: "solid" | "dashed" | "dotted";
  };
  fill?: string;
  waypoints?: Waypoint[];
}

export interface SpotlightElement extends ElementBase {
  kind: "spotlight";
  shape: ShapeKind;
  rect: Rect;
  /** 0–1, how dark the non-spotlight area gets (default 0.7). */
  dimOpacity: number;
  waypoints?: Waypoint[];
}

export interface ArrowElement extends ElementBase {
  kind: "arrow";
  from: Point; // tail, 0–100 percent
  to: Point; // head
  color: string;
  strokeWidth: number;
  headSize: number;
  waypoints?: ArrowWaypoint[];
}

export interface TextElement extends ElementBase {
  kind: "text";
  text: string;
  rect: Rect;
  fontSize: number; // rem
  fontWeight: "normal" | "semibold" | "bold";
  color: string;
  background?: string;
  align: "left" | "center" | "right";
  waypoints?: Waypoint[];
}

export interface SvgElement extends ElementBase {
  kind: "svg";
  svgUrl: string;
  svgAssetId?: string;
  svgName?: string;
  rect: Rect;
  /** Optional tint color. */
  color?: string;
  waypoints?: Waypoint[];
}

export interface ImageElement extends ElementBase {
  kind: "image";
  imageUrl: string;
  rect: Rect;
  waypoints?: Waypoint[];
}

/** Camera operation: zoom returns to prior base transform after hold/fadeOut. */
export interface ZoomElement extends ElementBase {
  kind: "zoom";
  /** Target camera state in 0–100 percent UI coords + scale. */
  to: { x: number; y: number; scale: number };
}

/** Camera operation: pan persists — once fadeIn completes, target is the new base. */
export interface PanElement extends ElementBase {
  kind: "pan";
  to: { x: number; y: number; scale: number };
}

export type SlideElement =
  | ShapeElement
  | SpotlightElement
  | ArrowElement
  | TextElement
  | SvgElement
  | ImageElement
  | ZoomElement
  | PanElement;

export interface SlideTransition {
  kind: "crossfade" | "cut" | "fade-to-black";
  duration: number; // seconds
}

/** Starting camera for a slide, in 0–100 percent UI coords + scale. */
export interface Framing {
  x: number;
  y: number;
  scale: number;
}

export interface Slide {
  id: string;
  /** null = blank slide (solid background). */
  backgroundImageUrl: string | null;
  backgroundImageId?: string;
  backgroundImageAlt?: string;
  backgroundColor?: string;
  /** Category drives smart-default tool emphasis and initial framing. */
  imageCategory?: ImageCategory;
  /** Original image pixel dimensions, used for cover-zoom math. */
  imageWidth?: number;
  imageHeight?: number;
  duration: number; // seconds
  transitionIn: SlideTransition;
  initialFraming: Framing;
  elements: SlideElement[];
}

export interface LessonAudio {
  url: string;
  title?: string;
  transcript?: string;
  duration?: number;
}

export interface Lesson {
  id: string | null;
  title: string;
  description: string;
  aspectRatio: "16:9";
  audio: LessonAudio | null;
  slides: Slide[];
}

// ---- Constructors / defaults --------------------------------------------------

export const DEFAULT_FRAMING: Framing = { x: 50, y: 50, scale: 1 };

export const DEFAULT_TRANSITION: SlideTransition = {
  kind: "crossfade",
  duration: 1,
};

export function emptyLesson(): Lesson {
  return {
    id: null,
    title: "",
    description: "",
    aspectRatio: "16:9",
    audio: null,
    slides: [],
  };
}

/** Timing window where visible span = fadeIn + hold + fadeOut. */
export function timing(start: number, fadeIn: number, hold: number, fadeOut: number): Timing {
  return { start, fadeIn, hold, fadeOut };
}

/** End time (seconds, segment-local) of a timing window. */
export function timingEnd(t: Timing): number {
  return t.start + t.fadeIn + t.hold + t.fadeOut;
}
