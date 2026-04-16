// Factory helpers that create new SlideElements from a drawn bounding rect.
// Smart defaults vary by imageCategory (microscopy → bright spotlights + yellow
// arrows; figures/tables → neutral colors + black text).

import type {
  SlideElement,
  ShapeElement,
  SpotlightElement,
  ArrowElement,
  TextElement,
  CameraElement,
  ImageCategory,
  Timing,
} from "../model/types";
import type { Tool } from "../model/store";
import type { Point } from "./geometry";
import { clamp } from "../utils/math";

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeRect(a: Point, b: Point) {
  const x = clamp(Math.min(a.x, b.x), 0, 100);
  const y = clamp(Math.min(a.y, b.y), 0, 100);
  const w = clamp(Math.abs(b.x - a.x), 0.5, 100 - x);
  const h = clamp(Math.abs(b.y - a.y), 0.5, 100 - y);
  return { x, y, w, h, rotation: 0 };
}

/** Timing used for brand-new elements: appear immediately, held for default span. */
function defaultTiming(slideDuration: number): Timing {
  const hold = Math.max(1, Math.min(3, slideDuration - 1));
  return { start: 0, fadeIn: 0.3, hold, fadeOut: 0.3 };
}

// ---- Per-category palettes ------------------------------------------------

function palette(cat?: ImageCategory) {
  switch (cat) {
    case "microscopic":
    case "gross":
      return {
        strokeColor: "#ff3b30",
        arrowColor: "#ffcc00",
        spotlightDim: 0.7,
        textColor: "#ffffff",
        textBg: "rgba(0,0,0,0.5)",
      };
    case "figure":
    case "table":
    case "diagram":
      return {
        strokeColor: "#1d4ed8",
        arrowColor: "#dc2626",
        spotlightDim: 0.4,
        textColor: "#111827",
        textBg: "transparent",
      };
    default:
      return {
        strokeColor: "#ef4444",
        arrowColor: "#eab308",
        spotlightDim: 0.6,
        textColor: "#ffffff",
        textBg: "rgba(0,0,0,0.5)",
      };
  }
}

// ---- Factory --------------------------------------------------------------

export interface CreateArgs {
  tool: Tool;
  start: Point;
  end: Point;
  slideDuration: number;
  imageCategory?: ImageCategory;
}

/**
 * Create a new SlideElement from a click-drag rectangle.
 * Returns null for tools that don't create canvas elements (select, zoom, pan, svg, image).
 */
export function createElementFromDrag(args: CreateArgs): SlideElement | null {
  const { tool, start, end, slideDuration, imageCategory } = args;
  const timing = defaultTiming(slideDuration);
  const p = palette(imageCategory);

  switch (tool) {
    case "shape": {
      const el: ShapeElement = {
        id: uid("shape"),
        kind: "shape",
        shape: "rectangle",
        rect: normalizeRect(start, end),
        stroke: { color: p.strokeColor, width: 3, style: "solid" },
        timing,
      };
      return el;
    }
    case "spotlight": {
      const el: SpotlightElement = {
        id: uid("spotlight"),
        kind: "spotlight",
        shape: "oval",
        rect: normalizeRect(start, end),
        dimOpacity: p.spotlightDim,
        timing,
      };
      return el;
    }
    case "arrow": {
      const el: ArrowElement = {
        id: uid("arrow"),
        kind: "arrow",
        from: start,
        to: end,
        color: p.arrowColor,
        strokeWidth: 4,
        headSize: 14,
        timing,
      };
      return el;
    }
    case "text": {
      // Minimum size so users don't end up with invisible text boxes.
      const r = normalizeRect(start, end);
      const el: TextElement = {
        id: uid("text"),
        kind: "text",
        text: "",
        rect: { ...r, w: Math.max(r.w, 20), h: Math.max(r.h, 8) },
        fontSize: 3,
        fontWeight: "bold",
        color: p.textColor,
        background: p.textBg === "transparent" ? undefined : p.textBg,
        align: "center",
        timing,
      };
      return el;
    }
    case "camera": {
      // Non-persistent (zoom) by default: 2× scale, fade-in/hold/fade-out.
      const el: CameraElement = {
        id: uid("camera"),
        kind: "camera",
        to: { x: start.x, y: start.y, scale: 2 },
        timing: { start: 0, fadeIn: 1, hold: Math.max(1, slideDuration - 3), fadeOut: 1 },
        persistent: false,
      };
      return el;
    }
    default:
      return null;
  }
}
