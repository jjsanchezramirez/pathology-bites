// Slide and element factory helpers for the library panel.

import type { Slide, SvgElement, ImageElement } from "./types";
import { DEFAULT_TRANSITION } from "./types";

export interface LibraryImageLike {
  id: string;
  url: string;
  description?: string | null;
  alt_text?: string | null;
  category?: string | null;
  width: number;
  height: number;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Build a new ImageElement from a library image, centered on the canvas.
 * Default size: ~60% canvas width, preserving the image's aspect ratio against
 * the 16:9 canvas. If the image's natural size is unknown, defaults to a square.
 */
export function imageElementFromLibrary(
  img: LibraryImageLike,
  slideDuration: number
): ImageElement {
  const canvasAspect = 16 / 9;
  const imgAspect = img.width && img.height ? img.width / img.height : 1;
  // Convert percent-width to percent-height that yields a square pixel aspect:
  // h_pct = w_pct * canvas_aspect / image_aspect.
  // Start at 60% width and shrink if that would overflow the canvas vertically.
  let w = 60;
  let h = (w * canvasAspect) / imgAspect;
  if (h > 90) {
    h = 90;
    w = (h * imgAspect) / canvasAspect;
  }
  return {
    id: uid("img"),
    kind: "image",
    imageUrl: img.url,
    rect: {
      x: 50 - w / 2,
      y: 50 - h / 2,
      w,
      h,
      rotation: 0,
    },
    opacity: 1,
    timing: {
      start: 0,
      fadeIn: 0.3,
      hold: Math.max(1, slideDuration - 0.6),
      fadeOut: 0.3,
    },
  };
}

/** Build a new blank Slide (no background image). */
export function blankSlide(backgroundColor = "#000000"): Slide {
  return {
    id: uid("slide"),
    backgroundImageUrl: null,
    backgroundColor,
    imageCategory: "blank",
    duration: 10,
    transitionIn: { ...DEFAULT_TRANSITION },
    initialFraming: { x: 50, y: 50, scale: 1 },
    elements: [],
  };
}

export interface SvgAssetLike {
  id: string;
  url: string;
  name: string;
  width?: number | null;
  height?: number | null;
}

/** Build a new SvgElement from a library SVG asset, centered on the canvas. */
export function svgElementFromAsset(asset: SvgAssetLike, slideDuration: number): SvgElement {
  // Default size: aim for ~30% of canvas width, preserving the SVG's aspect ratio.
  // h_pct = w_pct * canvas_aspect / svg_aspect (see imageElementFromLibrary).
  const canvasAspect = 16 / 9;
  const svgAspect = asset.width && asset.height ? asset.width / asset.height : 1;
  let w = 30;
  let h = (w * canvasAspect) / svgAspect;
  if (h > 80) {
    h = 80;
    w = (h * svgAspect) / canvasAspect;
  }
  return {
    id: uid("svg"),
    kind: "svg",
    svgUrl: asset.url,
    svgAssetId: asset.id,
    svgName: asset.name,
    rect: {
      x: 50 - w / 2,
      y: 50 - h / 2,
      w,
      h,
      rotation: 0,
    },
    opacity: 1,
    timing: {
      start: 0,
      fadeIn: 0.3,
      hold: Math.max(1, Math.min(4, slideDuration - 1)),
      fadeOut: 0.3,
    },
  };
}
