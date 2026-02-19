"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ExplainerPlayer } from "@/shared/components/explainer/explainer-player";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPortal,
  DialogOverlay,
} from "@/shared/components/ui/dialog";
import {
  X,
  Play,
  Image as ImageIcon,
  Plus,
  Trash2,
  Palette,
  Download,
  Video,
  Music,
  Search,
  Check,
  Clock,
  Upload,
  Sparkles,
  Loader2,
} from "lucide-react";
import type {
  ExplainerSequence,
  Segment,
  Transform,
  HighlightRegion,
  ArrowPointer,
  TextOverlay,
  CaptionChunk,
  Keyframe,
} from "@/shared/types/explainer";
import { ExplainerImageSelector } from "./components/explainer-image-selector";
import { fetchAudio } from "@/features/admin/audio/services/audio";
import type { Audio as AudioRecord } from "@/features/admin/audio/types";

interface LibraryImage {
  id: string;
  url: string;
  description?: string;
  alt_text?: string;
  category?: string;
  file_type: string;
  width: number;
  height: number;
  magnification?: string | null;
  created_at: string;
}

const DEFAULT_AUDIO_URL = "";

// Helper function to format numbers without trailing zeros
const formatNumber = (num: number): string => {
  return num % 1 === 0 ? num.toString() : num.toFixed(2).replace(/\.?0+$/, "");
};

