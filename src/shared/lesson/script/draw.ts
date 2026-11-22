// Draws a script lesson frame on a 2D canvas, for video export. It mirrors the
// layout of ScriptStage (the HTML player) unit for unit: every size is in
// percent of the frame width ("u" here, "cqw" there), and it uses the same
// fixed motion, so an exported video matches what plays on the site.
//
// Pure apart from the canvas it is handed: works in the browser and in Node
// (with a canvas library), given images that have already loaded.

import type { CaptionChunk } from "@/shared/types/explainer";
import {
  MOTION,
  NO_ZOOM,
  fadeIn,
  fadeWindow,
  lerpZoom,
  zoomTarget,
  type ZoomTarget,
} from "./motion";
import { locate, type SceneTiming, type ScriptTimeline } from "./timeline";
import type { ImageRegion, Scene, SceneImage, ScriptLesson } from "./types";

/** Same palette as STAGE_THEME in script-stage.tsx. */
export const DRAW_THEME = {
  background: "#FBFAF7",
  ink: "#14212B",
  inkSoft: "#33434F",
  accent: "#1C7D88",
  accentSoft: "#E3F0F1",
  mark: "#F4BE1A",
  dim: "rgba(12, 20, 28, 0.62)",
} as const;
const T = DRAW_THEME;

const PAD_X = 6;
const HEADING_TOP = 4.6;
const CONTENT_TOP = 13;
const STAGE_H = 56.25;

/** The subset of CanvasRenderingContext2D this renderer uses. */
export type Ctx2D = Pick<
  CanvasRenderingContext2D,
  | "save"
  | "restore"
  | "translate"
  | "scale"
  | "beginPath"
  | "closePath"
  | "moveTo"
  | "lineTo"
  | "arc"
  | "arcTo"
  | "ellipse"
  | "rect"
  | "fill"
  | "stroke"
  | "clip"
  | "fillRect"
  | "fillText"
  | "measureText"
  | "drawImage"
> & {
  globalAlpha: number;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
};

/** Anything drawImage accepts that has a size. */
export type DrawableImage = CanvasImageSource & { width: number; height: number };

export interface DrawOptions {
  /** Font family list for all text. */
  fontFamily?: string;
  /** Caption chunks to draw along the bottom (as the player does with CC on). */
  captions?: CaptionChunk[] | null;
}

const DEFAULT_FONT =
  '"Instrument Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

interface Env {
  ctx: Ctx2D;
  u: number;
  images: Map<string, DrawableImage>;
  family: string;
}

// ---- Text helpers ------------------------------------------------------------

function setFont(env: Env, size: number, weight: 400 | 600) {
  env.ctx.font = `${weight} ${size * env.u}px ${env.family}`;
}

