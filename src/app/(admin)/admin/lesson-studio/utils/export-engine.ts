// Pure canvas rendering + interpolation helpers for the MP4 export pipeline.
// Extracted from export-dialog.tsx so the UI shell stays framework-agnostic
// and this math can be unit-tested in isolation.

import type {
  ExplainerSequence,
  Segment,
  Transform,
  HighlightRegion,
  ArrowPointer,
  TextOverlay,
  Keyframe,
} from "@/shared/types/explainer";
import { lerp } from "./math";

export const DEFAULT_TRANSFORM: Transform = { x: 0, y: 0, scale: 1 };

function lerpTransform(a: Transform, b: Transform, t: number): Transform {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), scale: lerp(a.scale, b.scale, t) };
}

function findKeyframePair(
  keyframes: Keyframe[],
  elapsed: number
): { kf1: Keyframe; kf2: Keyframe; t: number } {
  const empty: Keyframe = {
    time: 0,
    transform: DEFAULT_TRANSFORM,
    highlights: [],
    arrows: [],
    textOverlays: [],
  };
  if (keyframes.length === 0) return { kf1: empty, kf2: empty, t: 0 };
  if (keyframes.length === 1) return { kf1: keyframes[0], kf2: keyframes[0], t: 0 };
  if (elapsed >= keyframes[keyframes.length - 1].time) {
    const last = keyframes[keyframes.length - 1];
    return { kf1: last, kf2: last, t: 0 };
  }
  if (elapsed <= keyframes[0].time) return { kf1: keyframes[0], kf2: keyframes[0], t: 0 };
  for (let i = 0; i < keyframes.length - 1; i++) {
    const kf1 = keyframes[i],
      kf2 = keyframes[i + 1];
    if (elapsed >= kf1.time && elapsed <= kf2.time) {
      const span = kf2.time - kf1.time;
      return { kf1, kf2, t: span > 0 ? (elapsed - kf1.time) / span : 0 };
    }
  }
  const last = keyframes[keyframes.length - 1];
  return { kf1: last, kf2: last, t: 0 };
}

function lerpHighlight(a: HighlightRegion, b: HighlightRegion, t: number): HighlightRegion {
  return {
    ...b,
    position: { x: lerp(a.position.x, b.position.x, t), y: lerp(a.position.y, b.position.y, t) },
    size: {
      width: lerp(a.size.width, b.size.width, t),
      height: lerp(a.size.height, b.size.height, t),
    },
    opacity: lerp(a.opacity, b.opacity, t),
    borderWidth: lerp(a.borderWidth, b.borderWidth, t),
  };
}

function interpolateHighlights(kf1: Keyframe, kf2: Keyframe, t: number): HighlightRegion[] {
  const map1 = new Map(kf1.highlights.map((h) => [h.id, h]));
  const result: HighlightRegion[] = [];
  for (const h2 of kf2.highlights) {
    const h1 = map1.get(h2.id);
    result.push(h1 ? lerpHighlight(h1, h2, t) : { ...h2, opacity: h2.opacity * t });
  }
  for (const h1 of kf1.highlights) {
    if (!kf2.highlights.find((h) => h.id === h1.id))
      result.push({ ...h1, opacity: h1.opacity * (1 - t) });
  }
  return result;
}

function interpolateArrows(kf1: Keyframe, kf2: Keyframe, t: number): ArrowPointer[] {
  const map1 = new Map(kf1.arrows.map((a) => [a.id, a]));
  const result: ArrowPointer[] = [];
  for (const a2 of kf2.arrows) {
    const a1 = map1.get(a2.id);
    result.push({ ...a2, opacity: a1 ? lerp(a1.opacity, a2.opacity, t) : a2.opacity * t });
  }
  for (const a1 of kf1.arrows) {
    if (!kf2.arrows.find((a) => a.id === a1.id))
      result.push({ ...a1, opacity: a1.opacity * (1 - t) });
  }
  return result;
}

function interpolateTextOverlays(kf1: Keyframe, kf2: Keyframe, t: number): TextOverlay[] {
  const map1 = new Map(kf1.textOverlays.map((o) => [o.id, o]));
  const result: TextOverlay[] = [];
  for (const o2 of kf2.textOverlays) {
    const o1 = map1.get(o2.id);
    result.push({
      ...o2,
      computedOpacity: o1
        ? lerp(o1.computedOpacity ?? 1, o2.computedOpacity ?? 1, t)
        : lerp(0, o2.computedOpacity ?? 1, t),
    });
  }
  for (const o1 of kf1.textOverlays) {
    if (!kf2.textOverlays.find((o) => o.id === o1.id))
      result.push({ ...o1, computedOpacity: lerp(o1.computedOpacity ?? 1, 0, t) });
  }
  return result;
}

