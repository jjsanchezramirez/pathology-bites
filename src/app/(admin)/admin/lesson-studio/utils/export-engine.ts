// Canvas rendering for the MP4 export pipeline.
// Interpolation is handled by the shared lesson evaluator; this file only draws.

import type { Transform } from "@/shared/types/explainer";
import { evaluate, type FrameState } from "@/shared/lesson/evaluate";

// Re-export for callers that currently import from this module.
export type { FrameState };
export { evaluate as computeFrameState };

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

  function drawImage(url: string, transform: Transform, opacity: number) {
    const img = images.get(url);
    if (!img || !img.complete) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(W / 2, H / 2);
    ctx.scale(transform.scale, transform.scale);
    ctx.translate((transform.x / 100) * W, (transform.y / 100) * H);
    ctx.drawImage(img, -W / 2, -H / 2, W, H);
    ctx.restore();
  }

  if (state.imageUrl) drawImage(state.imageUrl, state.transform, state.transitionOpacity);
  if (state.incomingImageUrl && state.incomingOpacity > 0)
    drawImage(state.incomingImageUrl, state.incomingTransform, state.incomingOpacity);

  const spotlights = state.highlights.filter((h) => h.spotlight);
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

  for (const hl of state.highlights.filter((h) => !h.spotlight)) {
    ctx.save();
    ctx.globalAlpha = hl.opacity;
    ctx.strokeStyle = hl.borderColor;
    ctx.lineWidth = hl.borderWidth * (H / 450) + 1.5 * (H / 1080);
    ctx.setLineDash(
      hl.borderStyle === "dashed" ? [12, 8] : hl.borderStyle === "dotted" ? [2, 6] : []
    );
    const sc = hl.computedScale ?? 1;
    const cx = (hl.position.x / 100) * W,
      cy = (hl.position.y / 100) * H,
      hw = ((hl.size.width / 100) * W) * sc,
      hh = ((hl.size.height / 100) * H) * sc;
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

  for (const arrow of state.arrows) {
    ctx.save();
    ctx.globalAlpha = arrow.opacity;
    const x1 = (arrow.startPosition.x / 100) * W,
      y1 = (arrow.startPosition.y / 100) * H;
    const x2 = (arrow.endPosition.x / 100) * W,
      y2 = (arrow.endPosition.y / 100) * H;
    const strokeW = (arrow.strokeWidth ?? 3) * (H / 450);
    const headSize = 10 * strokeW;

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
  for (const o of state.textOverlays) {
    ctx.save();
    ctx.globalAlpha = o.computedOpacity ?? 1;
    const fontSize = o.fontSize * 16 * (H / DOM_VIEWPORT_H) * (o.computedScale ?? 1);
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
