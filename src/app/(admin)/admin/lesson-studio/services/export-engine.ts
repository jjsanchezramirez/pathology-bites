import type {
  ExplainerSequence,
  Segment,
  Transform,
  HighlightRegion,
  ArrowPointer,
  TextOverlay,
} from "@/shared/types/explainer";
import {
  DEFAULT_TRANSFORM,
  findKeyframePair,
  lerpTransform,
  interpolateHighlights,
  interpolateArrows,
  interpolateTextOverlays,
} from "../utils/interpolation";

// ---------------------------------------------------------------------------
// Canvas export engine (same logic as /test/video-export, inlined here so the
// studio has no extra dependencies and works self-contained in production)
// ---------------------------------------------------------------------------

interface FrameState {
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
    const cx = (arrow.endPosition.x / 100) * W,
      cy = (arrow.endPosition.y / 100) * H;
    const iconSize = 48 * (H / 450),
      strokeW = 6 * (H / 450);
    const dirAngles: Record<string, number> = {
      right: 0,
      "down-right": Math.PI / 4,
      down: Math.PI / 2,
      "down-left": (3 * Math.PI) / 4,
      left: Math.PI,
      "up-left": (5 * Math.PI) / 4,
      up: (3 * Math.PI) / 2,
      "up-right": (7 * Math.PI) / 4,
    };
    const angle = dirAngles[arrow.direction] ?? Math.PI / 2;
    const pad = Math.ceil(iconSize * 0.6),
      ow = Math.ceil(iconSize + pad * 2),
      oh = Math.ceil(iconSize + pad * 2);
    const off = document.createElement("canvas");
    off.width = ow;
    off.height = oh;
    const oc = off.getContext("2d")!;
    oc.strokeStyle = arrow.color;
    oc.lineWidth = strokeW;
    oc.lineCap = "round";
    oc.lineJoin = "round";
    oc.translate(ow / 2, oh / 2);
    oc.rotate(angle - Math.PI / 2);
    const half = iconSize / 2,
      tipY = half,
      shaftTop = -half * 0.5,
      headW = half * 0.6,
      headH = half * 0.5;
    oc.beginPath();
    oc.moveTo(0, shaftTop);
    oc.lineTo(0, tipY);
    oc.stroke();
    oc.beginPath();
    oc.moveTo(0, tipY);
    oc.lineTo(-headW, tipY - headH);
    oc.stroke();
    oc.beginPath();
    oc.moveTo(0, tipY);
    oc.lineTo(headW, tipY - headH);
    oc.stroke();
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 6 * (H / 450);
    ctx.shadowOffsetY = 2 * (H / 450);
    ctx.drawImage(off, cx - ow / 2, cy - oh / 2);
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
