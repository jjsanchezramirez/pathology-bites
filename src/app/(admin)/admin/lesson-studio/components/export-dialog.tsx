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
import type { Lesson } from "@/shared/lesson/types";
import { slideStarts } from "@/shared/lesson/evaluate";
import { computeFrameState, drawExportFrame } from "../utils/export-engine";
import { log } from "@/shared/utils/logging";

// Export resolution options
const EXPORT_RESOLUTIONS = [
  { label: "1080p", w: 1920, h: 1080 },
  { label: "720p", w: 1280, h: 720 },
  { label: "480p", w: 854, h: 480 },
];

const EXPORT_FPS_OPTIONS = [24, 30, 60];

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewLesson: Lesson | null;
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

export function ExportDialog({ open, onOpenChange, previewLesson, audioUrl }: ExportDialogProps) {
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
    if (!previewLesson) return;
    setExportPhase("fetching-audio");
    setExportProgress(0);
    setExportStatus("Fetching audio…");
    setExportUrl(null);
    exportCancelRef.current = false;

    const lesson = previewLesson;
    // Use audioUrl from the lesson if present, else fall back to component state
    const resolvedAudioUrl = lesson.audio?.url ?? audioUrl ?? null;
    const blobUrls: string[] = []; // blob: URLs for image data — freed in finally
    try {
      // ── 1. Fetch audio ────────────────────────────────────────────────────
      let audioData: ArrayBuffer | null = null;
      let totalDuration = slideStarts(lesson).duration;
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
          log.warn("Audio fetch/decode failed, using lesson duration:", err);
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
      const uniqueUrls = [
        ...new Set(
          lesson.slides.flatMap((s) =>
            s.elements.flatMap((e) => (e.kind === "image" ? [e.imageUrl] : []))
          )
        ),
      ].filter(Boolean);
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
            log.error(`[export] failed to load image ${url}:`, err);
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
      ffmpeg.on("log", ({ message }) => log.debug("[FFmpeg]", message));
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
        drawExportFrame(ctx, w, h, computeFrameState(lesson, fi * frameDuration), imgMap);
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
          log.warn("Failed to write audio:", err);
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
      log.error("Export error:", error);
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
  const totalDuration = previewLesson ? slideStarts(previewLesson).duration : 0;
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
