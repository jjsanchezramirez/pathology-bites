export interface LibraryImage {
  id: string;
  url: string;
  description?: string;
  alt_text?: string;
  category?: string;
  file_type: string;
  width: number;
  height: number;
  magnification?: string | null;
  created_at: string;
}

// Time-based animation types
export interface BaseAnimation {
  id: string;
  start: number; // When animation begins
  duration: number; // How long at target state
  fadeTime: number; // How long transition takes
}

export interface ZoomAnimation extends BaseAnimation {
  type: "zoom";
  targetScale: number; // Target zoom level
  targetX: number; // X position to zoom to (-50 to 50)
  targetY: number; // Y position to zoom to (-50 to 50)
}

export interface PanAnimation extends BaseAnimation {
  type: "pan";
  targetScale: number; // Target zoom level (stays after animation)
  targetX: number; // X position to pan to (stays after animation)
  targetY: number; // Y position to pan to (stays after animation)
}

export interface FigureAnimation extends BaseAnimation {
  type: "figure";
  figureType: "circle" | "oval" | "rectangle";
  position: { x: number; y: number };
  size: { width: number; height: number };
  borderColor: string;
  borderWidth: number;
  borderStyle: "solid" | "dotted" | "dashed";
}

export interface SpotlightAnimation extends BaseAnimation {
  type: "spotlight";
  figureType: "circle" | "oval" | "rectangle";
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export interface ArrowAnimation extends BaseAnimation {
  type: "arrow";
  position: { x: number; y: number };
  color: string;
  direction: "up" | "down" | "left" | "right" | "up-left" | "up-right" | "down-left" | "down-right";
}

export type Animation =
  | ZoomAnimation
  | PanAnimation
  | FigureAnimation
  | SpotlightAnimation
  | ArrowAnimation;

export interface TimeBasedText {
  id: string;
  start: number; // When fade-in begins
  duration: number; // How long text is fully visible
  fadeTime: number; // How long fade-in/fade-out takes
  text: string;
  position: { x: number; y: number };
  fontSize: number;
  fontWeight: "normal" | "bold" | "semibold";
  color: string;
  backgroundColor?: string;
}

export interface SelectedImage extends LibraryImage {
  duration: number;
  transitionDuration: number;
  initialZoom: number; // 1.0 = 100%, 1.5 = 150%
  initialX: number; // -50 to 50 (percentage offset)
  initialY: number; // -50 to 50 (percentage offset)
  animations: Animation[]; // Multiple time-based animations
  textOverlays: TimeBasedText[]; // Multiple time-based text overlays
}

export type ExportPhase =
  | "idle"
  | "fetching-audio"
  | "loading-images"
  | "encoding"
  | "rendering"
  | "muxing"
  | "done"
  | "error";

export interface ExportResolution {
  label: string;
  width: number;
  height: number;
}
