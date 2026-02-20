"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPortal,
  DialogOverlay,
} from "@/shared/components/ui/dialog";
import { Download } from "lucide-react";
import type {
  ExplainerSequence,
  Segment,
  Transform,
  HighlightRegion,
  ArrowPointer,
  TextOverlay,
  Keyframe,
} from "@/shared/types/explainer";

// Export resolution options
export const EXPORT_RESOLUTIONS = [
  { label: "1080p", w: 1920, h: 1080 },
  { label: "720p", w: 1280, h: 720 },
  { label: "480p", w: 854, h: 480 },
];

export const EXPORT_FPS_OPTIONS = [24, 30, 60];

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewSequence: ExplainerSequence | null;
  audioUrl: string;
}

type ExportPhase =
  | "idle"
  | "fetching-audio"
  | "loading-images"
  | "encoding"
  | "rendering"
  | "muxing"
  | "done"
  | "error";

// ---------------------------------------------------------------------------
// Canvas export engine helper functions
// ---------------------------------------------------------------------------

const DEFAULT_TRANSFORM: Transform = { x: 0, y: 0, scale: 1 };

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

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

function computeFrameState(sequence: ExplainerSequence, currentTime: number): FrameState {
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

function drawExportFrame(
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

export function ExportDialog({ open, onOpenChange, previewSequence, audioUrl }: ExportDialogProps) {
  const [exportPhase, setExportPhase] = useState<ExportPhase>("idle");
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState("");
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportName, setExportName] = useState("");
  const [exportResolution, setExportResolution] = useState(1); // default 720p
  const [exportFps, setExportFps] = useState(30);
  const exportCancelRef = useRef(false);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (exportUrl) {
        URL.revokeObjectURL(exportUrl);
      }
    };
  }, [exportUrl]);

  const startExport = async () => {
    if (!previewSequence) return;
    setExportPhase("fetching-audio");
    setExportProgress(0);
    setExportStatus("Fetching audio…");
    setExportUrl(null);
    exportCancelRef.current = false;

    const sequence = previewSequence;
    // Use audioUrl from the sequence if present, else fall back to component state
    const resolvedAudioUrl = sequence.audioUrl ?? audioUrl ?? null;
    const blobUrls: string[] = []; // blob: URLs for image data — freed in finally
    try {
      // ── 1. Fetch audio ────────────────────────────────────────────────────
      let audioData: ArrayBuffer | null = null;
      let totalDuration = sequence.duration;
      if (resolvedAudioUrl) {
        try {
          const resp = await fetch(resolvedAudioUrl);
          if (resp.ok) {
            audioData = await resp.arrayBuffer();
            const ac = new AudioContext();
            const decoded = await ac.decodeAudioData(audioData.slice(0));
            totalDuration = decoded.duration;
            ac.close();
          }
        } catch (err) {
          console.warn("Audio fetch/decode failed, using sequence.duration:", err);
        }
      }
      if (exportCancelRef.current) return;

      // ── 2. Preload images ─────────────────────────────────────────────────
      // We fetch each image via the Fetch API and create a same-origin blob URL.
      // This avoids the CORS + canvas-taint problem entirely: the browser has
      // already loaded these images without crossOrigin (for the live player),
      // so any subsequent crossOrigin=anonymous request hits the cache as opaque
      // and taints the canvas. blob: URLs are always same-origin — no taint.
      setExportPhase("loading-images");
      setExportStatus("Loading images…");
      setExportProgress(5);
      const uniqueUrls = [...new Set(sequence.segments.map((s) => s.imageUrl))];
      const imgMap = new Map<string, HTMLImageElement>();
      // Route each image through the server-side proxy so the browser receives
      // it as a same-origin response — no CORS restriction, no canvas taint.
      await Promise.all(
        uniqueUrls.map(async (url) => {
          try {
            const proxyUrl = `/api/admin/proxy-image?url=${encodeURIComponent(url)}`;
            const resp = await fetch(proxyUrl);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const blob = await resp.blob();
            const blobUrl = URL.createObjectURL(blob);
            blobUrls.push(blobUrl);
            await new Promise<void>((resolve, reject) => {
              const img = new Image();
              img.onload = () => {
                imgMap.set(url, img);
                resolve();
              };
              img.onerror = reject;
              img.src = blobUrl;
            });
          } catch (err) {
            console.error(`[export] failed to load image ${url}:`, err);
          }
        })
      );
      if (imgMap.size === 0)
        throw new Error(`Failed to load any images (${uniqueUrls.length} attempted).`);
      if (exportCancelRef.current) {
        blobUrls.forEach(URL.revokeObjectURL);
        return;
      }

      // ── 3. Load FFmpeg ────────────────────────────────────────────────────
      setExportPhase("encoding");
      setExportStatus("Loading FFmpeg…");
      setExportProgress(10);
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress: p }) => setExportProgress(70 + Math.round(p * 25)));
      ffmpeg.on("log", ({ message }) => console.log("[FFmpeg]", message));
      await ffmpeg.load({ coreURL: "/ffmpeg/ffmpeg-core.js", wasmURL: "/ffmpeg/ffmpeg-core.wasm" });
      if (exportCancelRef.current) return;

      // ── 4. Render frames ──────────────────────────────────────────────────
      setExportPhase("rendering");
      setExportStatus("Rendering frames…");
      setExportProgress(15);
      const { w, h } = EXPORT_RESOLUTIONS[exportResolution];
      const fps = exportFps;
      const frameDuration = 1 / fps;
      const totalFrames = Math.ceil(totalDuration * fps);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      const useJpeg = w >= 1280;
      const imgMime = useJpeg ? "image/jpeg" : "image/png";
      const imgExt = useJpeg ? "jpg" : "png";
      const imgQ = useJpeg ? 0.92 : undefined;
      for (let fi = 0; fi < totalFrames; fi++) {
        if (exportCancelRef.current) return;
        drawExportFrame(ctx, w, h, computeFrameState(sequence, fi * frameDuration), imgMap);
        const blob = await new Promise<Blob>((res, rej) =>
          canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), imgMime, imgQ)
        );
        await ffmpeg.writeFile(
          `frame${String(fi).padStart(6, "0")}.${imgExt}`,
          new Uint8Array(await blob.arrayBuffer())
        );
        if (fi % 5 === 0) {
          setExportProgress(15 + Math.round((fi / totalFrames) * 55));
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      // ── 5. Write audio ────────────────────────────────────────────────────
      let hasAudio = false;
      if (audioData) {
        try {
          await ffmpeg.writeFile("audio.mp3", new Uint8Array(audioData));
          hasAudio = true;
        } catch (err) {
          console.warn("Failed to write audio:", err);
        }
      }
      if (exportCancelRef.current) return;

      // ── 6. Encode ─────────────────────────────────────────────────────────
      setExportPhase("muxing");
      setExportStatus("Encoding MP4…");
      await ffmpeg.exec([
        "-framerate",
        String(fps),
        "-i",
        `frame%06d.${imgExt}`,
        ...(hasAudio ? ["-i", "audio.mp3", "-c:a", "aac", "-b:a", "192k"] : []),
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "22",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "output.mp4",
      ]);
      setExportProgress(95);
      setExportStatus("Packaging…");
      const mp4Data = await ffmpeg.readFile("output.mp4");
      const mp4Blob = new Blob([mp4Data as unknown as BlobPart], { type: "video/mp4" });
      const name = `explainer-${Date.now()}.mp4`;
      setExportUrl(URL.createObjectURL(mp4Blob));
      setExportName(name);
      setExportProgress(100);
      setExportStatus(`Done — ${(mp4Blob.size / 1024 / 1024).toFixed(1)} MB`);
      setExportPhase("done");
    } catch (error) {
      console.error("Export error:", error);
      setExportStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
      setExportPhase("error");
    } finally {
      blobUrls.forEach(URL.revokeObjectURL);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (
      !newOpen &&
      exportPhase !== "rendering" &&
      exportPhase !== "muxing" &&
      exportPhase !== "encoding" &&
      exportPhase !== "loading-images" &&
      exportPhase !== "fetching-audio"
    ) {
      onOpenChange(false);
      setExportPhase("idle");
      setExportProgress(0);
      setExportStatus("");
      if (exportUrl) {
        URL.revokeObjectURL(exportUrl);
        setExportUrl(null);
      }
    }
  };

  const isRunning = exportPhase !== "idle" && exportPhase !== "done" && exportPhase !== "error";
  const totalDuration = previewSequence?.duration ?? 0;
  const totalFrames = Math.ceil(totalDuration * exportFps);
  const { w, h } = EXPORT_RESOLUTIONS[exportResolution];
  const BASE_FPS = 8;
  const BASE_PIXELS = 854 * 480;
  const estFps = BASE_FPS * (BASE_PIXELS / (w * h));
  const estSec = totalFrames / estFps;
  const estMin = Math.floor(estSec / 60);
  const estRemSec = Math.round(estSec % 60);
  const etaStr = estMin > 0 ? `~${estMin}m ${estRemSec}s` : `~${estRemSec}s`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export MP4</DialogTitle>
            <DialogDescription>
              Render every frame to canvas and mux with FFmpeg WASM.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Resolution</label>
                <select
                  value={exportResolution}
                  onChange={(e) => setExportResolution(Number(e.target.value))}
                  disabled={isRunning}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                >
                  {EXPORT_RESOLUTIONS.map((r, i) => (
                    <option key={i} value={i}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Frame rate</label>
                <select
                  value={exportFps}
                  onChange={(e) => setExportFps(Number(e.target.value))}
                  disabled={isRunning}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                >
                  {EXPORT_FPS_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f} fps
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Info row */}
            <p className="text-xs text-muted-foreground">
              {w}×{h} &middot; {totalFrames} frames &middot; est. render time{" "}
              <span className="text-foreground font-medium">{etaStr}</span>
            </p>

            {/* Progress */}
            {isRunning && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{exportStatus}</span>
                  <span className="tabular-nums text-muted-foreground">{exportProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
                <button
                  onClick={() => {
                    exportCancelRef.current = true;
                    setExportPhase("idle");
                    setExportStatus("");
                    setExportProgress(0);
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Status message when idle/done/error */}
            {!isRunning && exportStatus && exportPhase !== "idle" && (
              <p
                className={`text-sm ${exportPhase === "error" ? "text-destructive" : "text-muted-foreground"}`}
              >
                {exportStatus}
              </p>
            )}

            {/* Download button when done */}
            {exportPhase === "done" && exportUrl && (
              <a
                href={exportUrl}
                download={exportName}
                className="flex items-center justify-center gap-2 w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Download className="h-4 w-4" />
                Download {exportName}
              </a>
            )}

            {/* Start button when not running and not done */}
            {!isRunning && exportPhase !== "done" && (
              <button
                onClick={startExport}
                className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Start Export
              </button>
            )}
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