/** Break text into lines that fit `maxW` (in u) with the current font. */
function wrap(env: Env, text: string, maxW: number): string[] {
  const max = maxW * env.u;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const tryLine = line ? `${line} ${word}` : word;
    if (line && env.ctx.measureText(tryLine).width > max) {
      lines.push(line);
      line = word;
    } else {
      line = tryLine;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

interface TextBlock {
  lines: string[];
  size: number;
  weight: 400 | 600;
  lineHeight: number;
  height: number;
}

function block(
  env: Env,
  text: string,
  maxW: number,
  size: number,
  weight: 400 | 600,
  lineHeight = 1.2
): TextBlock {
  setFont(env, size, weight);
  const lines = wrap(env, text, maxW);
  return { lines, size, weight, lineHeight, height: lines.length * size * lineHeight };
}

/** Draw a text block with its top-left at (x, y), in u. */
function drawBlock(
  env: Env,
  b: TextBlock,
  x: number,
  y: number,
  color: string,
  letterSpacingEm = 0
) {
  const { ctx, u } = env;
  setFont(env, b.size, b.weight);
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const lh = b.size * b.lineHeight;
  b.lines.forEach((line, i) => {
    const cy = (y + i * lh + lh / 2) * u;
    if (!letterSpacingEm) {
      ctx.fillText(line, x * u, cy);
      return;
    }
    // Manual tracking (canvas letterSpacing isn't everywhere yet).
    let cx = x * u;
    for (const ch of line) {
      ctx.fillText(ch, cx, cy);
      cx += ctx.measureText(ch).width + letterSpacingEm * b.size * u;
    }
  });
}

function roundRect(env: Env, x: number, y: number, w: number, h: number, r: number) {
  const { ctx, u } = env;
  const X = x * u,
    Y = y * u,
    W = w * u,
    H = h * u;
  const R = Math.min(r * u, W / 2, H / 2);
  ctx.beginPath();
  ctx.moveTo(X + R, Y);
  ctx.arcTo(X + W, Y, X + W, Y + H, R);
  ctx.arcTo(X + W, Y + H, X, Y + H, R);
  ctx.arcTo(X, Y + H, X, Y, R);
  ctx.arcTo(X, Y, X + W, Y, R);
  ctx.closePath();
}

function circle(env: Env, cx: number, cy: number, r: number) {
  env.ctx.beginPath();
  env.ctx.arc(cx * env.u, cy * env.u, r * env.u, 0, Math.PI * 2);
}

/** Run `fn` faded in by `p`: lower opacity and the small rise (as fadeStyle does). */
function faded(env: Env, p: number, fn: () => void) {
  if (p <= 0) return;
  const { ctx, u } = env;
  ctx.save();
  ctx.globalAlpha *= p;
  if (p < 1) ctx.translate(0, (1 - p) * MOTION.rise * u);
  fn();
  ctx.restore();
}

function windows(timing: SceneTiming): Array<{ start: number; end: number | null }> {
  return timing.beats.map((b, k) => ({
    start: b.start,
    end: k + 1 < timing.beats.length ? timing.beats[k + 1].start : null,
  }));
}

function heading(env: Env, text: string | undefined) {
  if (!text) return;
  const b = block(env, text, 100 - 2 * PAD_X, 3.3, 600, 1.15);
  drawBlock(env, b, PAD_X, HEADING_TOP, T.ink, -0.01);
}

function numberBadge(
  env: Env,
  cx: number,
  cy: number,
  d: number,
  n: number,
  filled: boolean,
  size: number,
  border: number
) {
  const { ctx, u } = env;
  circle(env, cx, cy, d / 2 - border / 2);
  if (filled) {
    ctx.fillStyle = T.accent;
    ctx.fill();
  }
  ctx.lineWidth = border * u;
  ctx.strokeStyle = T.accent;
  ctx.stroke();
  setFont(env, size, 600);
  ctx.fillStyle = filled ? "#FFFFFF" : T.accent;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(n), cx * u, cy * u + size * u * 0.04);
}

// ---- Templates ---------------------------------------------------------------

function drawTitle(env: Env, scene: Scene, timing: SceneTiming, local: number) {
  const left = PAD_X + 2;
  const width = 100 - left - (PAD_X + 6);
  const head = block(env, scene.heading ?? "", width, 5.4, 600, 1.08);
  const subs = scene.beats
    .map((b, k) => ({ b, w: timing.beats[k] }))
    .filter(({ b }) => b.text?.trim())
    .map(({ b, w }) => ({ w, blk: block(env, b.text!, width, 2.4, 400, 1.3) }));
  const total = 0.4 + 2.2 + head.height + subs.reduce((n, s) => n + 1.6 + s.blk.height, 0);
  let y = (STAGE_H - total) / 2;
  roundRect(env, left, y, 6, 0.4, 0.2);
  env.ctx.fillStyle = T.accent;
  env.ctx.fill();
  y += 0.4 + 2.2;
  drawBlock(env, head, left, y, T.ink, -0.02);
  y += head.height;
  for (const s of subs) {
    y += 1.6;
    const at = y;
    faded(env, fadeIn(local, s.w.start), () => drawBlock(env, s.blk, left, at, T.inkSoft));
    y += s.blk.height;
  }
  const brand = block(env, "Pathology Bites", width, 1.2, 600, 1.2);
  drawBlock(env, brand, left, STAGE_H - 4 - brand.height, T.accent);
}

function imageAspect(img: DrawableImage | undefined, meta: SceneImage | undefined): number {
  if (meta?.width && meta?.height) return meta.width / meta.height;
  if (img && img.width && img.height) return img.width / img.height;
  return 4 / 3;
}

function drawRegion(
  env: Env,
  region: ImageRegion,
  kind: "ring" | "spotlight",
  n: number | null,
  p: number,
  boxW: number,
  boxH: number,
  scale: number
) {
  const { ctx, u } = env;
  const x = (region.x / 100) * boxW;
  const y = (region.y / 100) * boxH;
  const w = (region.w / 100) * boxW;
  const h = (region.h / 100) * boxH;
  ctx.save();
  ctx.globalAlpha *= p;
  const stroke = 0.3 / scale;
  if (kind === "spotlight") {
    const r = 0.6 / scale;
    // Dim everything outside the region (inside the clipped picture box).
    ctx.beginPath();
    ctx.rect(-boxW * u * 4, -boxH * u * 4, boxW * u * 9, boxH * u * 9);
    roundRectPath(env, x, y, w, h, r, true);
    ctx.fillStyle = T.dim;
    (ctx as CanvasRenderingContext2D).fill("evenodd");
    roundRect(env, x - stroke / 2, y - stroke / 2, w + stroke, h + stroke, r + stroke / 2);
    ctx.lineWidth = stroke * u;
    ctx.strokeStyle = T.mark;
    ctx.stroke();
    ctx.restore();
    return;
  }
  const cx = (x + w / 2) * u;
  const cy = (y + h / 2) * u;
  const rx = Math.max(0.1, (w / 2 - stroke / 2) * u);
  const ry = Math.max(0.1, (h / 2 - stroke / 2) * u);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.lineWidth = (stroke + 0.24 / scale) * u;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.stroke();
  ctx.lineWidth = stroke * u;
  ctx.strokeStyle = T.mark;
  ctx.stroke();
  if (n != null) {
    const bx = x + w * 0.96;
    const by = y + h * 0.04;
    const r = 1 / scale;
    circle(env, bx, by, r + 0.1);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fill();
    circle(env, bx, by, r);
    ctx.fillStyle = T.mark;
    ctx.fill();
    setFont(env, 1.15 / scale, 600);
    ctx.fillStyle = T.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n), bx * u, by * u + (1.15 / scale) * u * 0.04);
  }
  ctx.restore();
}

