// The "clean" look for canvas slides (the template look).
//
// Classic slides sort their elements into layers (pictures above shapes, text
// above everything) and pop them in with a small scale bounce. That works for
// annotations on a full-bleed slide image, but not for designed slides where a
// ring has to sit on a picture and a label on a panel. A slide with
// `look: "clean"` instead draws its elements strictly in list order, all in the
// camera's space, with text anchored to its box, no shadows, and one entrance:
// a fade with a small rise on a single easing curve.
//
// This module is pure: it turns a slide at a time into an ordered list of
// drawing items, and draws those items on a 2D canvas for video export. The
// DOM renderer lives with the player's viewport.

import { Easing } from "./easing";
import type { Point, Rect, ShapeKind, Slide, SlideElement, Timing } from "./types";

/** The one easing curve for clean slides. */
export const cleanEase = Easing.easeInOutCubic;

export const CLEAN = {
  /** Rise distance of an entrance, in percent of canvas width. */
  rise: 0.8,
  /** Text size: cqw per rem (same scale as classic text). */
  cqwPerRem: 1.67,
  lineHeight: 1.25,
  /** Stroke widths are in tenths of a percent of canvas width. */
  strokeUnit: 0.1,
  /** Default spotlight dim colour (RGB) when an element doesn't set one. */
  dimRgb: "12, 20, 28",
} as const;

interface Base {
  id: string;
  opacity: number;
  /** Downward offset in percent of canvas width (the entrance rise). */
  rise: number;
}

export type CleanItem =
  | (Base & {
      kind: "shape";
      shape: ShapeKind;
      rect: Rect;
      stroke: { color: string; width: number; style: "solid" | "dashed" | "dotted" };
      fill?: string;
      radius?: number;
    })
  | (Base & { kind: "spotlight"; shape: ShapeKind; rect: Rect; dim: number; within?: Rect })
  | (Base & {
      kind: "text";
      text: string;
      rect: Rect;
      fontSize: number;
      fontWeight: "normal" | "semibold" | "bold";
      color: string;
      background?: string;
      align: "left" | "center" | "right";
      /** Characters shown, for letter-by-letter text. */
      chars?: number;
    })
  | (Base & { kind: "image"; url: string; rect: Rect; color?: string; svg?: boolean })
  | (Base & {
      kind: "arrow";
      from: Point;
      to: Point;
      color: string;
      strokeWidth: number;
      headSize: number;
    });

export interface CleanFrame {
  background: string;
  items: CleanItem[];
}

export const isClean = (slide: Slide | null | undefined): boolean => slide?.look === "clean";

/** 0..1 linear visibility of a timing window. */
function linear(t: Timing, time: number): number {
  const inEnd = t.start + t.fadeIn;
  const holdEnd = inEnd + t.hold;
  const end = holdEnd + t.fadeOut;
  if (time < t.start || time > end) return 0;
  if (time < inEnd) return t.fadeIn > 0 ? (time - t.start) / t.fadeIn : 1;
  if (time <= holdEnd) return 1;
  return t.fadeOut > 0 ? (end - time) / t.fadeOut : 1;
}

/** Eased opacity and entrance rise for an element's timing at `time`. */
export function cleanFade(t: Timing, time: number, motion = 1): { opacity: number; rise: number } {
  const p = linear(t, time);
  if (p <= 0) return { opacity: 0, rise: 0 };
  const entering = time < t.start + t.fadeIn;
  const eased = cleanEase(p);
  return { opacity: eased, rise: entering ? (1 - eased) * CLEAN.rise * motion : 0 };
}

type RectFn = (el: SlideElement, time: number) => Rect | null;
type ArrowFn = (
  el: Extract<SlideElement, { kind: "arrow" }>,
  time: number
) => { from: Point; to: Point };

/**
 * Ordered drawing items for a clean slide at slide-local `time`. Geometry
 * helpers are passed in so waypoint motion matches the classic evaluator.
 */