// Editable label component
function EditableLabel({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onSave,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onSave: (value: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const numValue = Number(editValue);
    if (!isNaN(numValue)) {
      const clamped = Math.max(min, Math.min(max, numValue));
      onSave(clamped);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(value.toString());
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{label}:</span>
        <Input
          ref={inputRef}
          type="number"
          min={min}
          max={max}
          step={step}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="h-6 w-20 text-xs px-2"
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    );
  }

  return (
    <div
      className="text-xs cursor-pointer hover:bg-muted/40 px-1 py-0.5 rounded transition-colors inline-block mb-1"
      onClick={() => {
        setEditValue(value.toString());
        setIsEditing(true);
      }}
    >
      <span className="text-muted-foreground">{label}:</span>{" "}
      <span className="font-medium">
        {formatNumber(value)}
        {suffix}
      </span>
    </div>
  );
}

// Time-based animation types
interface BaseAnimation {
  id: string;
  start: number; // When animation begins
  duration: number; // How long at target state
  fadeTime: number; // How long transition takes
}

interface ZoomAnimation extends BaseAnimation {
  type: "zoom";
  targetScale: number; // Target zoom level
  targetX: number; // X position to zoom to (-50 to 50)
  targetY: number; // Y position to zoom to (-50 to 50)
}

interface PanAnimation extends BaseAnimation {
  type: "pan";
  targetScale: number; // Target zoom level (stays after animation)
  targetX: number; // X position to pan to (stays after animation)
  targetY: number; // Y position to pan to (stays after animation)
}

interface FigureAnimation extends BaseAnimation {
  type: "figure";
  figureType: "circle" | "oval" | "rectangle";
  position: { x: number; y: number };
  size: { width: number; height: number };
  borderColor: string;
  borderWidth: number;
  borderStyle: "solid" | "dotted" | "dashed";
}

interface SpotlightAnimation extends BaseAnimation {
  type: "spotlight";
  figureType: "circle" | "oval" | "rectangle";
  position: { x: number; y: number };
  size: { width: number; height: number };
}

interface ArrowAnimation extends BaseAnimation {
  type: "arrow";
  position: { x: number; y: number };
  color: string;
  direction: "up" | "down" | "left" | "right" | "up-left" | "up-right" | "down-left" | "down-right";
}

type Animation =
  | ZoomAnimation
  | PanAnimation
  | FigureAnimation
  | SpotlightAnimation
  | ArrowAnimation;

interface TimeBasedText {
  id: string;
  start: number; // When fade-in begins
  duration: number; // How long text is fully visible
  fadeTime: number; // How long fade-in/fade-out takes
  text: string;
  position: { x: number; y: number };
  fontSize: number;
  fontWeight: "normal" | "bold" | "semibold";
  color: string;
  backgroundColor?: string;
}

interface SelectedImage extends LibraryImage {
  duration: number;
  transitionDuration: number;
  initialZoom: number; // 1.0 = 100%, 1.5 = 150%
  initialX: number; // -50 to 50 (percentage offset)
  initialY: number; // -50 to 50 (percentage offset)
  animations: Animation[]; // Multiple time-based animations
  textOverlays: TimeBasedText[]; // Multiple time-based text overlays
}

// ---------------------------------------------------------------------------
// Canvas export engine (same logic as /test/video-export, inlined here so the
// studio has no extra dependencies and works self-contained in production)
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

const EXPORT_RESOLUTIONS = [
  { label: "1080p", w: 1920, h: 1080 },
  { label: "720p", w: 1280, h: 720 },
  { label: "480p", w: 854, h: 480 },
];
const EXPORT_FPS_OPTIONS = [24, 30, 60];

export default function LessonStudioPage() {
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [audioUrl, setAudioUrl] = useState(DEFAULT_AUDIO_URL);
  const [previewSequence, setPreviewSequence] = useState<ExplainerSequence | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [seekTime, setSeekTime] = useState<number | undefined>(undefined);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  // Export state
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPhase, setExportPhase] = useState<
    | "idle"
    | "fetching-audio"
    | "loading-images"
    | "encoding"
    | "rendering"
    | "muxing"
    | "done"
    | "error"
  >("idle");
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState("");
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportName, setExportName] = useState("");
  const exportCancelRef = useRef(false);
  const [exportResolution, setExportResolution] = useState(1); // index into EXPORT_RESOLUTIONS (default 720p)
  const [exportFps, setExportFps] = useState(30);
  const timelineRef = useRef<HTMLDivElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // Audio picker dialog state
  const [audioPickerOpen, setAudioPickerOpen] = useState(false);
  const [audioRecords, setAudioRecords] = useState<AudioRecord[]>([]);
  const [audioSearch, setAudioSearch] = useState("");
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioTitle, setAudioTitle] = useState("");
  const [audioTranscript, setAudioTranscript] = useState("");
  const [captionChunks, setCaptionChunks] = useState<CaptionChunk[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  // Automatic preview update whenever images change (but not audio)
  // Debounced to avoid excessive regeneration
  useEffect(() => {
    if (selectedImages.length > 0 && audioUrl) {
      const timer = setTimeout(() => {
        generateSequence();
      }, 500); // 500ms delay buffer

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedImages]);

  // Load a saved sequence JSON back into the studio.
  // Reconstructs animations and text overlays by reverse-engineering the keyframe
  // opacity timeline: find first/last appearance of each element id to recover
  // start, fadeTime, and duration.
  const loadFromJSON = (sequence: ExplainerSequence) => {
    const images: SelectedImage[] = sequence.segments.map((seg, i) => {
      const duration = seg.endTime - seg.startTime;
      const kfs = seg.keyframes;

      // ── Collect timing windows per element id ──────────────────────────
      // For each id, track all {time, opacity} pairs across keyframes.
      const highlightWindows = new Map<
        string,
        { time: number; opacity: number; data: HighlightRegion }[]
      >();
      const arrowWindows = new Map<
        string,
        { time: number; opacity: number; data: ArrowPointer }[]
      >();
      const textWindows = new Map<string, { time: number; opacity: number; data: TextOverlay }[]>();

      for (const kf of kfs) {
        for (const h of kf.highlights) {
          if (!highlightWindows.has(h.id)) highlightWindows.set(h.id, []);
          highlightWindows.get(h.id)!.push({ time: kf.time, opacity: h.opacity, data: h });
        }
        for (const a of kf.arrows) {
          if (!arrowWindows.has(a.id)) arrowWindows.set(a.id, []);
          arrowWindows.get(a.id)!.push({ time: kf.time, opacity: a.opacity, data: a });
        }
        for (const t of kf.textOverlays) {
          if (!textWindows.has(t.id)) textWindows.set(t.id, []);
          textWindows.get(t.id)!.push({ time: kf.time, opacity: t.computedOpacity ?? 1, data: t });
        }
      }

      // Helper: from a sorted list of {time, opacity} entries recover animation timing.
      // Returns {start, fadeTime, holdDuration} in segment-local time.
      function recoverTiming(entries: { time: number; opacity: number }[]): {
        start: number;
        fadeTime: number;
        holdDuration: number;
      } {
        const visible = entries.filter((e) => e.opacity > 0.01).map((e) => e.time);
        if (visible.length === 0) return { start: 0, fadeTime: 0.5, holdDuration: 1 };
        const firstVisible = Math.min(...visible);
        const lastVisible = Math.max(...visible);
        const atFull = entries.filter((e) => e.opacity >= 0.99).map((e) => e.time);
        const firstFull = atFull.length > 0 ? Math.min(...atFull) : firstVisible;
        const lastFull = atFull.length > 0 ? Math.max(...atFull) : lastVisible;
        const fadeTime = Math.max(0, firstFull - firstVisible);
        const holdDuration = Math.max(0, lastFull - firstFull);
        return { start: firstVisible, fadeTime, holdDuration };
      }

      // ── Rebuild animations ──────────────────────────────────────────────
      const animations: Animation[] = [];

      for (const [id, entries] of highlightWindows) {
        const { start, fadeTime, holdDuration } = recoverTiming(entries);
        const sample = entries[entries.length - 1].data; // last entry has full data
        if (sample.spotlight) {
          animations.push({
            id,
            type: "spotlight",
            figureType: sample.type,
            position: sample.position,
            size: sample.size,
            start,
            duration: holdDuration,
            fadeTime: fadeTime || 0.5,
          });
        } else {
          animations.push({
            id,
            type: "figure",
            figureType: sample.type,
            position: sample.position,
            size: sample.size,
            borderColor: sample.borderColor,
            borderWidth: sample.borderWidth,
            borderStyle: (sample.borderStyle ?? "solid") as "solid" | "dotted" | "dashed",
            start,
            duration: holdDuration,
            fadeTime: fadeTime || 0.5,
          });
        }
      }

      for (const [id, entries] of arrowWindows) {
        const { start, fadeTime, holdDuration } = recoverTiming(entries);
        const sample = entries[entries.length - 1].data;
        animations.push({
          id,
          type: "arrow",
          position: sample.endPosition,
          color: sample.color,
          direction: sample.direction,
          start,
          duration: holdDuration,
          fadeTime: fadeTime || 0.5,
        });
      }

      // ── Rebuild text overlays ───────────────────────────────────────────
      const textOverlays: TimeBasedText[] = [];
      for (const [id, entries] of textWindows) {
        const { start, fadeTime, holdDuration } = recoverTiming(entries);
        const sample = entries[entries.length - 1].data;
        textOverlays.push({
          id,
          text: sample.text,
          position: sample.position,
          fontSize: sample.fontSize,
          fontWeight: sample.fontWeight as "normal" | "bold" | "semibold",
          color: sample.color,
          backgroundColor: sample.backgroundColor,
          start,
          duration: holdDuration,
          fadeTime: fadeTime || 0.5,
        });
      }

      return {
        id: `loaded-${i}`,
        url: seg.imageUrl,
        description: seg.imageAlt ?? "",
        alt_text: seg.imageAlt ?? "",
        file_type: "image",
        width: 1920,
        height: 1080,
        created_at: "",
        duration,
        transitionDuration: seg.transitionDuration ?? 1,
        initialZoom: kfs[0]?.transform.scale ?? 1,
        initialX: kfs[0]?.transform.x ?? 0,
        initialY: kfs[0]?.transform.y ?? 0,
        animations,
        textOverlays,
      };
    });

    setSelectedImages(images);
    setSelectedImageIndex(null);
    setPreviewSequence(sequence);
    if (sequence.audioUrl) setAudioUrl(sequence.audioUrl);
    if (sequence.captions && sequence.captions.length > 0) {
      setCaptionChunks(sequence.captions);
    }
  };

  const handleStageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.name.endsWith(".json")) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        // Accept both bare ExplainerSequence and the API response wrapper { success, sequence }
        const parsed: ExplainerSequence = raw?.sequence ?? raw;
        if (!parsed.segments || !Array.isArray(parsed.segments)) {
          alert("Invalid sequence JSON — missing segments array.");
          return;
        }
        loadFromJSON(parsed);
      } catch {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const loadAudioRecords = useCallback(async (search?: string) => {
    setAudioLoading(true);
    try {
      const records = await fetchAudio(search ? { search } : undefined);
      setAudioRecords(records);
    } catch (err) {
      console.error("Failed to fetch audio:", err);
    } finally {
      setAudioLoading(false);
    }
  }, []);

  useEffect(() => {
    if (audioPickerOpen) {
      loadAudioRecords(audioSearch);
    }
  }, [audioPickerOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!audioPickerOpen) return;
    const timer = setTimeout(() => loadAudioRecords(audioSearch), 300);
    return () => clearTimeout(timer);
  }, [audioSearch, loadAudioRecords, audioPickerOpen]);

  const handleSelectAudio = (record: AudioRecord) => {
    setAudioUrl(record.url);
    setAudioTitle(record.title);
    setAudioTranscript(record.generated_text ?? "");
    // Seed duration immediately from the record so captions can use it before
    // the player fires onAudioLoaded
    if (record.duration_seconds) setAudioDuration(record.duration_seconds);
    setAudioPickerOpen(false);
    setAudioSearch("");
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Helper function to get display name for animation types
  const getAnimationDisplayName = (type: string): string => {
    const displayNames: Record<string, string> = {
      zoom: "Zoom",
      pan: "Pan",
      figure: "Shape",
      spotlight: "Spotlight",
      arrow: "Arrow",
    };
    return displayNames[type] || type;
  };

  // Scroll timeline to selected segment
  useEffect(() => {
    if (selectedImageIndex !== null && timelineRef.current && selectedImages.length > 0) {
      const totalDuration = selectedImages.reduce((sum, img) => sum + img.duration, 0);
      const segmentStartTime = selectedImages
        .slice(0, selectedImageIndex)
        .reduce((sum, img) => sum + img.duration, 0);

      // Calculate scroll position (percentage of total width)
      const scrollPercentage = segmentStartTime / totalDuration;
      const scrollLeft = timelineRef.current.scrollWidth * scrollPercentage;

      // Smooth scroll to the segment
      timelineRef.current.scrollTo({
        left: scrollLeft,
        behavior: "smooth",
      });
    }
  }, [selectedImageIndex, selectedImages]);

  // Handle segment selection with preview seeking
  const handleSegmentSelect = (index: number) => {
    setSelectedImageIndex(index);
    // Calculate segment start time
    const startTime = selectedImages.slice(0, index).reduce((sum, img) => sum + img.duration, 0);
    setSeekTime(startTime);
  };

  const getImageTitle = (image: LibraryImage): string => {
    // Try to extract title from description or URL
    if (image.description) {
      // Take first 40 chars or up to first dash/period
      const shortened = image.description.split(/[–—-]/)[0].trim();
      return shortened.length > 40 ? shortened.substring(0, 40) + "..." : shortened;
    }
    // Fallback to filename from URL
    const filename = image.url.split("/").pop()?.split(".")[0] || "Untitled";
    return filename.substring(0, 40);
  };

  // Calculate initial zoom to cover the viewport (16:9 aspect ratio)
  const calculateCoverZoom = (image: LibraryImage): number => {
    const viewportAspectRatio = 16 / 9; // 1.777...
    const imageAspectRatio = image.width / image.height;

    // Calculate zoom needed to make the image cover (fill) the viewport
    // zoom > 1 means we see LESS of the image (zoomed in)
    // zoom < 1 means we see MORE of the image (zoomed out)
    let zoom: number;
    if (imageAspectRatio > viewportAspectRatio) {
      // Image is wider than viewport (e.g., 21:9 vs 16:9)
      // Need to fit by height → zoom IN to crop the sides
      zoom = imageAspectRatio / viewportAspectRatio;
    } else {
      // Image is taller than viewport (e.g., 4:3 vs 16:9)
      // Need to fit by width → zoom IN to crop top/bottom
      zoom = viewportAspectRatio / imageAspectRatio;
    }

    // Clamp between 0.5x and 2x
    return Math.max(0.5, Math.min(zoom, 2));
  };

  const addImage = (image: LibraryImage) => {
    console.log(
      `[lesson-studio] Adding image: ${image.description?.slice(0, 50)} — category: ${image.category}, magnification: ${image.magnification ?? "null"}`
    );

    const initialZoom = calculateCoverZoom(image);
    const duration = 10;

    // Create automatic soft pan/zoom animation
    const autoPanAnimation: Animation = {
      id: `auto-pan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "pan",
      start: 0,
      duration: duration,
      fadeTime: duration, // Smooth transition throughout entire duration
      targetScale: initialZoom * 1.2, // 20% zoom increase
      targetX: Math.random() * 10 - 5, // Random ±5% from center
      targetY: Math.random() * 10 - 5, // Random ±5% from center
    };

    setSelectedImages([
      ...selectedImages,
      {
        ...image,
        duration,
        transitionDuration: 1,
        initialZoom,
        initialX: 0,
        initialY: 0,
        animations: [autoPanAnimation],
        textOverlays: [],
      },
    ]);
  };

  const addImages = (images: LibraryImage[]) => {
    const newImages = images.map((image) => {
      const initialZoom = calculateCoverZoom(image);
      const duration = 10;

      // Create automatic soft pan/zoom animation
      const autoPanAnimation: Animation = {
        id: `auto-pan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: "pan",
        start: 0,
        duration: duration,
        fadeTime: duration, // Smooth transition throughout entire duration
        targetScale: initialZoom * 1.2, // 20% zoom increase
        targetX: Math.random() * 10 - 5, // Random ±5% from center
        targetY: Math.random() * 10 - 5, // Random ±5% from center
      };

      return {
        ...image,
        duration,
        transitionDuration: 1,
        initialZoom,
        initialX: 0,
        initialY: 0,
        animations: [autoPanAnimation],
        textOverlays: [],
      };
    });
    setSelectedImages([...selectedImages, ...newImages]);
  };

  const removeImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateImage = (index: number, field: keyof SelectedImage, value: any) => {
    setSelectedImages(
      selectedImages.map((img, i) => (i === index ? { ...img, [field]: value } : img))
    );
  };

  // Animation helper functions
  const addAnimation = (imageIndex: number, type: Animation["type"]) => {
    const img = selectedImages[imageIndex];
    const newId = `anim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    let newAnimation: Animation;

    switch (type) {
      case "zoom":
        {
          const zoomDuration = Math.min(2, img.duration - 1);
          newAnimation = {
            id: newId,
            type: "zoom",
            start: 0,
            duration: zoomDuration,
            fadeTime: img.duration - zoomDuration - 0, // segmentDuration - zoomDuration - start
            targetScale: img.initialZoom * 1.5,
            targetX: 0,
            targetY: 0,
          };
        }
        break;
      case "pan":
        newAnimation = {
          id: newId,
          type: "pan",
          start: 0,
          duration: 0, // Not used for pan animations
          fadeTime: img.duration - 0, // segmentDuration - start
          targetScale: img.initialZoom * 1.5,
          targetX: 0,
          targetY: 0,
        };
        break;
      case "figure":
        {
          const duration = Math.min(2, img.duration - 0.3);
          newAnimation = {
            id: newId,
            type: "figure",
            start: 0,
            duration,
            fadeTime: img.duration - duration - 0, // segmentDuration - animationDuration - start
            figureType: "circle",
            position: { x: 50, y: 50 },
            size: { width: 30, height: 30 },
            borderColor: "#FFFFFF",
            borderWidth: 3,
            borderStyle: "solid",
          };
        }
        break;
      case "spotlight":
        {
          const duration = Math.min(2, img.duration - 0.3);
          newAnimation = {
            id: newId,
            type: "spotlight",
            start: 0,
            duration,
            fadeTime: img.duration - duration - 0, // segmentDuration - animationDuration - start
            figureType: "circle",
            position: { x: 50, y: 50 },
            size: { width: 30, height: 30 },
          };
        }
        break;
      case "arrow":
        {
          const duration = Math.min(2, img.duration - 0.3);
          newAnimation = {
            id: newId,
            type: "arrow",
            start: 0,
            duration,
            fadeTime: img.duration - duration - 0, // segmentDuration - animationDuration - start
            position: { x: 50, y: 50 },
            color: "#FFFFFF",
            direction: "down",
          };
        }
        break;
    }

    updateImage(imageIndex, "animations", [...img.animations, newAnimation]);
  };

  const removeAnimation = (imageIndex: number, animId: string) => {
    const img = selectedImages[imageIndex];
    updateImage(
      imageIndex,
      "animations",
      img.animations.filter((a) => a.id !== animId)
    );
  };

  const updateAnimation = (imageIndex: number, animId: string, updates: Partial<Animation>) => {
    const img = selectedImages[imageIndex];
    updateImage(
      imageIndex,
      "animations",
      img.animations.map((a) => (a.id === animId ? { ...a, ...updates } : a))
    );
  };

  const addText = (imageIndex: number) => {
    const img = selectedImages[imageIndex];
    const textDuration = Math.min(3, img.duration - 1);
    const newText: TimeBasedText = {
      id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      start: 0,
      duration: textDuration,
      fadeTime: img.duration - textDuration - 0, // segmentDuration - textDuration - start
      text: getImageTitle(img),
      position: { x: 50, y: 15 },
      fontSize: 1.5,
      fontWeight: "bold",
      color: "#FFFFFF",
      backgroundColor: undefined,
    };
    updateImage(imageIndex, "textOverlays", [...img.textOverlays, newText]);
  };

  const removeText = (imageIndex: number, textId: string) => {
    const img = selectedImages[imageIndex];
    updateImage(
      imageIndex,
      "textOverlays",
      img.textOverlays.filter((t) => t.id !== textId)
    );
  };

  const updateText = (imageIndex: number, textId: string, updates: Partial<TimeBasedText>) => {
    const img = selectedImages[imageIndex];
    updateImage(
      imageIndex,
      "textOverlays",
      img.textOverlays.map((t) => (t.id === textId ? { ...t, ...updates } : t))
    );
  };

  /**
   * Build a flat list of caption chunks from a transcript using uniform word timing.
   * Times are absolute (seconds from sequence start, offset by segmentTimeOffset).
   */
  const buildCaptionChunks = (transcript: string, totalDuration: number): CaptionChunk[] => {
    const CHUNK_SIZE = 5;
    const words = transcript.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0 || totalDuration <= 0) return [];

    const wordDuration = totalDuration / words.length;
    const chunks: CaptionChunk[] = [];
    for (let i = 0; i < words.length; i += CHUNK_SIZE) {
      const chunkWords = words.slice(i, i + CHUNK_SIZE);
      chunks.push({
        text: chunkWords.join(" "),
        start: i * wordDuration,
        end: (i + chunkWords.length) * wordDuration,
      });
    }
    return chunks;
  };

  const generateSequence = () => {
    if (selectedImages.length === 0) return;

    let currentTime = 0;
    const segments: Segment[] = selectedImages.map((img, index) => {
      const startTime = currentTime;
      const endTime = currentTime + img.duration;
      currentTime = endTime;

      // Collect all unique time points where something changes
      const timePoints = new Set<number>([0, img.duration]);

      // Add time points from animations
      img.animations.forEach((anim) => {
        if (anim.type === "zoom") {
          // Zoom animations: fade in, hold, fade out
          timePoints.add(anim.start);
          timePoints.add(anim.start + anim.fadeTime);
          timePoints.add(anim.start + anim.fadeTime + anim.duration);
          timePoints.add(anim.start + anim.fadeTime + anim.duration + anim.fadeTime);
        } else if (anim.type === "pan") {
          // Pan animations: fade in, then stay (no fade out)
          timePoints.add(anim.start);
          timePoints.add(anim.start + anim.fadeTime);
        } else {
          // Visual annotations (figure, spotlight, arrow)
          timePoints.add(anim.start);
          timePoints.add(anim.start + anim.fadeTime);
          timePoints.add(anim.start + anim.fadeTime + anim.duration);
          timePoints.add(anim.start + anim.fadeTime + anim.duration + anim.fadeTime);
        }
      });

      // Add time points from text overlays (start, end of fade-in, end of full, end of fade-out)
      img.textOverlays.forEach((text) => {
        timePoints.add(text.start); // Fade-in begins
        timePoints.add(text.start + text.fadeTime); // Fully visible
        timePoints.add(text.start + text.fadeTime + text.duration); // Fade-out begins
        timePoints.add(text.start + text.fadeTime + text.duration + text.fadeTime); // Completely gone
      });

      // Sort time points
      const sortedTimes = Array.from(timePoints).sort((a, b) => a - b);

      // Generate keyframes at each time point
      const keyframes: Segment["keyframes"] = sortedTimes.map((time) => {
        // Calculate base transform considering completed pan animations
        let baseTransform = { x: img.initialX, y: img.initialY, scale: img.initialZoom };

        // Update base transform with completed pan animations (processed in order)
        const sortedPanAnims = img.animations
          .filter((a) => a.type === "pan")
          .sort((a, b) => a.start - b.start);

        for (const panAnim of sortedPanAnims) {
          const panEnd = panAnim.start + panAnim.fadeTime;
          if (time >= panEnd) {
            // This pan animation has completed, update base transform
            baseTransform = {
              x: panAnim.targetX,
              y: panAnim.targetY,
              scale: panAnim.targetScale,
            };
          }
        }

        // Start with base transform
        const transform = { ...baseTransform };

        // Apply active zoom and pan animations
        img.animations.forEach((anim) => {
          if (anim.type === "zoom") {
            const fadeInEnd = anim.start + anim.fadeTime;
            const fadeOutStart = anim.start + anim.fadeTime + anim.duration;
            const fadeOutEnd = fadeOutStart + anim.fadeTime;

            // Check if animation is active at this time
            if (time >= anim.start && time <= fadeOutEnd) {
              let progress = 0;

              // Calculate progress based on phase
              if (time < fadeInEnd) {
                // Fading in
                progress = anim.fadeTime > 0 ? (time - anim.start) / anim.fadeTime : 1;
              } else if (time <= fadeOutStart) {
                // Fully active
                progress = 1;
              } else {
                // Fading out - transition back to base
                const fadeOutProgress =
                  anim.fadeTime > 0 ? (time - fadeOutStart) / anim.fadeTime : 0;
                progress = 1 - fadeOutProgress;
              }

              // Apply the animation (relative to base transform)
              transform.scale =
                baseTransform.scale + (anim.targetScale - baseTransform.scale) * progress;
              transform.x = baseTransform.x + (anim.targetX - baseTransform.x) * progress;
              transform.y = baseTransform.y + (anim.targetY - baseTransform.y) * progress;
            }
          } else if (anim.type === "pan") {
            const fadeInEnd = anim.start + anim.fadeTime;

            // Check if animation is in progress (not yet complete)
            if (time >= anim.start && time < fadeInEnd) {
              // For pan, we calculate from the state BEFORE this pan
              let panBaseTransform = { x: img.initialX, y: img.initialY, scale: img.initialZoom };
              const priorPans = sortedPanAnims.filter((p) => p.start + p.fadeTime <= anim.start);
              if (priorPans.length > 0) {
                const lastPan = priorPans[priorPans.length - 1];
                panBaseTransform = {
                  x: lastPan.targetX,
                  y: lastPan.targetY,
                  scale: lastPan.targetScale,
                };
              }

              // Calculate progress of fade-in
              const progress = anim.fadeTime > 0 ? (time - anim.start) / anim.fadeTime : 1;

              // Apply the pan animation (interpolating from base to target)
              transform.scale =
                panBaseTransform.scale + (anim.targetScale - panBaseTransform.scale) * progress;
              transform.x = panBaseTransform.x + (anim.targetX - panBaseTransform.x) * progress;
              transform.y = panBaseTransform.y + (anim.targetY - panBaseTransform.y) * progress;
            }
            // Note: Once complete (time >= fadeInEnd), the base transform already includes this pan
          }
        });

        // Collect active highlights (figures and spotlights) with opacity
        const highlights: (typeof keyframes)[0]["highlights"] = [];
        img.animations.forEach((anim) => {
          if (anim.type === "figure" || anim.type === "spotlight") {
            const fadeInEnd = anim.start + anim.fadeTime;
            const fadeOutStart = anim.start + anim.fadeTime + anim.duration;
            const fadeOutEnd = fadeOutStart + anim.fadeTime;

            if (time >= anim.start && time <= fadeOutEnd) {
              let opacity = 1;

              // Calculate opacity based on phase
              if (time < fadeInEnd) {
                opacity = anim.fadeTime > 0 ? (time - anim.start) / anim.fadeTime : 1;
              } else if (time > fadeOutStart) {
                opacity = anim.fadeTime > 0 ? (fadeOutEnd - time) / anim.fadeTime : 1;
              }

              if (anim.type === "figure") {
                highlights.push({
                  id: anim.id,
                  type: anim.figureType,
                  position: anim.position,
                  size: anim.size,
                  borderColor: anim.borderColor,
                  borderWidth: anim.borderWidth,
                  borderStyle: anim.borderStyle,
                  fillColor: undefined,
                  opacity: Math.max(0, Math.min(1, opacity)),
                  spotlight: false,
                });
              } else if (anim.type === "spotlight") {
                highlights.push({
                  id: anim.id,
                  type: anim.figureType,
                  position: anim.position,
                  size: anim.size,
                  borderColor: "#000000",
                  borderWidth: 0,
                  fillColor: undefined,
                  opacity: Math.max(0, Math.min(1, opacity)),
                  spotlight: true,
                });
              }
            }
          }
        });

        // Collect active arrows with opacity
        const arrows: (typeof keyframes)[0]["arrows"] = [];
        img.animations.forEach((anim) => {
          if (anim.type === "arrow") {
            const fadeInEnd = anim.start + anim.fadeTime;
            const fadeOutStart = anim.start + anim.fadeTime + anim.duration;
            const fadeOutEnd = fadeOutStart + anim.fadeTime;

            if (time >= anim.start && time <= fadeOutEnd) {
              let opacity = 1;

              // Calculate opacity based on phase
              if (time < fadeInEnd) {
                opacity = anim.fadeTime > 0 ? (time - anim.start) / anim.fadeTime : 1;
              } else if (time > fadeOutStart) {
                opacity = anim.fadeTime > 0 ? (fadeOutEnd - time) / anim.fadeTime : 1;
              }

              // Calculate start position based on direction
              let startPosition = { x: anim.position.x, y: anim.position.y };
              const offset = 10;
              const diagonalOffset = offset * 0.707; // cos(45°) ≈ 0.707

              switch (anim.direction) {
                case "down":
                  startPosition = { x: anim.position.x, y: anim.position.y - offset };
                  break;
                case "up":
                  startPosition = { x: anim.position.x, y: anim.position.y + offset };
                  break;
                case "left":
                  startPosition = { x: anim.position.x + offset, y: anim.position.y };
                  break;
                case "right":
                  startPosition = { x: anim.position.x - offset, y: anim.position.y };
                  break;
                case "up-left":
                  startPosition = {
                    x: anim.position.x + diagonalOffset,
                    y: anim.position.y + diagonalOffset,
                  };
                  break;
                case "up-right":
                  startPosition = {
                    x: anim.position.x - diagonalOffset,
                    y: anim.position.y + diagonalOffset,
                  };
                  break;
                case "down-left":
                  startPosition = {
                    x: anim.position.x + diagonalOffset,
                    y: anim.position.y - diagonalOffset,
                  };
                  break;
                case "down-right":
                  startPosition = {
                    x: anim.position.x - diagonalOffset,
                    y: anim.position.y - diagonalOffset,
                  };
                  break;
              }

              arrows.push({
                id: anim.id,
                startPosition,
                endPosition: anim.position,
                color: anim.color,
                strokeWidth: 3,
                opacity: Math.max(0, Math.min(1, opacity)),
                direction: anim.direction,
              });
            }
          }
        });

        // Collect active text overlays with calculated opacity
        const textOverlays: (typeof keyframes)[0]["textOverlays"] = [];
        img.textOverlays.forEach((text) => {
          const fadeInEnd = text.start + text.fadeTime;
          const fadeOutStart = text.start + text.fadeTime + text.duration;
          const fadeOutEnd = fadeOutStart + text.fadeTime;

          // Check if text is visible at this time
          if (time >= text.start && time <= fadeOutEnd) {
            let opacity = 1;

            // Calculate opacity based on phase
            if (time < fadeInEnd) {
              // Fading in
              opacity = text.fadeTime > 0 ? (time - text.start) / text.fadeTime : 1;
            } else if (time > fadeOutStart) {
              // Fading out
              opacity = text.fadeTime > 0 ? (fadeOutEnd - time) / text.fadeTime : 1;
            }
            // else: fully visible (opacity = 1)

            textOverlays.push({
              id: text.id,
              text: text.text,
              position: text.position,
              fontSize: text.fontSize,
              fontWeight: text.fontWeight,
              color: text.color,
              backgroundColor: text.backgroundColor,
              maxWidth: 80,
              textAlign: "center" as const,
              animation: "fade" as const,
              computedOpacity: Math.max(0, Math.min(1, opacity)),
            });
          }
        });

        return {
          time,
          transform,
          highlights,
          arrows,
          textOverlays,
        };
      });

      const segment: Segment = {
        id: `seg-${index}`,
        imageUrl: img.url,
        imageAlt: img.description || "Untitled",
        startTime,
        endTime,
        transition: index < selectedImages.length - 1 ? "crossfade" : "cut",
        transitionDuration: index < selectedImages.length - 1 ? img.transitionDuration : 0,
        keyframes,
      };

      return segment;
    });

    const totalDuration = segments[segments.length - 1]?.endTime || 0;

    const newSequence: ExplainerSequence = {
      version: 1 as const,
      duration: totalDuration,
      aspectRatio: "16:9",
      segments,
      ...(audioUrl ? { audioUrl } : {}),
    };

    // Only update if the sequence actually changed (avoid unnecessary re-renders/blinking)
    const sequenceChanged = JSON.stringify(newSequence) !== JSON.stringify(previewSequence);
    if (sequenceChanged) {
      setPreviewSequence(newSequence);
    }

    // Build flat caption chunks (rendered outside the engine, no keyframe interpolation)
    if (audioTranscript && audioDuration > 0) {
      setCaptionChunks(buildCaptionChunks(audioTranscript, audioDuration));
    } else {
      setCaptionChunks([]);
    }
  };

  // AI-powered sequence generation via Llama 4 Maverick
  const handleAIGenerate = async () => {
    if (selectedImages.length === 0 || !audioUrl) return;

    // Build caption chunks from transcript if available
    const finalAudioDuration = audioDuration > 0 ? audioDuration : 60; // fallback duration
    const captions =
      audioTranscript && finalAudioDuration > 0
        ? buildCaptionChunks(audioTranscript, finalAudioDuration)
        : [];

    if (captions.length === 0) {
      alert("No transcript available for the selected audio. Please select audio with a transcript.");
      return;
    }

    setIsGenerating(true);
    try {
      const images = selectedImages.map((img) => ({
        url: img.url,
        title: img.description
          ? img.description.split(/[-–.]/)[0].trim().slice(0, 80)
          : (img.url.split("/").pop() ?? ""),
        description: img.description ?? img.alt_text ?? "",
        category: img.category ?? "",
        magnification: img.magnification ?? null,
        width: img.width,
        height: img.height,
      }));

      console.log("[lesson-studio] Sending AI generation request:");
      images.forEach((img, i) => {
        console.log(`  [${i}] ${img.title}`);
        console.log(`      category: ${img.category}, magnification: ${img.magnification ?? "null"}`);
      });
      console.log(`[lesson-studio] ${captions.length} captions, ${finalAudioDuration.toFixed(1)}s`);

      const response = await fetch("/api/admin/lesson-studio/generate-sequence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images,
          captions,
          audioDuration: finalAudioDuration,
          audioUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        alert(`AI generation failed: ${data.error ?? "Unknown error"}`);
        return;
      }

      loadFromJSON(data.sequence);
    } catch (err) {
      alert(`AI generation error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const saveToJSON = () => {
    if (selectedImages.length === 0) {
      alert("Please add at least one image before saving.");
      return;
    }

    let currentTime = 0;

    const segments: Segment[] = selectedImages.map((img, index) => {
      const startTime = currentTime;
      const endTime = currentTime + img.duration;
      currentTime = endTime;

      // Collect all unique time points where something changes (same logic as generateSequence)
      const timePoints = new Set<number>([0, img.duration]);

      img.animations.forEach((anim) => {
        if (anim.type === "zoom") {
          timePoints.add(anim.start);
          timePoints.add(anim.start + anim.fadeTime);
          timePoints.add(anim.start + anim.fadeTime + anim.duration);
          timePoints.add(anim.start + anim.fadeTime + anim.duration + anim.fadeTime);
        } else if (anim.type === "pan") {
          timePoints.add(anim.start);
          timePoints.add(anim.start + anim.fadeTime);
        } else {
          timePoints.add(anim.start);
          timePoints.add(anim.start + anim.fadeTime);
          timePoints.add(anim.start + anim.fadeTime + anim.duration);
          timePoints.add(anim.start + anim.fadeTime + anim.duration + anim.fadeTime);
        }
      });

      img.textOverlays.forEach((text) => {
        timePoints.add(text.start);
        timePoints.add(text.start + text.fadeTime);
        timePoints.add(text.start + text.fadeTime + text.duration);
        timePoints.add(text.start + text.fadeTime + text.duration + text.fadeTime);
      });

      const sortedTimes = Array.from(timePoints).sort((a, b) => a - b);

      const keyframes: Segment["keyframes"] = sortedTimes.map((time) => {
        let baseTransform = { x: img.initialX, y: img.initialY, scale: img.initialZoom };

        const sortedPanAnims = img.animations
          .filter((a) => a.type === "pan")
          .sort((a, b) => a.start - b.start);

        for (const panAnim of sortedPanAnims) {
          if (time >= panAnim.start + panAnim.fadeTime) {
            baseTransform = {
              x: panAnim.targetX,
              y: panAnim.targetY,
              scale: panAnim.targetScale,
            };
          }
        }

        const transform = { ...baseTransform };

        img.animations.forEach((anim) => {
          if (anim.type === "zoom") {
            const fadeInEnd = anim.start + anim.fadeTime;
            const fadeOutStart = anim.start + anim.fadeTime + anim.duration;
            const fadeOutEnd = fadeOutStart + anim.fadeTime;

            if (time >= anim.start && time <= fadeOutEnd) {
              let progress = 0;
              if (time < fadeInEnd) {
                progress = anim.fadeTime > 0 ? (time - anim.start) / anim.fadeTime : 1;
              } else if (time <= fadeOutStart) {
                progress = 1;
              } else {
                progress = anim.fadeTime > 0 ? 1 - (time - fadeOutStart) / anim.fadeTime : 0;
              }
              transform.scale =
                baseTransform.scale + (anim.targetScale - baseTransform.scale) * progress;
              transform.x = baseTransform.x + (anim.targetX - baseTransform.x) * progress;
              transform.y = baseTransform.y + (anim.targetY - baseTransform.y) * progress;
            }
          }
        });

        const highlights: HighlightRegion[] = [];
        const arrows: ArrowPointer[] = [];
        const textOverlays: TextOverlay[] = [];

        img.animations.forEach((anim) => {
          if (anim.type === "figure" || anim.type === "spotlight") {
            const fadeInEnd = anim.start + anim.fadeTime;
            const holdEnd = fadeInEnd + anim.duration;
            const fadeOutEnd = holdEnd + anim.fadeTime;
            let opacity = 0;
            if (time >= anim.start && time < fadeInEnd) {
              opacity = (time - anim.start) / anim.fadeTime;
            } else if (time >= fadeInEnd && time < holdEnd) {
              opacity = 1;
            } else if (time >= holdEnd && time < fadeOutEnd) {
              opacity = 1 - (time - holdEnd) / anim.fadeTime;
            }
            if (opacity > 0) {
              highlights.push({
                id: anim.id,
                type: anim.figureType,
                position: anim.position,
                size: anim.size,
                borderColor: anim.type === "figure" ? anim.borderColor : "#FFFFFF",
                borderWidth: anim.type === "figure" ? anim.borderWidth : 2,
                borderStyle: anim.type === "figure" ? anim.borderStyle : "solid",
                fillColor: "transparent",
                opacity,
                spotlight: anim.type === "spotlight",
              });
            }
          } else if (anim.type === "arrow") {
            const fadeInEnd = anim.start + anim.fadeTime;
            const holdEnd = fadeInEnd + anim.duration;
            const fadeOutEnd = holdEnd + anim.fadeTime;
            let opacity = 0;
            if (time >= anim.start && time < fadeInEnd) {
              opacity = (time - anim.start) / anim.fadeTime;
            } else if (time >= fadeInEnd && time < holdEnd) {
              opacity = 1;
            } else if (time >= holdEnd && time < fadeOutEnd) {
              opacity = 1 - (time - holdEnd) / anim.fadeTime;
            }
            if (opacity > 0) {
              arrows.push({
                id: anim.id,
                startPosition: anim.position,
                endPosition: anim.position,
                color: anim.color,
                strokeWidth: 2,
                opacity,
                direction: anim.direction,
              });
            }
          }
        });

        img.textOverlays.forEach((text) => {
          const fadeInEnd = text.start + text.fadeTime;
          const fadeOutStart = text.start + text.fadeTime + text.duration;
          const fadeOutEnd = fadeOutStart + text.fadeTime;
          let opacity = 0;
          if (time >= text.start && time < fadeInEnd) {
            opacity = text.fadeTime > 0 ? (time - text.start) / text.fadeTime : 1;
          } else if (time >= fadeInEnd && time <= fadeOutStart) {
            opacity = 1;
          } else if (time > fadeOutStart && time <= fadeOutEnd) {
            opacity = text.fadeTime > 0 ? (fadeOutEnd - time) / text.fadeTime : 0;
          }
          if (opacity > 0) {
            textOverlays.push({
              id: text.id,
              text: text.text,
              position: text.position,
              fontSize: text.fontSize,
              fontWeight: text.fontWeight,
              color: text.color,
              backgroundColor: text.backgroundColor,
              maxWidth: 80,
              textAlign: "center" as const,
              animation: "fade" as const,
              computedOpacity: Math.max(0, Math.min(1, opacity)),
            });
          }
        });

        return { time, transform, highlights, arrows, textOverlays };
      });

      return {
        id: `seg-${index}`,
        imageUrl: img.url,
        imageAlt: img.description || "Untitled",
        startTime,
        endTime,
        transition: (index < selectedImages.length - 1
          ? "crossfade"
          : "cut") as Segment["transition"],
        transitionDuration: index < selectedImages.length - 1 ? img.transitionDuration : 0,
        keyframes,
      };
    });

    const totalDuration = segments[segments.length - 1]?.endTime || 0;

    // Use audioDuration (actual audio length) for caption timing, not totalDuration
    // (segment block length). audioDuration is typically longer due to intro cushion
    // and tail; falling back to totalDuration only if audioDuration wasn't captured.
    const captionDuration = audioDuration > 0 ? audioDuration : totalDuration;
    const sequenceCaptions =
      audioTranscript && captionDuration > 0
        ? buildCaptionChunks(audioTranscript, captionDuration)
        : undefined;

    const sequence: ExplainerSequence = {
      version: 1,
      duration: totalDuration,
      aspectRatio: "16:9",
      segments,
      ...(audioUrl ? { audioUrl } : {}),
      ...(sequenceCaptions && sequenceCaptions.length > 0 ? { captions: sequenceCaptions } : {}),
    };

    // Round all floats to 4 decimal places to avoid 16-digit precision bloat
    const roundedJson = JSON.stringify(
      sequence,
      (_, value) => (typeof value === "number" ? Math.round(value * 10000) / 10000 : value),
      2
    );

    const blob = new Blob([roundedJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `explainer-sequence-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Open the export dialog (generate sequence first if needed).
  const renderVideo = () => {
    if (!previewSequence) generateSequence();
    setExportOpen(true);
  };

  // Actually run the canvas-render + FFmpeg pipeline.
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

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Lesson Studio</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={saveToJSON}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Save to JSON
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={renderVideo}
            disabled={selectedImages.length === 0}
            className="flex items-center gap-2"
          >
            <Video className="h-4 w-4" />
            Export MP4
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Sidebar - Sequence List */}
        <div className="w-80 border-r flex flex-col bg-muted/30">
          {/* Browse Library Button */}
          <div className="p-4 border-b">
            <ExplainerImageSelector
              onSelect={addImage}
              onSelectMultiple={addImages}
              trigger={
                <Button variant="outline" className="w-full">
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Browse Library
                </Button>
              }
            />
          </div>

          {/* Sequence List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {selectedImages.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-12">
                No images added yet
              </div>
            ) : (
              selectedImages.map((img, index) => {
                const figureCount = img.animations.filter((a) => a.type === "figure").length;
                const spotlightCount = img.animations.filter((a) => a.type === "spotlight").length;
                const arrowCount = img.animations.filter((a) => a.type === "arrow").length;
                const zoomCount = img.animations.filter((a) => a.type === "zoom").length;
                const panCount = img.animations.filter((a) => a.type === "pan").length;

                const tags = [
                  figureCount > 0 && `Fig ${figureCount}`,
                  spotlightCount > 0 && `Spot ${spotlightCount}`,
                  arrowCount > 0 && `Arrow ${arrowCount}`,
                  zoomCount > 0 && `Zoom ${zoomCount}`,
                  panCount > 0 && `Pan ${panCount}`,
                  img.textOverlays.length > 0 && `Text ${img.textOverlays.length}`,
                ]
                  .filter(Boolean)
                  .join(" • ");

                return (
                  <div
                    key={index}
                    className={`
                    border rounded-lg p-2 cursor-pointer transition-all
                    ${selectedImageIndex === index ? "border-blue-500 bg-blue-50 shadow-sm" : "border-gray-200 hover:border-gray-300"}
                  `}
                    onClick={() => handleSegmentSelect(index)}
                  >
                    <div className="flex gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.description || "Image"}
                        className="w-12 h-12 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{getImageTitle(img)}</div>
                        <div className="text-xs text-muted-foreground">
                          Segment {index + 1} • {formatNumber(img.duration)}s
                        </div>
                        {tags && <div className="text-xs text-muted-foreground mt-0.5">{tags}</div>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Audio */}
          <div className="p-4 border-t space-y-2">
            <Label className="text-xs">Audio</Label>
            {audioUrl ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 min-w-0">
                <Music className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate flex-1">{audioTitle || audioUrl}</span>
                {audioDuration > 0 && (
                  <span className="shrink-0 text-muted-foreground/70">
                    {formatNumber(audioDuration)}s
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No audio selected</p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setAudioPickerOpen(true)}
            >
              <Music className="h-4 w-4 mr-2" />
              {audioUrl ? "Change Audio" : "Select Audio"}
            </Button>
          </div>
        </div>

        {/* Center Stage - Preview & Editor */}
        <div className="flex-1 flex overflow-hidden">
          {/* Preview Area — also accepts JSON drops to reload a sequence */}
          <div
            className="flex-1 flex items-center justify-center bg-muted/30 p-8 relative"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={(e) => {
              // Only clear if leaving the container itself, not a child
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
            }}
            onDrop={handleStageDrop}
          >
            {/* Drop overlay */}
            {isDragOver && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-primary/10 border-2 border-dashed border-primary rounded-lg pointer-events-none">
                <Upload className="h-10 w-10 text-primary" />
                <p className="text-sm font-medium text-primary">Drop sequence JSON to load</p>
              </div>
            )}

            {previewSequence ? (
              <div ref={playerContainerRef} className="w-full max-w-5xl">
                <ExplainerPlayer
                  sequence={previewSequence}
                  audioUrl={audioUrl}
                  className="w-full"
                  seekToTime={seekTime}
                  onAudioLoaded={setAudioDuration}
                  captions={captionChunks.length > 0 ? captionChunks : undefined}
                />
              </div>
            ) : (
              <div className="text-center space-y-3">
                <div className="text-muted-foreground text-sm">No preview yet</div>
                <p className="text-xs text-muted-foreground/70">
                  {!audioUrl
                    ? "1. Select audio, 2. Add images, 3. Click AI Generate"
                    : selectedImages.length === 0
                      ? "Add images to the sequence"
                      : !audioTranscript
                        ? "Selected audio has no transcript — choose different audio or use Manual Preview"
                        : "Ready! Click AI Generate to create your sequence"}
                </p>
                {selectedImages.length > 0 && (
                  <div className="flex flex-col gap-2 items-center">
                    <Button
                      onClick={handleAIGenerate}
                      disabled={!audioUrl || !audioTranscript || isGenerating}
                      className="w-full"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating…
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          AI Generate
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={generateSequence}
                      disabled={!audioUrl || isGenerating}
                      className="w-full"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Manual Preview
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground/50 mt-2">
                  or drop a sequence JSON here to reload
                </p>
              </div>
            )}
          </div>

          {/* Right Panel - Editor Controls */}
          <div className="w-80 border-l bg-white overflow-y-auto flex flex-col">
            {selectedImageIndex !== null && selectedImages[selectedImageIndex] ? (
              <>
                {/* Header */}
                <div className="p-4 border-b bg-muted/30 flex items-center justify-between shrink-0">
                  <h3 className="font-semibold text-sm">Edit Segment {selectedImageIndex + 1}</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteConfirmIndex(selectedImageIndex)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Accordion Sections */}
                <Accordion type="single" defaultValue="framing" collapsible className="px-4">
                  {/* Timing */}
                  <AccordionItem value="timing">
                    <AccordionTrigger className="text-sm font-medium py-3">Timing</AccordionTrigger>
                    <AccordionContent className="space-y-2 pb-4">
                      <div>
                        <EditableLabel
                          label="Duration"
                          value={selectedImages[selectedImageIndex].duration}
                          min={3}
                          max={60}
                          step={0.1}
                          suffix="s"
                          onSave={(val) => updateImage(selectedImageIndex, "duration", val)}
                        />
                        <Input
                          type="range"
                          min={3}
                          max={60}
                          step={1}
                          value={selectedImages[selectedImageIndex].duration}
                          onChange={(e) =>
                            updateImage(selectedImageIndex, "duration", Number(e.target.value))
                          }
                          className="w-full [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:bg-primary"
                        />
                      </div>

                      <div>
                        <EditableLabel
                          label="Transition"
                          value={selectedImages[selectedImageIndex].transitionDuration}
                          min={0}
                          max={5}
                          step={0.1}
                          suffix="s"
                          onSave={(val) => updateImage(selectedImageIndex, "transitionDuration", val)}
                        />
                        <Input
                          type="range"
                          min={0}
                          max={5}
                          step={1}
                          value={selectedImages[selectedImageIndex].transitionDuration}
                          onChange={(e) =>
                            updateImage(
                              selectedImageIndex,
                              "transitionDuration",
                              Number(e.target.value)
                            )
                          }
                          disabled={selectedImageIndex === selectedImages.length - 1}
                          className="w-full [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:bg-primary"
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Image & Framing */}
                  <AccordionItem value="framing">
                    <AccordionTrigger className="text-sm font-medium py-3">
                      Image & Framing
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2 pb-4">
                      <div className="space-y-1">
                        <EditableLabel
                          label="Initial Zoom"
                          value={selectedImages[selectedImageIndex].initialZoom}
                          min={0.5}
                          max={2}
                          step={0.1}
                          suffix="x"
                          onSave={(val) => updateImage(selectedImageIndex, "initialZoom", val)}
                        />
                        <Input
                          type="range"
                          min={0.5}
                          max={2}
                          step={0.1}
                          value={selectedImages[selectedImageIndex].initialZoom}
                          onChange={(e) =>
                            updateImage(selectedImageIndex, "initialZoom", Number(e.target.value))
                          }
                          className="w-full [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:bg-primary"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <EditableLabel
                            label="X"
                            value={selectedImages[selectedImageIndex].initialX}
                            min={-50}
                            max={50}
                            step={1}
                            suffix="%"
                            onSave={(val) => updateImage(selectedImageIndex, "initialX", val)}
                          />
                          <Input
                            type="range"
                            min={-50}
                            max={50}
                            step={1}
                            value={selectedImages[selectedImageIndex].initialX}
                            onChange={(e) =>
                              updateImage(selectedImageIndex, "initialX", Number(e.target.value))
                            }
                            className="w-full [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:bg-primary"
                          />
                        </div>

                        <div className="space-y-1">
                          <EditableLabel
                            label="Y"
                            value={selectedImages[selectedImageIndex].initialY}
                            min={-50}
                            max={50}
                            step={1}
                            suffix="%"
                            onSave={(val) => updateImage(selectedImageIndex, "initialY", val)}
                          />
                          <Input
                            type="range"
                            min={-50}
                            max={50}
                            step={1}
                            value={selectedImages[selectedImageIndex].initialY}
                            onChange={(e) =>
                              updateImage(selectedImageIndex, "initialY", Number(e.target.value))
                            }
                            className="w-full [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:bg-primary"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const img = selectedImages[selectedImageIndex];
                            updateImage(selectedImageIndex, "initialZoom", calculateCoverZoom(img));
                          }}
                          className="text-xs h-7"
                        >
                          Zoom to Fit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const img = selectedImages[selectedImageIndex];
                            updateImage(selectedImageIndex, "initialZoom", calculateCoverZoom(img));
                            updateImage(selectedImageIndex, "initialX", 0);
                            updateImage(selectedImageIndex, "initialY", 0);
                          }}
                          className="text-xs h-7"
                        >
                          Reset to Default
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Zoom & Pan */}
                  <AccordionItem value="zoom">
                    <AccordionTrigger className="text-sm font-medium py-3">
                      Zoom & Pan (
                      {
                        selectedImages[selectedImageIndex].animations.filter(
                          (a) => a.type === "zoom" || a.type === "pan"
                        ).length
                      }
                      )
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pb-4">
                      <div className="space-y-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addAnimation(selectedImageIndex, "zoom")}
                          className="w-full text-xs h-7"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Zoom
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addAnimation(selectedImageIndex, "pan")}
                          className="w-full text-xs h-7"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Pan
                        </Button>
                      </div>

                      {selectedImages[selectedImageIndex].animations.filter(
                        (a) => a.type === "zoom" || a.type === "pan"
                      ).length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center py-4">
                          No camera animations yet
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedImages[selectedImageIndex].animations
                            .filter((a) => a.type === "zoom" || a.type === "pan")
                            .map((anim) => (
                              <div
                                key={anim.id}
                                className="p-3 border rounded-lg bg-muted/20 space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium">
                                    {getAnimationDisplayName(anim.type)}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => removeAnimation(selectedImageIndex, anim.id)}
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>

                                {/* Timing controls */}
                                <div
                                  className={`grid ${anim.type === "pan" ? "grid-cols-2" : "grid-cols-3"} gap-2`}
                                >
                                  <div>
                                    <Label className="text-xs">Start (s)</Label>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={selectedImages[selectedImageIndex].duration}
                                      step={0.1}
                                      defaultValue={anim.start}
                                      key={`anim-start-${anim.id}`}
                                      onBlur={(e) => {
                                        const val = Number(e.target.value);
                                        if (!isNaN(val)) {
                                          updateAnimation(selectedImageIndex, anim.id, {
                                            start: Math.max(
                                              0,
                                              Math.min(
                                                selectedImages[selectedImageIndex].duration,
                                                val
                                              )
                                            ),
                                          });
                                        }
                                      }}
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                  {anim.type === "zoom" && (
                                    <div>
                                      <Label className="text-xs">Duration (s)</Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        max={selectedImages[selectedImageIndex].duration}
                                        step={0.1}
                                        defaultValue={anim.duration}
                                        key={`anim-duration-${anim.id}`}
                                        onBlur={(e) => {
                                          const val = Number(e.target.value);
                                          if (!isNaN(val)) {
                                            updateAnimation(selectedImageIndex, anim.id, {
                                              duration: Math.max(
                                                0,
                                                Math.min(
                                                  selectedImages[selectedImageIndex].duration,
                                                  val
                                                )
                                              ),
                                            });
                                          }
                                        }}
                                        className="h-7 text-xs"
                                      />
                                    </div>
                                  )}
                                  <div>
                                    <Label className="text-xs">Fade (s)</Label>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={
                                        anim.type === "pan"
                                          ? selectedImages[selectedImageIndex].duration
                                          : 2
                                      }
                                      step={0.1}
                                      defaultValue={anim.fadeTime}
                                      key={`anim-fade-${anim.id}`}
                                      onBlur={(e) => {
                                        const val = Number(e.target.value);
                                        if (!isNaN(val)) {
                                          const maxFade =
                                            anim.type === "pan"
                                              ? selectedImages[selectedImageIndex].duration
                                              : 2;
                                          updateAnimation(selectedImageIndex, anim.id, {
                                            fadeTime: Math.max(0, Math.min(maxFade, val)),
                                          });
                                        }
                                      }}
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                </div>

                                {/* Type-specific controls */}
                                {(anim.type === "zoom" || anim.type === "pan") && (
                                  <>
                                    <div>
                                      <EditableLabel
                                        label="Target Scale"
                                        value={anim.targetScale}
                                        min={0.5}
                                        max={3}
                                        step={0.1}
                                        suffix="x"
                                        onSave={(val) =>
                                          updateAnimation(selectedImageIndex, anim.id, {
                                            targetScale: val,
                                          })
                                        }
                                      />
                                      <Input
                                        type="range"
                                        min={0.5}
                                        max={3}
                                        step={0.1}
                                        value={anim.targetScale}
                                        onChange={(e) =>
                                          updateAnimation(selectedImageIndex, anim.id, {
                                            targetScale: Number(e.target.value),
                                          })
                                        }
                                        className="h-6 [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:bg-primary"
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <EditableLabel
                                          label="Target X"
                                          value={50 - anim.targetX}
                                          min={0}
                                          max={100}
                                          step={5}
                                          suffix="%"
                                          onSave={(val) =>
                                            updateAnimation(selectedImageIndex, anim.id, {
                                              targetX: 50 - val,
                                            })
                                          }
                                        />
                                        <Input
                                          type="range"
                                          min={0}
                                          max={100}
                                          step={5}
                                          value={50 - anim.targetX}
                                          onChange={(e) =>
                                            updateAnimation(selectedImageIndex, anim.id, {
                                              targetX: 50 - Number(e.target.value),
                                            })
                                          }
                                          className="h-6"
                                        />
                                      </div>
                                      <div>
                                        <EditableLabel
                                          label="Target Y"
                                          value={50 - anim.targetY}
                                          min={0}
                                          max={100}
                                          step={5}
                                          suffix="%"
                                          onSave={(val) =>
                                            updateAnimation(selectedImageIndex, anim.id, {
                                              targetY: 50 - val,
                                            })
                                          }
                                        />
                                        <Input
                                          type="range"
                                          min={0}
                                          max={100}
                                          step={5}
                                          value={50 - anim.targetY}
                                          onChange={(e) =>
                                            updateAnimation(selectedImageIndex, anim.id, {
                                              targetY: 50 - Number(e.target.value),
                                            })
                                          }
                                          className="h-6"
                                        />
                                      </div>
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-full h-7 text-xs"
                                      onClick={() => {
                                        const img = selectedImages[selectedImageIndex];
                                        updateAnimation(selectedImageIndex, anim.id, {
                                          targetScale: img.initialZoom,
                                          targetX: img.initialX,
                                          targetY: img.initialY,
                                        });
                                      }}
                                    >
                                      Reset to Default
                                    </Button>
                                  </>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  {/* Animations */}
                  <AccordionItem value="annotations">
                    <AccordionTrigger className="text-sm font-medium py-3">
                      Animations (
                      {
                        selectedImages[selectedImageIndex].animations.filter(
                          (a) => a.type !== "zoom" && a.type !== "pan"
                        ).length
                      }
                      )
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pb-4">
                      {/* Add Annotation Buttons */}
                      <div className="space-y-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addAnimation(selectedImageIndex, "figure")}
                          className="w-full text-xs h-7"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Shapes
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addAnimation(selectedImageIndex, "spotlight")}
                          className="w-full text-xs h-7"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Spotlight
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addAnimation(selectedImageIndex, "arrow")}
                          className="w-full text-xs h-7"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Arrows
                        </Button>
                      </div>

                      {selectedImages[selectedImageIndex].animations.filter(
                        (a) => a.type !== "zoom" && a.type !== "pan"
                      ).length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center py-4">
                          No annotations yet
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedImages[selectedImageIndex].animations
                            .filter((a) => a.type !== "zoom" && a.type !== "pan")
                            .map((anim) => (
                              <div
                                key={anim.id}
                                className="p-3 border rounded-lg bg-muted/20 space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium">
                                    {getAnimationDisplayName(anim.type)}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => removeAnimation(selectedImageIndex, anim.id)}
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>

                                {/* Timing controls */}
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <Label className="text-xs">Start (s)</Label>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={selectedImages[selectedImageIndex].duration}
                                      step={0.1}
                                      defaultValue={anim.start}
                                      key={`anim-start-${anim.id}-${selectedImageIndex}`}
                                      onBlur={(e) => {
                                        const val = Number(e.target.value);
                                        if (!isNaN(val)) {
                                          updateAnimation(selectedImageIndex, anim.id, {
                                            start: Math.max(
                                              0,
                                              Math.min(
                                                selectedImages[selectedImageIndex].duration,
                                                val
                                              )
                                            ),
                                          });
                                        }
                                      }}
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Duration (s)</Label>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={selectedImages[selectedImageIndex].duration}
                                      step={0.1}
                                      defaultValue={anim.duration}
                                      key={`anim-duration-${anim.id}-${selectedImageIndex}`}
                                      onBlur={(e) => {
                                        const val = Number(e.target.value);
                                        if (!isNaN(val)) {
                                          updateAnimation(selectedImageIndex, anim.id, {
                                            duration: Math.max(
                                              0,
                                              Math.min(
                                                selectedImages[selectedImageIndex].duration,
                                                val
                                              )
                                            ),
                                          });
                                        }
                                      }}
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Fade (s)</Label>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={2}
                                      step={0.1}
                                      defaultValue={anim.fadeTime}
                                      key={`anim-fade-${anim.id}-${selectedImageIndex}`}
                                      onBlur={(e) => {
                                        const val = Number(e.target.value);
                                        if (!isNaN(val)) {
                                          updateAnimation(selectedImageIndex, anim.id, {
                                            fadeTime: Math.max(0, Math.min(2, val)),
                                          });
                                        }
                                      }}
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                </div>

                                {/* Type-specific controls */}
                                {(anim.type === "figure" || anim.type === "spotlight") && (
                                  <>
                                    <div>
                                      <Label className="text-xs">Shape</Label>
                                      <Select
                                        value={anim.figureType}
                                        onValueChange={(value) =>
                                          updateAnimation(selectedImageIndex, anim.id, {
                                            figureType: value as "circle" | "rectangle",
                                          })
                                        }
                                      >
                                        <SelectTrigger className="h-7 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="circle">Circle</SelectItem>
                                          <SelectItem value="oval">Oval</SelectItem>
                                          <SelectItem value="rectangle">Rectangle</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <EditableLabel
                                          label="X"
                                          value={anim.position.x}
                                          min={0}
                                          max={100}
                                          step={5}
                                          suffix="%"
                                          onSave={(val) =>
                                            updateAnimation(selectedImageIndex, anim.id, {
                                              position: { ...anim.position, x: val },
                                            })
                                          }
                                        />
                                        <Input
                                          type="range"
                                          min={0}
                                          max={100}
                                          step={5}
                                          value={anim.position.x}
                                          onChange={(e) =>
                                            updateAnimation(selectedImageIndex, anim.id, {
                                              position: {
                                                ...anim.position,
                                                x: Number(e.target.value),
                                              },
                                            })
                                          }
                                          className="h-6"
                                        />
                                      </div>
                                      <div>
                                        <EditableLabel
                                          label="Y"
                                          value={anim.position.y}
                                          min={0}
                                          max={100}
                                          step={5}
                                          suffix="%"
                                          onSave={(val) =>
                                            updateAnimation(selectedImageIndex, anim.id, {
                                              position: { ...anim.position, y: val },
                                            })
                                          }
                                        />
                                        <Input
                                          type="range"
                                          min={0}
                                          max={100}
                                          step={5}
                                          value={anim.position.y}
                                          onChange={(e) =>
                                            updateAnimation(selectedImageIndex, anim.id, {
                                              position: {
                                                ...anim.position,
                                                y: Number(e.target.value),
                                              },
                                            })
                                          }
                                          className="h-6"
                                        />
                                      </div>
                                    </div>
                                    {anim.figureType === "circle" ? (
                                      <div>
                                        <EditableLabel
                                          label="Radius"
                                          value={anim.size.width}
                                          min={10}
                                          max={100}
                                          step={5}
                                          suffix="%"
                                          onSave={(val) =>
                                            updateAnimation(selectedImageIndex, anim.id, {
                                              size: { ...anim.size, width: val },
                                            })
                                          }
                                        />
                                        <Input
                                          type="range"
                                          min={10}
                                          max={100}
                                          step={5}
                                          value={anim.size.width}
                                          onChange={(e) =>
                                            updateAnimation(selectedImageIndex, anim.id, {
                                              size: { ...anim.size, width: Number(e.target.value) },
                                            })
                                          }
                                          className="h-6"
                                        />
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <EditableLabel
                                            label="Width"
                                            value={anim.size.width}
                                            min={10}
                                            max={100}
                                            step={5}
                                            suffix="%"
                                            onSave={(val) =>
                                              updateAnimation(selectedImageIndex, anim.id, {
                                                size: { ...anim.size, width: val },
                                              })
                                            }
                                          />
                                          <Input
                                            type="range"
                                            min={10}
                                            max={100}
                                            step={5}
                                            value={anim.size.width}
                                            onChange={(e) =>
                                              updateAnimation(selectedImageIndex, anim.id, {
                                                size: {
                                                  ...anim.size,
                                                  width: Number(e.target.value),
                                                },
                                              })
                                            }
                                            className="h-6"
                                          />
                                        </div>
                                        <div>
                                          <EditableLabel
                                            label="Height"
                                            value={anim.size.height}
                                            min={10}
                                            max={100}
                                            step={5}
                                            suffix="%"
                                            onSave={(val) =>
                                              updateAnimation(selectedImageIndex, anim.id, {
                                                size: { ...anim.size, height: val },
                                              })
                                            }
                                          />
                                          <Input
                                            type="range"
                                            min={10}
                                            max={100}
                                            step={5}
                                            value={anim.size.height}
                                            onChange={(e) =>
                                              updateAnimation(selectedImageIndex, anim.id, {
                                                size: {
                                                  ...anim.size,
                                                  height: Number(e.target.value),
                                                },
                                              })
                                            }
                                            className="h-6"
                                          />
                                        </div>
                                      </div>
                                    )}
                                    {anim.type === "figure" && (
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <Label className="text-xs mb-2 block">Border Color</Label>
                                          <div className="flex gap-2 items-center flex-wrap">
                                            {[
                                              { color: "#FFFFFF", label: "White" },
                                              { color: "#000000", label: "Black" },
                                            ].map((option) => (
                                              <button
                                                key={option.color}
                                                type="button"
                                                onClick={() =>
                                                  updateAnimation(selectedImageIndex, anim.id, {
                                                    borderColor: option.color,
                                                  })
                                                }
                                                className={`
                                              w-6 h-6 rounded-full border-2 transition-all
                                              ${anim.borderColor.toUpperCase() === option.color ? "ring-2 ring-primary ring-offset-1" : "hover:scale-110"}
                                            `}
                                                style={{
                                                  backgroundColor: option.color,
                                                  borderColor:
                                                    option.color === "#FFFFFF"
                                                      ? "#E5E7EB"
                                                      : option.color,
                                                }}
                                                title={option.label}
                                              />
                                            ))}
                                            <div className="relative">
                                              <input
                                                type="color"
                                                id={`figure-color-picker-${anim.id}`}
                                                value={anim.borderColor}
                                                onChange={(e) =>
                                                  updateAnimation(selectedImageIndex, anim.id, {
                                                    borderColor: e.target.value,
                                                  })
                                                }
                                                className="absolute opacity-0 w-0 h-0"
                                              />
                                              <label
                                                htmlFor={`figure-color-picker-${anim.id}`}
                                                className="cursor-pointer hover:scale-110 transition-all flex items-center justify-center"
                                                title="Custom color"
                                              >
                                                <Palette className="h-5 w-5 text-gray-600" />
                                              </label>
                                            </div>
                                          </div>
                                        </div>
                                        <div>
                                          <Label className="text-xs mb-2 block">Border Style</Label>
                                          <div className="flex gap-1">
                                            {[
                                              { style: "solid", label: "Solid" },
                                              { style: "dotted", label: "Dotted" },
                                              { style: "dashed", label: "Dashed" },
                                            ].map((option) => (
                                              <button
                                                key={option.style}
                                                type="button"
                                                onClick={() =>
                                                  updateAnimation(selectedImageIndex, anim.id, {
                                                    borderStyle:
                                                      option.style as typeof anim.borderStyle,
                                                  })
                                                }
                                                className={`
                                              px-2 py-1 text-xs rounded transition-all
                                              ${
                                                anim.borderStyle === option.style
                                                  ? "bg-primary text-primary-foreground"
                                                  : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                                              }
                                            `}
                                              >
                                                {option.label}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}

                                {anim.type === "arrow" && (
                                  <>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <EditableLabel
                                          label="X"
                                          value={anim.position.x}
                                          min={0}
                                          max={100}
                                          step={5}
                                          suffix="%"
                                          onSave={(val) =>
                                            updateAnimation(selectedImageIndex, anim.id, {
                                              position: { ...anim.position, x: val },
                                            })
                                          }
                                        />
                                        <Input
                                          type="range"
                                          min={0}
                                          max={100}
                                          step={5}
                                          value={anim.position.x}
                                          onChange={(e) =>
                                            updateAnimation(selectedImageIndex, anim.id, {
                                              position: {
                                                ...anim.position,
                                                x: Number(e.target.value),
                                              },
                                            })
                                          }
                                          className="h-6"
                                        />
                                      </div>
                                      <div>
                                        <EditableLabel
                                          label="Y"
                                          value={anim.position.y}
                                          min={0}
                                          max={100}
                                          step={5}
                                          suffix="%"
                                          onSave={(val) =>
                                            updateAnimation(selectedImageIndex, anim.id, {
                                              position: { ...anim.position, y: val },
                                            })
                                          }
                                        />
                                        <Input
                                          type="range"
                                          min={0}
                                          max={100}
                                          step={5}
                                          value={anim.position.y}
                                          onChange={(e) =>
                                            updateAnimation(selectedImageIndex, anim.id, {
                                              position: {
                                                ...anim.position,
                                                y: Number(e.target.value),
                                              },
                                            })
                                          }
                                          className="h-6"
                                        />
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <Label className="text-xs mb-2 block">Direction</Label>
                                        <div className="grid grid-cols-3 gap-0.5 w-fit">
                                          {[
                                            { dir: "up-left", label: "↖" },
                                            { dir: "up", label: "↑" },
                                            { dir: "up-right", label: "↗" },
                                            { dir: "left", label: "←" },
                                            { dir: null, label: "•" },
                                            { dir: "right", label: "→" },
                                            { dir: "down-left", label: "↙" },
                                            { dir: "down", label: "↓" },
                                            { dir: "down-right", label: "↘" },
                                          ].map((item, idx) => (
                                            <button
                                              key={idx}
                                              type="button"
                                              disabled={!item.dir}
                                              onClick={() =>
                                                item.dir &&
                                                updateAnimation(selectedImageIndex, anim.id, {
                                                  direction: item.dir as typeof anim.direction,
                                                })
                                              }
                                              className={`
                                            w-6 h-6 flex items-center justify-center text-sm rounded
                                            ${!item.dir ? "cursor-default text-gray-400" : ""}
                                            ${
                                              item.dir && anim.direction === item.dir
                                                ? "bg-primary text-primary-foreground"
                                                : item.dir
                                                  ? "bg-gray-100 hover:bg-gray-200 text-gray-700"
                                                  : "bg-transparent"
                                            }
                                            transition-all
                                          `}
                                              title={item.dir ? item.dir : "center"}
                                            >
                                              {item.label}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                      <div>
                                        <Label className="text-xs mb-2 block">Color</Label>
                                        <div className="flex gap-2 items-center flex-wrap">
                                          {[
                                            { color: "#FFFFFF", label: "White" },
                                            { color: "#000000", label: "Black" },
                                          ].map((option) => (
                                            <button
                                              key={option.color}
                                              type="button"
                                              onClick={() =>
                                                updateAnimation(selectedImageIndex, anim.id, {
                                                  color: option.color,
                                                })
                                              }
                                              className={`
                                            w-6 h-6 rounded-full border-2 transition-all
                                            ${anim.color.toUpperCase() === option.color ? "ring-2 ring-primary ring-offset-1" : "hover:scale-110"}
                                          `}
                                              style={{
                                                backgroundColor: option.color,
                                                borderColor:
                                                  option.color === "#FFFFFF"
                                                    ? "#E5E7EB"
                                                    : option.color,
                                              }}
                                              title={option.label}
                                            />
                                          ))}
                                          <div className="relative">
                                            <input
                                              type="color"
                                              id={`arrow-color-picker-${anim.id}`}
                                              value={anim.color}
                                              onChange={(e) =>
                                                updateAnimation(selectedImageIndex, anim.id, {
                                                  color: e.target.value,
                                                })
                                              }
                                              className="absolute opacity-0 w-0 h-0"
                                            />
                                            <label
                                              htmlFor={`arrow-color-picker-${anim.id}`}
                                              className="cursor-pointer hover:scale-110 transition-all flex items-center justify-center"
                                              title="Custom color"
                                            >
                                              <Palette className="h-5 w-5 text-gray-600" />
                                            </label>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  {/* Text */}
                  <AccordionItem value="text">
                    <AccordionTrigger className="text-sm font-medium py-3">
                      Text ({selectedImages[selectedImageIndex].textOverlays.length})
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pb-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addText(selectedImageIndex)}
                        className="w-full text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Text
                      </Button>

                      {selectedImages[selectedImageIndex].textOverlays.length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center py-4">
                          No text overlays yet
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedImages[selectedImageIndex].textOverlays.map((text) => (
                            <div
                              key={text.id}
                              className="p-3 border rounded-lg bg-muted/20 space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium">Text</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeText(selectedImageIndex, text.id)}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>

                              <div>
                                <Input
                                  value={text.text}
                                  onChange={(e) =>
                                    updateText(selectedImageIndex, text.id, {
                                      text: e.target.value,
                                    })
                                  }
                                  className="h-7 text-xs"
                                />
                              </div>

                              {/* Timing controls */}
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <Label className="text-xs">Start (s)</Label>
                                  <Input
                                    key={`start-${text.id}-${selectedImageIndex}`}
                                    type="number"
                                    min={0}
                                    max={selectedImages[selectedImageIndex].duration}
                                    step={0.1}
                                    defaultValue={text.start}
                                    onBlur={(e) => {
                                      const val = Number(e.target.value);
                                      if (!isNaN(val)) {
                                        updateText(selectedImageIndex, text.id, {
                                          start: Math.max(
                                            0,
                                            Math.min(
                                              selectedImages[selectedImageIndex].duration,
                                              val
                                            )
                                          ),
                                        });
                                      }
                                    }}
                                    className="h-7 text-xs"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Duration (s)</Label>
                                  <Input
                                    key={`duration-${text.id}-${selectedImageIndex}`}
                                    type="number"
                                    min={0}
                                    max={selectedImages[selectedImageIndex].duration}
                                    step={0.1}
                                    defaultValue={text.duration}
                                    onBlur={(e) => {
                                      const val = Number(e.target.value);
                                      if (!isNaN(val)) {
                                        updateText(selectedImageIndex, text.id, {
                                          duration: Math.max(
                                            0,
                                            Math.min(
                                              selectedImages[selectedImageIndex].duration,
                                              val
                                            )
                                          ),
                                        });
                                      }
                                    }}
                                    className="h-7 text-xs"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Fade (s)</Label>
                                  <Input
                                    key={`fade-${text.id}-${selectedImageIndex}`}
                                    type="number"
                                    min={0}
                                    max={2}
                                    step={0.1}
                                    defaultValue={text.fadeTime}
                                    onBlur={(e) => {
                                      const val = Number(e.target.value);
                                      if (!isNaN(val)) {
                                        updateText(selectedImageIndex, text.id, {
                                          fadeTime: Math.max(0, Math.min(2, val)),
                                        });
                                      }
                                    }}
                                    className="h-7 text-xs"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <EditableLabel
                                    label="X"
                                    value={text.position.x}
                                    min={0}
                                    max={100}
                                    step={5}
                                    suffix="%"
                                    onSave={(val) =>
                                      updateText(selectedImageIndex, text.id, {
                                        position: { ...text.position, x: val },
                                      })
                                    }
                                  />
                                  <Input
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={5}
                                    value={text.position.x}
                                    onChange={(e) =>
                                      updateText(selectedImageIndex, text.id, {
                                        position: { ...text.position, x: Number(e.target.value) },
                                      })
                                    }
                                    className="h-6"
                                  />
                                </div>
                                <div>
                                  <EditableLabel
                                    label="Y"
                                    value={text.position.y}
                                    min={0}
                                    max={100}
                                    step={5}
                                    suffix="%"
                                    onSave={(val) =>
                                      updateText(selectedImageIndex, text.id, {
                                        position: { ...text.position, y: val },
                                      })
                                    }
                                  />
                                  <Input
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={5}
                                    value={text.position.y}
                                    onChange={(e) =>
                                      updateText(selectedImageIndex, text.id, {
                                        position: { ...text.position, y: Number(e.target.value) },
                                      })
                                    }
                                    className="h-6"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">Font Size: {formatNumber(text.fontSize)}rem</Label>
                                  <Input
                                    type="range"
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    value={text.fontSize}
                                    onChange={(e) =>
                                      updateText(selectedImageIndex, text.id, {
                                        fontSize: Number(e.target.value),
                                      })
                                    }
                                    className="h-6 [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:bg-primary"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Weight</Label>
                                  <Select
                                    value={text.fontWeight}
                                    onValueChange={(value) =>
                                      updateText(selectedImageIndex, text.id, {
                                        fontWeight: value as "normal" | "bold" | "semibold",
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-7 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="normal">Normal</SelectItem>
                                      <SelectItem value="semibold">Semibold</SelectItem>
                                      <SelectItem value="bold">Bold</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs mb-2 block">Text Color</Label>
                                <div className="flex gap-2 items-center">
                                  {[
                                    { color: "#FFFFFF", label: "White" },
                                    { color: "#000000", label: "Black" },
                                  ].map((option) => (
                                    <button
                                      key={option.color}
                                      type="button"
                                      onClick={() =>
                                        updateText(selectedImageIndex, text.id, {
                                          color: option.color,
                                        })
                                      }
                                      className={`
                                      w-6 h-6 rounded-full border-2 transition-all
                                      ${text.color.toUpperCase() === option.color ? "ring-2 ring-primary ring-offset-1" : "hover:scale-110"}
                                    `}
                                      style={{
                                        backgroundColor: option.color,
                                        borderColor:
                                          option.color === "#FFFFFF" ? "#E5E7EB" : option.color,
                                      }}
                                      title={option.label}
                                    />
                                  ))}
                                  <div className="relative">
                                    <input
                                      type="color"
                                      id={`text-color-picker-${text.id}`}
                                      value={text.color}
                                      onChange={(e) =>
                                        updateText(selectedImageIndex, text.id, {
                                          color: e.target.value,
                                        })
                                      }
                                      className="absolute opacity-0 w-0 h-0"
                                    />
                                    <label
                                      htmlFor={`text-color-picker-${text.id}`}
                                      className="cursor-pointer hover:scale-110 transition-all flex items-center justify-center"
                                      title="Custom color"
                                    >
                                      <Palette className="h-5 w-5 text-gray-600" />
                                    </label>
                                  </div>
                                </div>
                                </div>
                                <div>
                                  <Label className="text-xs mb-2 block">Background Color</Label>
                                <div className="flex gap-2 items-center">
                                  {[
                                    {
                                      color: undefined,
                                      label: "Transparent",
                                      display: "transparent",
                                    },
                                    { color: "#FFFFFF", label: "White", display: "#FFFFFF" },
                                    { color: "#000000", label: "Black", display: "#000000" },
                                    {
                                      color: "rgba(0, 0, 0, 0.7)",
                                      label: "Semi-transparent",
                                      display: "rgba(0, 0, 0, 0.7)",
                                    },
                                  ].map((option, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() =>
                                        updateText(selectedImageIndex, text.id, {
                                          backgroundColor: option.color,
                                        })
                                      }
                                      className={`
                                      w-6 h-6 rounded-full border-2 transition-all relative
                                      ${text.backgroundColor === option.color ? "ring-2 ring-primary ring-offset-1" : "hover:scale-110"}
                                    `}
                                      style={{
                                        backgroundColor: option.display,
                                        borderColor:
                                          option.display === "#FFFFFF"
                                            ? "#E5E7EB"
                                            : option.display === "transparent"
                                              ? "#E5E7EB"
                                              : option.display,
                                        backgroundImage:
                                          option.display === "transparent"
                                            ? "linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)"
                                            : undefined,
                                        backgroundSize:
                                          option.display === "transparent" ? "6px 6px" : undefined,
                                        backgroundPosition:
                                          option.display === "transparent"
                                            ? "0 0, 3px 3px"
                                            : undefined,
                                      }}
                                      title={option.label}
                                    />
                                  ))}
                                  <div className="relative">
                                    <input
                                      type="color"
                                      id={`bg-color-picker-${text.id}`}
                                      value={text.backgroundColor || "#000000"}
                                      onChange={(e) =>
                                        updateText(selectedImageIndex, text.id, {
                                          backgroundColor: e.target.value,
                                        })
                                      }
                                      className="absolute opacity-0 w-0 h-0"
                                    />
                                    <label
                                      htmlFor={`bg-color-picker-${text.id}`}
                                      className="cursor-pointer hover:scale-110 transition-all flex items-center justify-center"
                                      title="Custom color"
                                    >
                                      <Palette className="h-5 w-5 text-gray-600" />
                                    </label>
                                  </div>
                                </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Update Preview Button */}
                <div className="p-4 border-t">
                  <Button
                    onClick={generateSequence}
                    className="w-full"
                    variant="default"
                    disabled={!audioUrl}
                  >
                    Update Preview
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-8">
                <p className="text-sm text-muted-foreground">No segment selected</p>
                <p className="text-xs text-muted-foreground/60">
                  Click a segment in the sequence to edit its settings
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Timeline */}
      <div className="h-40 border-t bg-white pb-4">
        {selectedImages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Timeline will appear here
          </div>
        ) : (
          <div className="h-full flex flex-col relative">
            {/* Time Ruler */}
            <div className="relative h-8 border-b bg-muted/20 px-8">
              <div className="relative h-full">
                {(() => {
                  const segmentsDuration = selectedImages.reduce((sum, img) => sum + img.duration, 0);
                  const baseTimelineDuration = Math.max(segmentsDuration, audioDuration);
                  const endCushion = 2; // small visual breathing room on the right
                  const timelineDuration = baseTimelineDuration + endCushion;
                  const ticks = [];

                  // Generate tick marks
                  for (let t = 0; t <= baseTimelineDuration; t += 1) {
                    const isMajor = t % 5 === 0;
                    const left = (t / timelineDuration) * 100;

                    ticks.push(
                      <div
                        key={t}
                        className="absolute flex flex-col items-center"
                        style={{ left: `${left}%`, transform: "translateX(-50%)" }}
                      >
                        {/* Tick mark */}
                        <div
                          className={`${isMajor ? "h-4 w-0.5 bg-gray-400" : "h-2 w-px bg-gray-300"}`}
                        />
                        {/* Time label for major ticks */}
                        {isMajor && (
                          <span className="text-[10px] text-muted-foreground mt-0.5 select-none">
                            {formatNumber(t)}s
                          </span>
                        )}
                      </div>
                    );
                  }

                  return ticks;
                })()}
              </div>
            </div>

            {/* Segment Blocks */}
            <div className="flex-1 relative px-8 py-3 overflow-x-auto" ref={timelineRef}>
              <div className="h-full flex relative">
                {(() => {
                  const segmentsDuration = selectedImages.reduce((sum, i) => sum + i.duration, 0);
                  const baseTimelineDuration = Math.max(segmentsDuration, audioDuration);
                  const endCushion = 2;
                  const timelineDuration = baseTimelineDuration + endCushion;

                  return (
                    <>
                      {/* Segments */}
                      {selectedImages.map((img, index) => {
                        const widthPercent = (img.duration / timelineDuration) * 100;

                        // Determine text size based on segment duration/width
                        // Very narrow segments (< 3% of timeline or < 2s)
                        const isVeryNarrow = widthPercent < 3 || img.duration < 2;
                        // Narrow segments (< 5% of timeline or < 4s)
                        const isNarrow = widthPercent < 5 || img.duration < 4;

                        let segmentLabel = `Segment ${index + 1}`;
                        let showDetails = true;

                        if (isVeryNarrow) {
                          segmentLabel = `S${index + 1}`;
                          showDetails = false;
                        } else if (isNarrow) {
                          segmentLabel = `Seg ${index + 1}`;
                          showDetails = false;
                        }

                        return (
                          <div
                            key={index}
                            className={`
                        h-full rounded transition-all cursor-pointer relative group overflow-hidden
                        ${selectedImageIndex === index ? "ring-2 ring-blue-600 ring-offset-2" : ""}
                      `}
                            style={{ width: `${widthPercent}%`, minWidth: "40px" }}
                            onClick={() => handleSegmentSelect(index)}
                          >
                            {/* Background Image */}
                            <div
                              className="absolute inset-0 bg-cover bg-center"
                              style={{
                                backgroundImage: `url(${img.url})`,
                                filter: "brightness(0.7)",
                              }}
                            />

                            {/* Colored bar at top - alternating primary and yellow */}
                            <div
                              className={`absolute top-0 left-0 right-0 h-1 ${index % 2 === 0 ? "bg-primary" : "bg-yellow-500"}`}
                            />

                            {/* Segment info overlay */}
                            <div className="relative h-full p-2 flex flex-col text-white">
                              <div className="text-xs font-semibold truncate drop-shadow-md">
                                {segmentLabel}
                              </div>
                              {showDetails && (
                                <>
                                  <div className="text-[10px] opacity-90 mt-0.5 drop-shadow-md">
                                    {formatNumber(img.duration)}s
                                  </div>
                                  <div className="flex-1" />
                                  <div className="text-[10px] opacity-90 drop-shadow-md truncate">
                                    {img.animations.length} anim
                                    {img.animations.length !== 1 ? "s" : ""} •{" "}
                                    {img.textOverlays.length} text
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Tooltip on hover */}
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 pointer-events-none">
                              <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                                {getImageTitle(img)} ({formatNumber(img.duration)}s)
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Audio end marker - spans entire timeline height */}
            {audioDuration > 0 &&
              (() => {
                const segmentsDuration = selectedImages.reduce((sum, img) => sum + img.duration, 0);
                const baseTimelineDuration = Math.max(segmentsDuration, audioDuration);
                const endCushion = 2;
                const timelineDuration = baseTimelineDuration + endCushion;
                const audioEndLeft = (audioDuration / timelineDuration) * 100;

                return (
                  <div
                    className="absolute top-0 bottom-0 bg-red-500 pointer-events-none z-10"
                    style={{ left: `calc(${audioEndLeft}% + 1rem)`, width: "3px" }}
                  />
                );
              })()}
          </div>
        )}
      </div>

      {/* Export MP4 Dialog */}
      <Dialog
        open={exportOpen}
        onOpenChange={(open) => {
          if (
            !open &&
            exportPhase !== "rendering" &&
            exportPhase !== "muxing" &&
            exportPhase !== "encoding" &&
            exportPhase !== "loading-images" &&
            exportPhase !== "fetching-audio"
          ) {
            setExportOpen(false);
            setExportPhase("idle");
            setExportProgress(0);
            setExportStatus("");
            if (exportUrl) {
              URL.revokeObjectURL(exportUrl);
              setExportUrl(null);
            }
          }
        }}
      >
        <DialogPortal>
          <DialogOverlay className="backdrop-blur-md bg-black/20" />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Export MP4</DialogTitle>
              <DialogDescription>
                Render every frame to canvas and mux with FFmpeg WASM.
              </DialogDescription>
            </DialogHeader>

            {/* Resolution + FPS selectors — disabled while running */}
            {(() => {
              const isRunning =
                exportPhase !== "idle" && exportPhase !== "done" && exportPhase !== "error";
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
                        <span className="tabular-nums text-muted-foreground">
                          {exportProgress}%
                        </span>
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
              );
            })()}
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Audio Picker Dialog */}
      <Dialog
        open={audioPickerOpen}
        onOpenChange={(open) => {
          setAudioPickerOpen(open);
          if (!open) setAudioSearch("");
        }}
      >
        <DialogPortal>
          <DialogOverlay className="backdrop-blur-md bg-black/20" />
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Select Audio</DialogTitle>
              <DialogDescription>
                Search your audio library and select a track for the lesson.
              </DialogDescription>
            </DialogHeader>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by title or description…"
                value={audioSearch}
                onChange={(e) => setAudioSearch(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            {/* Results */}
            <div className="max-h-[400px] overflow-y-auto -mx-6 px-6 space-y-1">
              {audioLoading ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  <Search className="h-4 w-4 animate-pulse mr-2" />
                  Loading…
                </div>
              ) : audioRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                  <Music className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No audio files found</p>
                </div>
              ) : (
                audioRecords.map((record) => {
                  const isSelected = record.url === audioUrl;
                  return (
                    <button
                      key={record.id}
                      onClick={() => handleSelectAudio(record)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors hover:bg-muted/60 ${
                        isSelected ? "bg-muted ring-1 ring-primary/30" : ""
                      }`}
                    >
                      <div
                        className={`flex-shrink-0 h-9 w-9 rounded-md flex items-center justify-center ${isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                      >
                        {isSelected ? <Check className="h-4 w-4" /> : <Music className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{record.title}</p>
                        {record.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {record.description}
                          </p>
                        )}
                      </div>
                      {record.duration_seconds != null && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                          <Clock className="h-3 w-3" />
                          {formatDuration(record.duration_seconds)}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Delete Segment Confirmation Dialog */}
      <Dialog open={deleteConfirmIndex !== null} onOpenChange={() => setDeleteConfirmIndex(null)}>
        <DialogPortal>
          <DialogOverlay />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Segment?</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete Segment {deleteConfirmIndex !== null ? deleteConfirmIndex + 1 : ""}?
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => setDeleteConfirmIndex(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (deleteConfirmIndex !== null) {
                    removeImage(deleteConfirmIndex);
                    setDeleteConfirmIndex(null);
                  }
                }}
              >
                Delete Segment
              </Button>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  );
}