/** Rounded-rect subpath (no beginPath), optionally wound the other way. */
function roundRectPath(
  env: Env,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  reverse: boolean
) {
  const { ctx, u } = env;
  const X = x * u,
    Y = y * u,
    W = w * u,
    H = h * u;
  const R = Math.min(r * u, W / 2, H / 2);
  if (!reverse) {
    ctx.moveTo(X + R, Y);
    ctx.arcTo(X + W, Y, X + W, Y + H, R);
    ctx.arcTo(X + W, Y + H, X, Y + H, R);
    ctx.arcTo(X, Y + H, X, Y, R);
    ctx.arcTo(X, Y, X + W, Y, R);
  } else {
    ctx.moveTo(X + R, Y);
    ctx.arcTo(X, Y, X, Y + H, R);
    ctx.arcTo(X, Y + H, X + W, Y + H, R);
    ctx.arcTo(X + W, Y + H, X + W, Y, R);
    ctx.arcTo(X + W, Y, X, Y, R);
  }
  ctx.closePath();
}

function drawImageScene(
  env: Env,
  scene: Scene,
  timing: SceneTiming,
  local: number,
  motion: number
) {
  const { ctx, u } = env;
  const wins = windows(timing);
  const img = scene.image?.url ? env.images.get(scene.image.url) : undefined;
  const aspect = imageAspect(img, scene.image);
  const maxW = 58;
  const maxH = STAGE_H - CONTENT_TOP - 6;
  let boxW = maxW;
  let boxH = boxW / aspect;
  if (boxH > maxH) {
    boxH = maxH;
    boxW = boxH * aspect;
  }
  const listLeft = PAD_X + boxW + 3.5;

  let zoom: ZoomTarget = NO_ZOOM;
  if (motion > 0) {
    scene.beats.forEach((b, k) => {
      if (b.mark !== "zoom" || !b.region) return;
      const w = wins[k];
      if (local < w.start) return;
      const amount =
        fadeIn(local, w.start, MOTION.zoom) *
        (w.end == null ? 1 : 1 - fadeIn(local, w.end, MOTION.zoom));
      zoom = lerpZoom(NO_ZOOM, zoomTarget(b.region), amount * motion);
    });
  }

  let number = 0;
  const items = scene.beats.map((b, k) => ({ b, k, n: b.region ? ++number : null }));
  let activeIndex = -1;
  wins.forEach((w, k) => {
    if (local >= w.start) activeIndex = k;
  });

  heading(env, scene.heading);

  // Picture box, clipped, with the camera inside it.
  ctx.save();
  roundRect(env, PAD_X, CONTENT_TOP, boxW, boxH, 0.8);
  ctx.fillStyle = T.ink;
  ctx.fill();
  ctx.clip();
  ctx.translate(PAD_X * u, CONTENT_TOP * u);
  ctx.translate((boxW / 2) * u, (boxH / 2) * u);
  ctx.scale(zoom.scale, zoom.scale);
  ctx.translate((zoom.tx / 100) * boxW * u, (zoom.ty / 100) * boxH * u);
  ctx.translate((-boxW / 2) * u, (-boxH / 2) * u);
  if (img) ctx.drawImage(img, 0, 0, boxW * u, boxH * u);
  for (const { b, k, n } of items) {
    if (!b.region) continue;
    const mark = motion > 0 ? (b.mark ?? "ring") : b.mark === "zoom" ? "ring" : (b.mark ?? "ring");
    if (mark === "zoom") continue;
    const p = fadeWindow(local, wins[k].start, wins[k].end);
    if (p <= 0) continue;
    drawRegion(env, b.region, mark, n, p, boxW, boxH, zoom.scale);
  }
  ctx.restore();

  if (scene.credit) {
    const c = block(env, scene.credit, boxW, 1.05, 400, 1.2);
    drawBlock(env, c, PAD_X, CONTENT_TOP + boxH + 0.8, T.inkSoft);
  }

  // Callout list beside the picture.
  const listW = 100 - PAD_X - listLeft;
  let y = CONTENT_TOP + 0.4;
  for (const { b, k, n } of items) {
    if (!b.text?.trim()) continue;
    const textX = n != null ? listLeft + 2.3 + 1 : listLeft;
    const textW = listW - (textX - listLeft);
    const main = block(env, b.text, textW, 1.9, n == null ? 600 : 400, 1.28);
    const detail = b.detail ? block(env, b.detail, textW, 1.5, 400, 1.2) : null;
    const textH = main.height + (detail ? 0.3 + detail.height : 0);
    const rowH = Math.max(n != null ? 2.35 : 0, textH);
    const top = y;
    faded(env, fadeIn(local, wins[k].start), () => {
      if (n != null)
        numberBadge(env, listLeft + 1.15, top + 0.05 + 1.15, 2.3, n, k === activeIndex, 1.3, 0.18);
      drawBlock(env, main, textX, top, T.ink);
      if (detail) drawBlock(env, detail, textX, top + main.height + 0.3, T.inkSoft);
    });
    y += rowH + 1.5;
  }
}