export function cleanItemsAt(
  slide: Slide,
  time: number,
  motion: number,
  rectAt: RectFn,
  arrowAt: ArrowFn
): CleanItem[] {
  const items: CleanItem[] = [];
  for (const el of slide.elements) {
    if (el.kind === "camera") continue;
    const f = cleanFade(el.timing, time, motion);
    const opacity = Math.max(0, Math.min(1, (el.opacity ?? 1) * f.opacity));
    if (opacity <= 0.005) continue;
    const base = { id: el.id, opacity, rise: f.rise };
    switch (el.kind) {
      case "shape":
        items.push({
          ...base,
          kind: "shape",
          shape: el.shape,
          rect: rectAt(el, time) ?? el.rect,
          stroke: el.stroke,
          fill: el.fill,
          radius: el.radius,
        });
        break;
      case "spotlight":
        items.push({
          ...base,
          rise: 0,
          kind: "spotlight",
          shape: el.shape,
          rect: rectAt(el, time) ?? el.rect,
          dim: el.dimOpacity,
          within: el.within,
        });
        break;
      case "text": {
        const letters = el.animation === "letter-by-letter";
        items.push({
          ...base,
          ...(letters
            ? { opacity: el.opacity ?? 1, rise: 0, chars: Math.ceil(el.text.length * f.opacity) }
            : {}),
          kind: "text",
          text: el.text,
          rect: rectAt(el, time) ?? el.rect,
          fontSize: el.fontSize,
          fontWeight: el.fontWeight,
          color: el.color,
          background: el.background,
          align: el.align,
        });
        break;
      }
      case "image":
        items.push({ ...base, kind: "image", url: el.imageUrl, rect: rectAt(el, time) ?? el.rect });
        break;
      case "svg":
        items.push({
          ...base,
          kind: "image",
          svg: true,
          url: el.svgUrl,
          color: el.color,
          rect: rectAt(el, time) ?? el.rect,
        });
        break;
      case "arrow": {
        const pts = arrowAt(el, time);
        items.push({
          ...base,
          kind: "arrow",
          from: pts.from,
          to: pts.to,
          color: el.color,
          strokeWidth: el.strokeWidth,
          headSize: el.headSize,
        });
        break;
      }
    }
  }
  return items;
}

const ALWAYS: Timing = { start: 0, fadeIn: 0, hold: 1e6, fadeOut: 0 };

/**
 * A still of a clean slide with its lasting content showing: everything except
 * spotlights and beats (which come and go). For thumbnails.
 */
export function cleanStillItems(slide: Slide, rectAt: RectFn, arrowAt: ArrowFn): CleanItem[] {
  const still: Slide = {
    ...slide,
    elements: slide.elements
      .filter((e) => e.kind !== "spotlight" && e.cue !== "beat")
      .map((e) => ({ ...e, timing: ALWAYS }) as SlideElement),
  };
  return cleanItemsAt(still, 0, 0, rectAt, arrowAt);
}

/**
 * Items for the editor canvas at `time`: like the player, but selected
 * elements stay faintly visible outside their time window so they can be
 * found and edited.
 */
export function cleanEditorItems(
  slide: Slide,
  time: number,
  selectedIds: string[],
  rectAt: RectFn,
  arrowAt: ArrowFn
): CleanItem[] {
  const selected = new Set(selectedIds);
  const shown: Slide = {
    ...slide,
    elements: slide.elements.map((e) => {
      if (!selected.has(e.id) || cleanFade(e.timing, time).opacity >= 0.35) return e;
      return { ...e, timing: ALWAYS, opacity: 0.35 } as SlideElement;
    }),
  };
  return cleanItemsAt(shown, time, 1, rectAt, arrowAt);
}

/** Every picture a clean slide draws, for preloading. */
export function cleanImageUrls(slide: Slide): string[] {
  const urls: string[] = [];
  for (const el of slide.elements) {
    if (el.kind === "image") urls.push(el.imageUrl);
    else if (el.kind === "svg") urls.push(el.svgUrl);
  }
  return urls;
}

// ---- Canvas drawing (video export) -----------------------------------------

export interface CleanCamera {
  /** Player-space translate in percent, and scale (CSS: translate then scale about center). */
  x: number;
  y: number;
  scale: number;
}

function fontWeightNum(w: "normal" | "semibold" | "bold"): number {
  return w === "semibold" ? 600 : w === "bold" ? 700 : 400;
}

/** Greedy word wrap within `maxWidth`, honouring explicit line breaks. */
export function wrapLines(
  ctx: Pick<CanvasRenderingContext2D, "measureText">,
  text: string,
  maxWidth: number
): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = words[0];
    for (const w of words.slice(1)) {
      const next = `${line} ${w}`;
      if (ctx.measureText(next).width <= maxWidth) line = next;
      else {
        out.push(line);
        line = w;
      }
    }
    out.push(line);
  }
  return out;
}

function shapePath(
  ctx: CanvasRenderingContext2D,
  shape: ShapeKind,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  if (shape === "circle") {
    ctx.arc(x + w / 2, y + w / 2, w / 2, 0, Math.PI * 2);
  } else if (shape === "oval") {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else if (radius > 0 && typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, Math.min(radius, w / 2, h / 2));
  } else {
    ctx.rect(x, y, w, h);
  }
}

export type CleanImageSource = CanvasImageSource & { width: number; height: number };

/**
 * Draw a clean frame (background plus items) onto a canvas of W×H, through the
 * camera, at an overall opacity. Images missing from `images` are skipped.
 */
