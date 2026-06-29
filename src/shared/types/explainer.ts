// src/shared/types/explainer.ts

import type { Lesson } from "@/shared/lesson/types";

// ---- Geometry & Animation Primitives ----

export interface Position {
  x: number; // 0-100 percentage of viewport width
  y: number; // 0-100 percentage of viewport height
}

export interface Size {
  width: number; // 0-100 percentage
  height: number; // 0-100 percentage
}

export interface Transform {
  x: number; // pan X offset as % (-50 to 50)
  y: number; // pan Y offset as % (-50 to 50)
  scale: number; // 1.0 = 100%, 1.5 = 150% zoom
}

// ---- Overlay Types ----

export interface HighlightRegion {
  id: string;
  type: "circle" | "oval" | "rectangle";
  position: Position; // center for circle/oval, top-left for rectangle
  size: Size; // width/height; for circle width = diameter, for oval width/height = radii
  borderColor: string;
  borderWidth: number; // px
  borderStyle?: "solid" | "dotted" | "dashed"; // border style (default: solid)
  fillColor?: string;
  opacity: number; // 0-1
  spotlight?: boolean; // if true, dims everything except this region
  shadow?: boolean; // if true, draws a drop shadow. Default false.
  /** Runtime-only: entrance/exit scale-pop multiplier (~0.85–1.05). */
  computedScale?: number;
}

export interface ArrowPointer {
  id: string;
  startPosition: Position; // arrow tail
  endPosition: Position; // arrow head (points to feature)
  color: string;
  strokeWidth: number; // px
  opacity: number; // 0-1
  headSize?: number; // arrowhead size in px (default 12)
  shadow?: boolean; // if true, draws a drop shadow. Default true.
  /** Runtime-only: entrance/exit scale-pop multiplier (~0.85–1.05). */
  computedScale?: number;
  direction?:
    | "up"
    | "down"
    | "left"
    | "right"
    | "up-left"
    | "up-right"
    | "down-left"
    | "down-right"; // optional for backward compat
}

export interface TextOverlay {
  id: string;
  text: string;
  position: Position;
  fontSize: number; // rem
  fontWeight: "normal" | "bold" | "semibold";
  color: string;
  backgroundColor?: string;
  maxWidth?: number; // percentage of viewport width
  textAlign?: "left" | "center" | "right";
  animation?: "fade" | "slide-up" | "letter-by-letter" | "none";
  shadow?: boolean; // if true, draws a text shadow. Default true.
  /** Runtime-only: computed opacity for fade animations (0–1) */
  computedOpacity?: number;
  /** Runtime-only: entrance/exit scale-pop multiplier (~0.85–1.05). */
  computedScale?: number;
}

// ---- SVG Overlay ----

export interface SvgOverlayElement {
  id: string;
  /** "image" for raster images, "svg" (or omitted) for SVG assets. */
  overlayKind?: "svg" | "image";
  svgUrl: string;
  position: Position;
  size: Size;
  rotation: number;
  opacity: number;
  computedOpacity?: number; // Runtime-only: computed opacity for fade animations (0–1)
  /** Runtime-only: entrance/exit scale-pop multiplier (~0.85–1.05). */
  computedScale?: number;
  color?: string;
}

// NOTE: The old document/keyframe layer (ExplainerSequence/Segment/Keyframe) was
// removed when the player collapsed onto the single Lesson model. The interfaces
// above (Transform, HighlightRegion, ArrowPointer, TextOverlay, SvgOverlayElement)
// are the render primitives emitted by the evaluator (src/shared/lesson/evaluate.ts).

// ---- Captions ----

/** A single subtitle chunk with absolute start/end times (seconds from sequence start). */
export interface CaptionChunk {
  text: string;
  start: number;
  end: number;
  /** Optional per-word timings (from forced alignment) for karaoke captions. */
  words?: { text: string; start: number; end: number }[];
}

// ---- Component Props ----

export interface ExplainerPlayerProps {
  /** The lesson to play (the single canonical model). */
  lesson: Lesson;
  /** Audio track URL. Defaults to `lesson.audio?.url`. */
  audioUrl?: string;
  autoPlay?: boolean;
  className?: string;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  onAudioLoaded?: (duration: number) => void; // Called when audio loads with its duration
  seekToTime?: number; // Seek to this time when it changes
  /** Optional caption chunks; derived from `lesson.audio` when omitted. */
  captions?: CaptionChunk[];
}
