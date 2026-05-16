// Slide and element factory helpers for the library panel.

import type { Lesson, Slide, SvgElement, ImageElement } from "./types";
import { DEFAULT_TRANSITION, emptyLesson } from "./types";

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
 * Build a new ImageElement from a library image, centered and sized to cover
 * the entire 16:9 canvas with no empty space. The image's aspect ratio is
 * preserved; whichever axis doesn't match the canvas overflows past 100%
 * (cropped by the canvas clip) so the full canvas is filled. If the image's
 * natural size is unknown, falls back to a full-canvas square.
 */
export function imageElementFromLibrary(
  img: LibraryImageLike,
  slideDuration: number
): ImageElement {
  const canvasAspect = 16 / 9;
  const imgAspect = img.width && img.height ? img.width / img.height : 1;
  // On a 16:9 canvas, a rect w_pct × h_pct has pixel aspect
  //   (w_pct * 16) / (h_pct * 9) = (w/h) * canvasAspect
  // For that to equal imgAspect: h_pct = w_pct * canvasAspect / imgAspect.
  // Start at 100% width; if that leaves vertical gaps (h < 100), clamp h=100
  // and let w overflow past 100% so the canvas is fully covered.
  let w = 100;
  let h = (w * canvasAspect) / imgAspect;
  if (h < 100) {
    h = 100;
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
      fadeIn: 0,
      hold: slideDuration,
      fadeOut: 0,
    },
  };
}

/**
 * Build an overlay ImageElement from a library image, sized to ~60% canvas width
 * and centered at a given drop position. Uses a 5s window with fade in/out.
 */
export function overlayImageFromLibrary(
  img: LibraryImageLike,
  dropX = 50,
  dropY = 50
): ImageElement {
  const canvasAspect = 16 / 9;
  const imgAspect = img.width && img.height ? img.width / img.height : 1;
  const w = 60;
  const h = (w * canvasAspect) / imgAspect;
  return {
    id: uid("img"),
    kind: "image",
    imageUrl: img.url,
    rect: { x: dropX - w / 2, y: dropY - h / 2, w, h, rotation: 0 },
    opacity: 1,
    timing: { start: 0, fadeIn: 0.3, hold: 4.4, fadeOut: 0.3 },
  };
}

const CANVAS_ASPECT = 16 / 9;

/**
 * Scale factor so the image covers the 16:9 canvas (no letterboxing).
 * Returns ≥ 1 for images that don't match 16:9. Clamped to [0.5, 2].
 * Returns 1 for bad dimensions.
 */
export function coverZoom(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1;
  const imgAspect = width / height;
  const scale = Math.max(imgAspect / CANVAS_ASPECT, CANVAS_ASPECT / imgAspect);
  return Math.max(0.5, Math.min(2, scale));
}

/** Build a new blank Slide (no background image). Defaults to white. */
export function blankSlide(backgroundColor = "#ffffff"): Slide {
  return {
    id: uid("slide"),
    backgroundColor,
    imageCategory: "blank",
    duration: 10,
    transitionIn: { ...DEFAULT_TRANSITION },
    initialFraming: { x: 50, y: 50, scale: 1 },
    elements: [],
  };
}

/**
 * Build a new Lesson seeded with a single blank white slide — used when the
 * user opens the studio fresh or chooses "New lesson" from the File menu so
 * there is always a slide to edit on the canvas.
 */
export function newBlankLesson(): Lesson {
  return {
    ...emptyLesson(),
    slides: [blankSlide()],
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