function drawCompare(env: Env, scene: Scene, timing: SceneTiming, local: number) {
  const { ctx, u } = env;
  const wins = windows(timing);
  const all = scene.beats.map((b, k) => ({ b, w: wins[k] }));
  const hasImages = scene.beats.some((b) => b.side && b.image?.url);
  const gap = 3.5;
  const panelW = (100 - 2 * PAD_X - gap) / 2;
  const padX = hasImages ? 0 : 2.4;
  const padY = hasImages ? 0 : 2.2;

  const layout = (items: typeof all) => {
    const image = items.find(({ b }) => b.image?.url)?.b.image;
    const imgH = image ? panelW / (16 / 9) + 1.4 : 0;
    const rows = items.map(({ b, w }, idx) => {
      const textW = panelW - 2 * padX;
      const t = b.text ? block(env, b.text, textW, idx === 0 ? 2.5 : 2, 600, 1.2) : null;
      const d = b.detail ? block(env, b.detail, textW, 2, 400, 1.32) : null;
      const h = (t?.height ?? 0) + (d ? 0.6 + d.height : 0);
      return { b, w, idx, t, d, h };
    });
    const content = rows.reduce((n, r) => n + r.h + (r.idx > 0 ? 1.2 : 0), 0);
    const boxH = hasImages ? content : Math.max(15, content + 2 * padY);
    return { image, imgH, rows, boxH, height: imgH + boxH };
  };

  const left = layout(all.filter(({ b }) => b.side === "left"));
  const right = layout(all.filter(({ b }) => b.side === "right"));
  const rowH = Math.max(left.height, right.height);

  heading(env, scene.heading);

  const drawPanel = (pl: ReturnType<typeof layout>, x: number) => {
    const first = pl.rows[0];
    if (!first) return;
    faded(env, fadeIn(local, first.w.start), () => {
      let y = CONTENT_TOP;
      if (pl.image) {
        const img = env.images.get(pl.image.url);
        const h = panelW / (16 / 9);
        ctx.save();
        roundRect(env, x, y, panelW, h, 0.8);
        ctx.fillStyle = T.ink;
        ctx.fill();
        ctx.clip();
        if (img) {
          // object-fit: cover
          const ia = img.width / img.height;
          const ba = panelW / h;
          let dw = panelW,
            dh = h;
          if (ia > ba) dw = h * ia;
          else dh = panelW / ia;
          ctx.drawImage(img, (x - (dw - panelW) / 2) * u, (y - (dh - h) / 2) * u, dw * u, dh * u);
        }
        ctx.restore();
        y += pl.imgH;
      }
      if (!hasImages) {
        roundRect(env, x, y, panelW, pl.boxH, 1);
        ctx.fillStyle = T.accentSoft;
        ctx.fill();
      }
      let ty = y + padY;
      for (const r of pl.rows) {
        if (r.idx > 0) ty += 1.2;
        const top = ty;
        faded(env, r.idx === 0 ? 1 : fadeIn(local, r.w.start), () => {
          if (r.t) drawBlock(env, r.t, x + padX, top, r.idx === 0 ? T.accent : T.ink);
          if (r.d) drawBlock(env, r.d, x + padX, top + (r.t?.height ?? 0) + 0.6, T.ink);
        });
        ty += r.h;
      }
    });
  };

  drawPanel(left, PAD_X);
  drawPanel(right, PAD_X + panelW + gap);

  let y = CONTENT_TOP + rowH + 2.6;
  for (const { b, w } of all) {
    if (b.side || !b.text?.trim()) continue;
    const t = block(env, b.text, 100 - 2 * PAD_X, 2.3, 600, 1.25);
    const d = b.detail ? block(env, b.detail, 100 - 2 * PAD_X, 1.8, 400, 1.2) : null;
    const top = y;
    faded(env, fadeIn(local, w.start), () => {
      drawBlock(env, t, PAD_X, top, T.ink);
      if (d) drawBlock(env, d, PAD_X, top + t.height + 0.4, T.inkSoft);
    });
    y += t.height + (d ? 0.4 + d.height : 0) + 2.6;
  }
}