export interface FrameState {
  currentSegment: Segment | null;
  incomingSegment: Segment | null;
  interpolatedTransform: Transform;
  activeHighlights: HighlightRegion[];
  activeTextOverlays: TextOverlay[];
  activeArrows: ArrowPointer[];
  transitionOpacity: number;
  incomingOpacity: number;
}

export function computeFrameState(sequence: ExplainerSequence, currentTime: number): FrameState {
  const { segments } = sequence;
  if (segments.length === 0)
    return {
      currentSegment: null,
      incomingSegment: null,
      interpolatedTransform: DEFAULT_TRANSFORM,
      activeHighlights: [],
      activeTextOverlays: [],
      activeArrows: [],
      transitionOpacity: 1,
      incomingOpacity: 0,
    };
  let currentSegment: Segment | null = null,
    currentIndex = -1;
  for (let i = 0; i < segments.length; i++) {
    const isLast = i === segments.length - 1;
    if (
      isLast
        ? currentTime >= segments[i].startTime && currentTime <= segments[i].endTime
        : currentTime >= segments[i].startTime && currentTime < segments[i].endTime
    ) {
      currentSegment = segments[i];
      currentIndex = i;
      break;
    }
  }
  if (!currentSegment && currentTime >= (segments[segments.length - 1]?.endTime ?? 0)) {
    currentSegment = segments[segments.length - 1];
    currentIndex = segments.length - 1;
  }
  if (!currentSegment) {
    currentSegment = segments[0];
    currentIndex = 0;
  }
  let incomingSegment: Segment | null = null,
    transitionOpacity = 1,
    incomingOpacity = 0;
  if (currentSegment && currentIndex < segments.length - 1) {
    const nextSegment = segments[currentIndex + 1];
    const transitionStart = currentSegment.endTime - currentSegment.transitionDuration;
    if (
      currentTime >= transitionStart &&
      currentTime < currentSegment.endTime &&
      currentSegment.transition === "crossfade"
    ) {
      incomingSegment = nextSegment;
      incomingOpacity = Math.max(
        0,
        Math.min(1, (currentTime - transitionStart) / currentSegment.transitionDuration)
      );
    }
  }
  if (currentSegment?.transition === "fade-to-black" && currentIndex < segments.length - 1) {
    const transitionStart = currentSegment.endTime - currentSegment.transitionDuration;
    if (currentTime >= transitionStart && currentTime < currentSegment.endTime) {
      const p = (currentTime - transitionStart) / currentSegment.transitionDuration;
      transitionOpacity = p <= 0.5 ? 1 - p * 2 : (p - 0.5) * 2;
      if (p > 0.5) incomingSegment = segments[currentIndex + 1];
    }
  }
  const elapsed = currentTime - currentSegment.startTime;
  const { kf1, kf2, t } = findKeyframePair(currentSegment.keyframes, elapsed);
  return {
    currentSegment,
    incomingSegment,
    interpolatedTransform: lerpTransform(kf1.transform, kf2.transform, t),
    activeHighlights: interpolateHighlights(kf1, kf2, t).filter((h) => h.opacity > 0.01),
    activeTextOverlays: interpolateTextOverlays(kf1, kf2, t).filter(
      (o) => (o.computedOpacity ?? 1) > 0.01
    ),
    activeArrows: interpolateArrows(kf1, kf2, t).filter((a) => a.opacity > 0.01),
    transitionOpacity,
    incomingOpacity,
  };
}

