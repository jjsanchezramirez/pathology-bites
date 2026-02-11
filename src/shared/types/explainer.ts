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
  type: "circle" | "rectangle";
  position: Position; // center (circle) or top-left (rectangle)
  size: Size; // width/height; for circle width = diameter
  borderColor: string;
  borderWidth: number; // px
  fillColor?: string;
  opacity: number; // 0-1
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
}

// ---- Keyframe & Segment ----

export interface Keyframe {
  time: number; // seconds from segment start
  transform: Transform;
  highlights: HighlightRegion[];
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

// ---- Top-Level Sequence ----

export interface ExplainerSequence {
  version: 1;
  duration: number; // total duration in seconds
  aspectRatio: "16:9" | "16:10" | "4:3";
  segments: Segment[];
}

// ---- Component Props ----

export interface ExplainerPlayerProps {
  sequence: ExplainerSequence;
  audioUrl: string;
  autoPlay?: boolean;
  className?: string;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
}