function drawLadder(env: Env, scene: Scene, timing: SceneTiming, local: number) {
  const { ctx } = env;
  const wins = windows(timing);
  const rungs = scene.beats.map((b, k) => ({ b, k })).filter(({ b }) => b.text?.trim());
  const d = rungs.length <= 4 ? 1 : rungs.length === 5 ? 0.92 : 0.84;
  const rungEnd = (idx: number) => (idx + 1 < rungs.length ? wins[rungs[idx + 1].k].start : null);
  const width = 100 - 2 * PAD_X;
  const circleD = 2.8 * d;
  const textX = PAD_X + 1.4 + circleD + 1.6;
  const textW = width - 1.4 * 2 - circleD - 1.6;

  heading(env, scene.heading);
  let y = CONTENT_TOP;
  rungs.forEach(({ b, k }, idx) => {
    const start = wins[k].start;
    const active = fadeWindow(local, start, rungEnd(idx));
    const reached = local >= start;
    const t = block(env, b.text!, textW, 2.2 * d, 600, 1.2);
    const det = b.detail ? block(env, b.detail, textW, 1.75 * d, 400, 1.3) : null;
    const textH = t.height + (det ? 0.25 + det.height : 0);
    const inner = Math.max(circleD, textH);
    const rowH = inner + 2 * 0.9 * d;
    const top = y;
    faded(env, fadeIn(local, start), () => {
      if (active > 0) {
        ctx.save();
        ctx.globalAlpha *= active;
        roundRect(env, PAD_X, top, width, rowH, 0.8);
        ctx.fillStyle = T.accentSoft;
        ctx.fill();
        ctx.restore();
      }
      const midY = top + rowH / 2;
      numberBadge(
        env,
        PAD_X + 1.4 + circleD / 2,
        midY,
        circleD,
        idx + 1,
        reached && active > 0.5,
        1.45 * d,
        0.2
      );
      const textTop = midY - textH / 2;
      drawBlock(env, t, textX, textTop, T.ink);
      if (det) drawBlock(env, det, textX, textTop + t.height + 0.25, T.inkSoft);
    });
    y += rowH + 0.9 * d;
  });
}