export function drawExportFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  state: FrameState,
  images: Map<string, HTMLImageElement>
) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  function drawSegmentImage(seg: Segment, transform: Transform, opacity: number) {
    const img = images.get(seg.imageUrl);
    if (!img || !img.complete) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(W / 2, H / 2);
    ctx.scale(transform.scale, transform.scale);
    ctx.translate((transform.x / 100) * W, (transform.y / 100) * H);
    ctx.drawImage(img, -W / 2, -H / 2, W, H);
    ctx.restore();
  }

  if (state.currentSegment)
    drawSegmentImage(state.currentSegment, state.interpolatedTransform, state.transitionOpacity);
  if (state.incomingSegment && state.incomingOpacity > 0)
    drawSegmentImage(
      state.incomingSegment,
      state.incomingSegment.keyframes[0]?.transform ?? DEFAULT_TRANSFORM,
      state.incomingOpacity
    );

  const spotlights = state.activeHighlights.filter((h) => h.spotlight);
  if (spotlights.length > 0) {
    const maxOpacity = Math.max(...spotlights.map((h) => h.opacity));
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = W;
    tmpCanvas.height = H;
    const tmp = tmpCanvas.getContext("2d")!;
    tmp.fillStyle = "rgba(0,0,0,1)";
    tmp.fillRect(0, 0, W, H);
    tmp.globalCompositeOperation = "destination-out";
    for (const hl of spotlights) {
      const cx = (hl.position.x / 100) * W,
        cy = (hl.position.y / 100) * H,
        hw = (hl.size.width / 100) * W,
        hh = (hl.size.height / 100) * H;
      tmp.filter = `blur(${Math.max(1, ((hw + hh) / 2) * 0.04)}px)`;
      tmp.beginPath();
      if (hl.type === "circle") tmp.arc(cx, cy, hw / 2, 0, Math.PI * 2);
      else if (hl.type === "oval") tmp.ellipse(cx, cy, hw / 2, hh / 2, 0, 0, Math.PI * 2);
      else tmp.rect(cx - hw / 2, cy - hh / 2, hw, hh);
      tmp.fill();
    }
    tmp.filter = "none";
    ctx.save();
    ctx.globalAlpha = 0.5 * maxOpacity;
    ctx.drawImage(tmpCanvas, 0, 0);
    ctx.restore();
  }

  for (const hl of state.activeHighlights.filter((h) => !h.spotlight)) {
    ctx.save();
    ctx.globalAlpha = hl.opacity;
    ctx.strokeStyle = hl.borderColor;
    ctx.lineWidth = hl.borderWidth * (H / 450) + 1.5 * (H / 1080);
    ctx.setLineDash(
      hl.borderStyle === "dashed" ? [12, 8] : hl.borderStyle === "dotted" ? [2, 6] : []
    );
    const cx = (hl.position.x / 100) * W,
      cy = (hl.position.y / 100) * H,
      hw = (hl.size.width / 100) * W,
      hh = (hl.size.height / 100) * H;
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 8 * (H / 1080);
    ctx.shadowOffsetY = 2 * (H / 1080);
    ctx.beginPath();
    if (hl.type === "circle") ctx.arc(cx, cy, hw / 2, 0, Math.PI * 2);
    else if (hl.type === "oval") ctx.ellipse(cx, cy, hw / 2, hh / 2, 0, 0, Math.PI * 2);
    else ctx.roundRect(cx - hw / 2, cy - hh / 2, hw, hh, 4 * (H / 1080));
    ctx.stroke();
    ctx.restore();
  }

  for (const arrow of state.activeArrows) {
    ctx.save();
    ctx.globalAlpha = arrow.opacity;
    const x1 = (arrow.startPosition.x / 100) * W,
      y1 = (arrow.startPosition.y / 100) * H;
    const x2 = (arrow.endPosition.x / 100) * W,
      y2 = (arrow.endPosition.y / 100) * H;
    const strokeW = (arrow.strokeWidth ?? 3) * (H / 450);
    const headSize = 10 * strokeW; // arrowhead size proportional to stroke

    // Draw line
    ctx.strokeStyle = arrow.color;
    ctx.lineWidth = strokeW;
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 4 * (H / 450);
    ctx.shadowOffsetY = 1 * (H / 450);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Draw arrowhead
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.fillStyle = arrow.color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headSize * Math.cos(angle - Math.PI / 7),
      y2 - headSize * Math.sin(angle - Math.PI / 7)
    );
    ctx.lineTo(
      x2 - headSize * Math.cos(angle + Math.PI / 7),
      y2 - headSize * Math.sin(angle + Math.PI / 7)
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  const DOM_VIEWPORT_H = 450;
  for (const o of state.activeTextOverlays) {
    ctx.save();
    ctx.globalAlpha = o.computedOpacity ?? 1;
    const fontSize = o.fontSize * 16 * (H / DOM_VIEWPORT_H);
    const weight =
      o.fontWeight === "bold" ? "bold" : o.fontWeight === "semibold" ? "600" : "normal";
    ctx.font = `${weight} ${fontSize}px sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = (o.textAlign as CanvasTextAlign) ?? "left";
    const x = (o.position.x / 100) * W,
      y = (o.position.y / 100) * H;
    const maxPx = o.maxWidth ? (o.maxWidth / 100) * W : W * 0.9;
    const words = o.text.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxPx && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    const lineHeight = fontSize * 1.3,
      totalH = lines.length * lineHeight,
      pad = fontSize * 0.25;
    if (o.backgroundColor) {
      const maxLineW = Math.max(...lines.map((l) => ctx.measureText(l).width));
      const alignOffsetX =
        ctx.textAlign === "center" ? -maxLineW / 2 : ctx.textAlign === "right" ? -maxLineW : 0;
      ctx.fillStyle = o.backgroundColor;
      ctx.beginPath();
      ctx.roundRect(
        x + alignOffsetX - pad,
        y - totalH / 2 - pad,
        maxLineW + pad * 2,
        totalH + pad * 2,
        4 * (H / 1080)
      );
      ctx.fill();
    }
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 4 * (H / 1080);
    ctx.shadowOffsetY = 1 * (H / 1080);
    ctx.fillStyle = o.color;
    lines.forEach((l, i) => ctx.fillText(l, x, y - totalH / 2 + lineHeight * i + lineHeight / 2));
    ctx.restore();
  }
}
