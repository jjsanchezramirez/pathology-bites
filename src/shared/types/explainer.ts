// src/shared/types/explainer.ts

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
}

export interface ArrowPointer {
  id: string;
  startPosition: Position; // arrow tail
  endPosition: Position; // arrow head (points to feature)
  color: string;
  strokeWidth: number; // px
  opacity: number; // 0-1
  headSize?: number; // arrowhead size in px (default 12)
  direction: "up" | "down" | "left" | "right" | "up-left" | "up-right" | "down-left" | "down-right";
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
  animation?: "fade" | "slide-up" | "none";
  /** Runtime-only: computed opacity for fade animations (0–1) */
  computedOpacity?: number;
}

// ---- Keyframe & Segment ----

export interface Keyframe {
  time: number; // seconds from segment start
  transform: Transform;
  highlights: HighlightRegion[];
  arrows: ArrowPointer[];
  textOverlays: TextOverlay[];
}

export interface Segment {
  id: string;
  imageUrl: string; // Cloudflare R2 URL
  imageAlt?: string;
  startTime: number; // seconds from sequence start
  endTime: number; // seconds from sequence start
  transition: "crossfade" | "cut" | "fade-to-black";
  transitionDuration: number; // seconds
  keyframes: Keyframe[]; // at least 2: start and end
}

// ---- Captions ----

/** A single subtitle chunk with absolute start/end times (seconds from sequence start). */
export interface CaptionChunk {
  text: string;
  start: number;
  end: number;
}

// ---- Top-Level Sequence ----

export interface ExplainerSequence {
  version: 1;
  duration: number; // total duration in seconds
  aspectRatio: "16:9" | "16:10" | "4:3";
  segments: Segment[];
  /** URL of the audio track associated with this sequence */
  audioUrl?: string;
  /** Pre-computed caption chunks (uniform word timing) */
  captions?: CaptionChunk[];
}

// ---- Component Props ----

export interface ExplainerPlayerProps {
  sequence: ExplainerSequence;
  audioUrl: string;
  autoPlay?: boolean;
  className?: string;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  onAudioLoaded?: (duration: number) => void; // Called when audio loads with its duration
  seekToTime?: number; // Seek to this time when it changes
  captions?: CaptionChunk[]; // Optional flat list of caption chunks
}