function drawTakeHome(env: Env, scene: Scene, timing: SceneTiming, local: number) {
  const { ctx } = env;
  const wins = windows(timing);
  const left = PAD_X + 0.4;
  const width = 100 - left - (PAD_X + 4);
  const textX = left + 1 + 1.8;
  const textW = width - 1 - 1.8;
  heading(env, scene.heading);
  let y = CONTENT_TOP + 2;
  for (const [k, b] of scene.beats.entries()) {
    if (!b.text?.trim()) continue;
    const t = block(env, b.text, textW, 2.8, 600, 1.22);
    const det = b.detail ? block(env, b.detail, textW, 2, 400, 1.3) : null;
    const top = y;
    faded(env, fadeIn(local, wins[k].start), () => {
      circle(env, left + 0.5, top + 1.05 + 0.5, 0.5);
      ctx.fillStyle = T.accent;
      ctx.fill();
      drawBlock(env, t, textX, top, T.ink);
      if (det) drawBlock(env, det, textX, top + t.height + 0.5, T.inkSoft);
    });
    y += t.height + (det ? 0.5 + det.height : 0) + 2.4;
  }
}

function drawScene(env: Env, scene: Scene, timing: SceneTiming, local: number, motion: number) {
  switch (scene.template) {
    case "title":
      return drawTitle(env, scene, timing, local);
    case "image":
      return drawImageScene(env, scene, timing, local, motion);
    case "compare":
      return drawCompare(env, scene, timing, local);
    case "ladder":
      return drawLadder(env, scene, timing, local);
    case "takehome":
    default:
      return drawTakeHome(env, scene, timing, local);
  }
}

function drawCaption(env: Env, text: string) {
  const { ctx, u } = env;
  const b = block(env, text, 70, 1.9, 400, 1.3);
  setFont(env, 1.9, 400);
  const w = Math.max(...b.lines.map((l) => ctx.measureText(l).width)) / u + 2.4;
  const h = b.height + 1.2;
  const x = (100 - w) / 2;
  const y = STAGE_H - 2.2 - h;
  roundRect(env, x, y, w, h, 0.6);
  ctx.fillStyle = "rgba(20, 33, 43, 0.82)";
  ctx.fill();
  setFont(env, 1.9, 400);
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  b.lines.forEach((line, i) => {
    ctx.fillText(line, 50 * u, (y + 0.6 + i * 1.9 * 1.3 + 0.95 * 1.3) * u);
  });
}

/**
 * Draw the frame at absolute time `time` onto a canvas of width W (height is
 * W × 9/16). `images` maps each picture URL to a loaded image.
 */
export function drawScriptFrame(
  ctx: Ctx2D,
  W: number,
  lesson: ScriptLesson,
  timeline: ScriptTimeline,
  time: number,
  images: Map<string, DrawableImage>,
  opts: DrawOptions = {}
) {
  const env: Env = { ctx, u: W / 100, images, family: opts.fontFamily ?? DEFAULT_FONT };
  const H = (W * 9) / 16;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = T.background;
  ctx.fillRect(0, 0, W, H);
  const pos = locate(timeline, time);
  if (pos.sceneIndex >= 0) {
    const i = pos.sceneIndex;
    const st = timeline.scenes[i];
    drawScene(env, lesson.scenes[i], st, pos.local, 1);
    const next = lesson.scenes[i + 1];
    const fadeStart = st.start + st.duration - MOTION.sceneFade;
    if (next && time >= fadeStart) {
      const p = fadeIn(time, fadeStart, MOTION.sceneFade);
      if (p > 0) {
        ctx.save();
        ctx.globalAlpha = p;
        ctx.fillStyle = T.background;
        ctx.fillRect(0, 0, W, H);
        drawScene(env, next, timeline.scenes[i + 1], 0, 1);
        ctx.restore();
      }
    }
  }
  const caption = opts.captions?.find((c) => time >= c.start && time < c.end);
  if (caption?.text.trim()) drawCaption(env, caption.text);
  ctx.restore();
}

export { scriptImageUrls } from "./timeline";