export function drawCleanFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  frame: CleanFrame,
  camera: CleanCamera,
  alpha: number,
  images: Map<string, CleanImageSource>,
  fontFamily = "sans-serif"
) {
  if (alpha <= 0) return;
  const u = W / 100; // one percent of canvas width, in pixels
  const v = H / 100;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = frame.background;
  ctx.fillRect(0, 0, W, H);
  // CSS `translate(x%, y%) scale(s)` about the center.
  ctx.translate(W / 2 + camera.x * u, H / 2 + camera.y * v);
  ctx.scale(camera.scale, camera.scale);
  ctx.translate(-W / 2, -H / 2);

  for (const it of frame.items) {
    ctx.save();
    ctx.globalAlpha = alpha * it.opacity;
    const dy = it.rise * u;
    if (it.kind === "spotlight") {
      const r = it.rect;
      ctx.beginPath();
      if (it.within) ctx.rect(it.within.x * u, it.within.y * v, it.within.w * u, it.within.h * v);
      else ctx.rect(-W, -H, W * 3, H * 3);
      shapePath(ctx, it.shape, r.x * u, r.y * v, r.w * u, r.h * v, 0);
      ctx.fillStyle = `rgba(${CLEAN.dimRgb}, ${it.dim})`;
      ctx.fill("evenodd");
    } else if (it.kind === "shape") {
      const r = it.rect;
      const radius = (it.radius ?? 0) * u;
      ctx.beginPath();
      shapePath(ctx, it.shape, r.x * u, r.y * v + dy, r.w * u, r.h * v, radius);
      if (it.fill) {
        ctx.fillStyle = it.fill;
        ctx.fill();
      }
      if (it.stroke.width > 0) {
        ctx.lineWidth = it.stroke.width * CLEAN.strokeUnit * u;
        ctx.strokeStyle = it.stroke.color;
        const lw = ctx.lineWidth;
        ctx.setLineDash(
          it.stroke.style === "dashed"
            ? [lw * 3, lw * 2]
            : it.stroke.style === "dotted"
              ? [lw, lw * 1.5]
              : []
        );
        ctx.stroke();
      }
    } else if (it.kind === "image") {
      const img = images.get(it.url);
      const r = it.rect;
      if (img && img.width > 0) {
        // object-fit: cover inside the box.
        const bw = r.w * u;
        const bh = r.h * v;
        const s = Math.max(bw / img.width, bh / img.height);
        const sw = bw / s;
        const sh = bh / s;
        ctx.beginPath();
        ctx.rect(r.x * u, r.y * v + dy, bw, bh);
        ctx.clip();
        ctx.drawImage(
          img,
          (img.width - sw) / 2,
          (img.height - sh) / 2,
          sw,
          sh,
          r.x * u,
          r.y * v + dy,
          bw,
          bh
        );
      }
    } else if (it.kind === "arrow") {
      const x1 = it.from.x * u;
      const y1 = it.from.y * v;
      const x2 = it.to.x * u;
      const y2 = it.to.y * v;
      const lw = it.strokeWidth * CLEAN.strokeUnit * u;
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const head = Math.max(lw * 3, it.headSize * CLEAN.strokeUnit * u);
      ctx.strokeStyle = it.color;
      ctx.fillStyle = it.color;
      ctx.lineWidth = lw;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2 - Math.cos(ang) * head * 0.8, y2 - Math.sin(ang) * head * 0.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - Math.cos(ang - 0.45) * head, y2 - Math.sin(ang - 0.45) * head);
      ctx.lineTo(x2 - Math.cos(ang + 0.45) * head, y2 - Math.sin(ang + 0.45) * head);
      ctx.closePath();
      ctx.fill();
    } else if (it.kind === "text") {
      const r = it.rect;
      const size = it.fontSize * CLEAN.cqwPerRem * u;
      ctx.font = `${fontWeightNum(it.fontWeight)} ${size}px ${fontFamily}`;
      ctx.textBaseline = "top";
      const pad = it.background ? 0.6 * u : 0;
      const lines = wrapLines(ctx, it.text, r.w * u - pad * 2);
      const lh = size * CLEAN.lineHeight;
      const x0 = r.x * u;
      const y0 = r.y * v + dy;
      if (it.background) {
        ctx.fillStyle = it.background;
        ctx.beginPath();
        shapePath(
          ctx,
          "rectangle",
          x0,
          y0,
          r.w * u,
          Math.max(r.h * v, lines.length * lh + pad * 2),
          0.5 * u
        );
        ctx.fill();
      }
      ctx.fillStyle = it.color;
      ctx.textAlign = it.align;
      const tx =
        it.align === "center"
          ? x0 + (r.w * u) / 2
          : it.align === "right"
            ? x0 + r.w * u - pad
            : x0 + pad;
      let remaining = it.chars ?? Infinity;
      lines.forEach((line, i) => {
        if (remaining <= 0) return;
        const shown = line.slice(0, remaining);
        remaining -= line.length + 1;
        // Half-leading so text sits like CSS line-height.
        ctx.fillText(shown, tx, y0 + pad + i * lh + (lh - size) / 2);
      });
    }
    ctx.restore();
  }
  ctx.restore();
}
