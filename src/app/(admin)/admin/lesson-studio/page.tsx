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
} from "lucide-react";
import type {
  ExplainerSequence,
  Segment,
  HighlightRegion,
  ArrowPointer,
  TextOverlay,
  CaptionChunk,
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
  created_at: string;
}

const DEFAULT_AUDIO_URL = "";

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
      <div className="flex items-center gap-1">
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
          className="h-5 w-16 text-xs px-1 py-0"
        />
        {suffix && <span className="text-xs">{suffix}</span>}
      </div>
    );
  }

  return (
    <Label
      className="text-xs cursor-pointer hover:text-primary transition-colors"
      onClick={() => {
        setEditValue(value.toString());
        setIsEditing(true);
      }}
    >
      {label}: {value}
      {suffix}
    </Label>
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

export default function LessonStudioPage() {
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [audioUrl, setAudioUrl] = useState(DEFAULT_AUDIO_URL);
  const [previewSequence, setPreviewSequence] = useState<ExplainerSequence | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [seekTime, setSeekTime] = useState<number | undefined>(undefined);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<string>("");
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
    const viewportAspectRatio = 16 / 9;
    const imageAspectRatio = image.width / image.height;

    // Calculate zoom needed to cover the entire viewport
    let zoom: number;
    if (imageAspectRatio > viewportAspectRatio) {
      // Image is wider than viewport - scale by height
      zoom = imageAspectRatio / viewportAspectRatio;
    } else {
      // Image is taller than viewport - scale by width
      zoom = viewportAspectRatio / imageAspectRatio;
    }

    // Cap at 2x maximum
    return Math.min(zoom, 2);
  };

  const addImage = (image: LibraryImage) => {
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
        newAnimation = {
          id: newId,
          type: "zoom",
          start: 0,
          duration: Math.min(2, img.duration - 1),
          fadeTime: 0.5,
          targetScale: img.initialZoom * 1.5,
          targetX: 0,
          targetY: 0,
        };
        break;
      case "pan":
        newAnimation = {
          id: newId,
          type: "pan",
          start: 0,
          duration: 0, // Not used for pan animations
          fadeTime: 0.5,
          targetScale: img.initialZoom * 1.5,
          targetX: 0,
          targetY: 0,
        };
        break;
      case "figure":
        newAnimation = {
          id: newId,
          type: "figure",
          start: 0,
          duration: 2,
          fadeTime: 0.3,
          figureType: "circle",
          position: { x: 50, y: 50 },
          size: { width: 30, height: 30 },
          borderColor: "#FFFFFF",
          borderWidth: 3,
          borderStyle: "solid",
        };
        break;
      case "spotlight":
        newAnimation = {
          id: newId,
          type: "spotlight",
          start: 0,
          duration: 2,
          fadeTime: 0.3,
          figureType: "circle",
          position: { x: 50, y: 50 },
          size: { width: 30, height: 30 },
        };
        break;
      case "arrow":
        newAnimation = {
          id: newId,
          type: "arrow",
          start: 0,
          duration: 2,
          fadeTime: 0.3,
          position: { x: 50, y: 50 },
          color: "#FFFFFF",
          direction: "down",
        };
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
    const newText: TimeBasedText = {
      id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      start: 0,
      duration: Math.min(3, img.duration - 1),
      fadeTime: 0.5,
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

    setPreviewSequence({
      version: 1,
      duration: totalDuration,
      aspectRatio: "16:9",
      segments,
    });

    // Build flat caption chunks (rendered outside the engine, no keyframe interpolation)
    if (audioTranscript && audioDuration > 0) {
      setCaptionChunks(buildCaptionChunks(audioTranscript, audioDuration));
    } else {
      setCaptionChunks([]);
    }
  };

  const saveToJSON = () => {
    if (selectedImages.length === 0) {
      alert("Please add at least one image before saving.");
      return;
    }

    // 5-second lead-in cushion before first segment
    const startCushion = 5;
    let currentTime = startCushion;

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

    const sequenceCaptions =
      audioTranscript && totalDuration > 0
        ? buildCaptionChunks(audioTranscript, totalDuration)
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

  const renderVideo = async () => {
    // TODO: Video Export Issues to Fix
    // 1. Canvas drawing is stuck on first frame - source video not updating properly
    //    - Need to verify sourceVideo.currentTime is advancing during recording
    //    - May need to ensure video element is actually playing (check paused state)
    // 2. FFmpeg conversion working but slow - consider optimization
    // 3. Crop region calculation may need adjustment based on actual player bounds
    // 4. Consider adding preview of crop region before recording starts
    // 5. Add better progress indication during recording (frame count, time remaining)

    if (selectedImages.length === 0) return;
    if (!playerContainerRef.current) return;

    // Calculate total duration
    const totalDuration = selectedImages.reduce((sum, img) => sum + img.duration, 0);

    // Generate and show preview
    generateSequence();

    // Wait for preview to render
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      setIsRecording(true);
      setRecordingStatus("Preparing to record...");

      // Start playback FIRST, before requesting screen share
      setSeekTime(0);

      // Wait a moment for playback to initialize
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get player element bounds for cropping
      const playerRect = playerContainerRef.current.getBoundingClientRect();
      const videoWidth = 1920;
      const videoHeight = 1080;

      setRecordingStatus(
        "Select 'Browser Tab' and choose THIS tab. Make sure 'Share tab audio' is checked!"
      );

      // Request screen + audio capture at high resolution
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
          width: { ideal: 3840 }, // Request 4K for better quality when cropping
          height: { ideal: 2160 },
          frameRate: { ideal: 60 },
        } as MediaTrackConstraints,
        audio: true,
        preferCurrentTab: true,
      } as DisplayMediaStreamOptions);

      // Create hidden video element to receive the display stream
      const sourceVideo = document.createElement("video");
      sourceVideo.srcObject = displayStream;
      sourceVideo.muted = true;
      sourceVideo.autoplay = true;
      sourceVideo.playsInline = true;

      // Wait for video metadata to load
      await new Promise<void>((resolve) => {
        if (sourceVideo.readyState >= 2) {
          resolve();
        } else {
          sourceVideo.onloadedmetadata = () => resolve();
        }
      });

      // Ensure video is playing
      try {
        await sourceVideo.play();
      } catch (e) {
        console.error("Failed to play source video:", e);
      }

      console.log("Source video ready:", {
        width: sourceVideo.videoWidth,
        height: sourceVideo.videoHeight,
        readyState: sourceVideo.readyState,
        paused: sourceVideo.paused,
        currentTime: sourceVideo.currentTime,
      });

      // Create canvas for cropping
      const canvas = document.createElement("canvas");
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Failed to get canvas context");
      }

      // Calculate scale factor between actual capture and screen coordinates
      const scaleX = sourceVideo.videoWidth / window.innerWidth;
      const scaleY = sourceVideo.videoHeight / window.innerHeight;

      // Calculate source crop region (scaled to capture resolution)
      const cropX = playerRect.left * scaleX;
      const cropY = playerRect.top * scaleY;
      const cropWidth = playerRect.width * scaleX;
      const cropHeight = playerRect.height * scaleY;

      console.log("Player rect:", playerRect);
      console.log("Scale factors:", { scaleX, scaleY });
      console.log("Crop region:", { cropX, cropY, cropWidth, cropHeight });
      console.log("Canvas output:", { videoWidth, videoHeight });

      // Draw frames to canvas with cropping
      let animationFrameId: number;
      let frameCount = 0;
      const drawFrame = () => {
        if (sourceVideo.readyState >= 2) {
          // Draw cropped region from source video to canvas, scaling to fit
          ctx.drawImage(
            sourceVideo,
            cropX,
            cropY,
            cropWidth,
            cropHeight, // Source crop region
            0,
            0,
            videoWidth,
            videoHeight // Destination (full canvas)
          );
          frameCount++;
          if (frameCount % 60 === 0) {
            console.log("Drawing frame", frameCount, "at time:", sourceVideo.currentTime);
          }
        }
        animationFrameId = requestAnimationFrame(drawFrame);
      };
      drawFrame();

      // Get stream from canvas (video only)
      const canvasStream = canvas.captureStream(60); // 60 FPS

      // Get audio track from display stream
      const audioTracks = displayStream.getAudioTracks();

      // Combine canvas video with display audio
      const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);

      // Determine best codec
      let mimeType = "video/webm;codecs=vp9,opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm;codecs=vp8,opus";
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm";
      }

      console.log("Creating MediaRecorder with:", {
        mimeType,
        videoBitsPerSecond: 20_000_000,
        videoTracks: combinedStream.getVideoTracks().length,
        audioTracks: combinedStream.getAudioTracks().length,
      });

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 20_000_000,
      });

      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        console.log("Data available:", e.data.size, "bytes");
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onerror = (e) => {
        console.error("MediaRecorder error:", e);
      };

      recorder.onstop = async () => {
        console.log("Recording stopped. Total chunks:", chunks.length);
        console.log(
          "Total size:",
          chunks.reduce((sum, chunk) => sum + chunk.size, 0),
          "bytes"
        );

        // Cleanup streams
        cancelAnimationFrame(animationFrameId);
        displayStream.getTracks().forEach((track) => track.stop());
        sourceVideo.srcObject = null;
        canvasStream.getTracks().forEach((track) => track.stop());

        if (chunks.length === 0) {
          console.error("No data recorded!");
          alert("Recording failed: No data was captured. Please try again.");
          setIsRecording(false);
          setRecordingStatus("");
          setPreviewSequence(null);
          return;
        }

        const webmBlob = new Blob(chunks, { type: mimeType });
        console.log("Created WebM blob:", webmBlob.size, "bytes");

        try {
          // Convert WebM to MP4
          setRecordingStatus("Converting to MP4...");
          console.log("Loading FFmpeg...");

          const { FFmpeg } = await import("@ffmpeg/ffmpeg");
          const { fetchFile } = await import("@ffmpeg/util");

          const ffmpeg = new FFmpeg();

          ffmpeg.on("log", ({ message }) => {
            console.log("[FFmpeg]", message);
          });

          ffmpeg.on("progress", ({ progress }) => {
            const percent = Math.round(progress * 100);
            setRecordingStatus(`Converting to MP4... ${percent}%`);
            console.log("Conversion progress:", percent + "%");
          });

          await ffmpeg.load({
            coreURL: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js",
            wasmURL: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm",
          });

          console.log("FFmpeg loaded, writing file...");
          await ffmpeg.writeFile("input.webm", await fetchFile(webmBlob));

          console.log("Starting conversion...");
          await ffmpeg.exec([
            "-i",
            "input.webm",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "22",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            "output.mp4",
          ]);

          console.log("Reading output...");
          const data = await ffmpeg.readFile("output.mp4");
          const mp4Blob = new Blob([data as unknown as BlobPart], { type: "video/mp4" });

          console.log("Created MP4 blob:", mp4Blob.size, "bytes");

          // Download MP4
          const url = URL.createObjectURL(mp4Blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `explainer-${Date.now()}.mp4`;
          document.body.appendChild(a);
          a.click();
          console.log("Download triggered");
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          setRecordingStatus("Complete!");
          setTimeout(() => {
            setIsRecording(false);
            setRecordingStatus("");
            setPreviewSequence(null);
          }, 2000);
        } catch (conversionError) {
          console.error("MP4 conversion failed:", conversionError);
          alert("MP4 conversion failed. Downloading WebM instead.");

          // Fallback: download WebM
          const url = URL.createObjectURL(webmBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `explainer-${Date.now()}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          setIsRecording(false);
          setRecordingStatus("");
          setPreviewSequence(null);
        }
      };

      setRecordingStatus("Recording... (cropped to player only)");

      // Restart playback from beginning to ensure sync
      setSeekTime(0);
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Start recording
      console.log("Starting recorder...");
      recorder.start(100);
      console.log("Recorder state:", recorder.state);

      // Monitor for when user stops sharing
      displayStream.getVideoTracks()[0].addEventListener("ended", () => {
        console.log("Display stream ended by user");
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
      });

      // Auto-stop when sequence ends
      const _autoStopTimeout = setTimeout(
        () => {
          console.log("Auto-stop timeout reached. Recorder state:", recorder.state);
          if (recorder.state !== "inactive") {
            console.log("Stopping recorder...");
            recorder.stop();
          }
        },
        (totalDuration + 1) * 1000
      );

      console.log("Auto-stop will trigger in", totalDuration + 1, "seconds");
    } catch (error) {
      console.error("Video recording error:", error);
      if (
        error instanceof Error &&
        (error.name === "NotAllowedError" || error.name === "NotFoundError")
      ) {
        alert(
          "Screen recording was cancelled or denied. Please try again and select the browser tab with 'Share tab audio' enabled."
        );
      } else {
        alert(`Failed to record video: ${error instanceof Error ? error.message : String(error)}`);
      }
      setIsRecording(false);
      setRecordingStatus("");
      setPreviewSequence(null);
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
            disabled={selectedImages.length === 0 || isRecording}
            className="flex items-center gap-2"
          >
            <Video className="h-4 w-4" />
            {isRecording ? recordingStatus : "Export Video (MP4)"}
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
              selectedImages.map((img, index) => (
                <div
                  key={index}
                  className={`
                    border rounded-lg p-3 cursor-pointer transition-all
                    ${selectedImageIndex === index ? "border-blue-500 bg-blue-50 shadow-sm" : "border-gray-200 hover:border-gray-300"}
                  `}
                  onClick={() => handleSegmentSelect(index)}
                >
                  <div className="flex gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.description || "Image"}
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{getImageTitle(img)}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Segment {index + 1} • {img.duration}s
                      </div>
                      <div className="mt-1 flex gap-1">
                        {img.animations.length > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                            {img.animations.length} anim{img.animations.length !== 1 ? "s" : ""}
                          </span>
                        )}
                        {img.textOverlays.length > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                            {img.textOverlays.length} text
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Audio */}
          <div className="p-4 border-t space-y-2">
            <Label className="text-xs">Audio</Label>
            {audioUrl ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 min-w-0">
                <Music className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate flex-1">{audioTitle || audioUrl}</span>
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
          {/* Preview Area */}
          <div className="flex-1 flex items-center justify-center bg-muted/30 p-8">
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
                    ? "Select audio and add images, then generate a preview"
                    : "Add images to the sequence and click Update Preview"}
                </p>
                {selectedImages.length > 0 && (
                  <Button onClick={generateSequence} disabled={!audioUrl}>
                    <Play className="h-4 w-4 mr-2" />
                    Generate Preview
                  </Button>
                )}
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
                  <Button size="sm" variant="ghost" onClick={() => removeImage(selectedImageIndex)}>
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                {/* Accordion Sections */}
                <Accordion type="single" defaultValue="framing" collapsible className="px-4">
                  {/* Timing */}
                  <AccordionItem value="timing">
                    <AccordionTrigger className="text-sm font-medium py-3">Timing</AccordionTrigger>
                    <AccordionContent className="space-y-3 pb-4">
                      <div className="space-y-2">
                        <Label className="text-xs">
                          Duration: {selectedImages[selectedImageIndex].duration}s
                        </Label>
                        <Input
                          type="range"
                          min={3}
                          max={60}
                          step={1}
                          value={selectedImages[selectedImageIndex].duration}
                          onChange={(e) =>
                            updateImage(selectedImageIndex, "duration", Number(e.target.value))
                          }
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">
                          Transition: {selectedImages[selectedImageIndex].transitionDuration}s
                        </Label>
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
                          className="w-full"
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Image & Framing */}
                  <AccordionItem value="framing">
                    <AccordionTrigger className="text-sm font-medium py-3">
                      Image & Framing
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pb-4">
                      <div className="space-y-2">
                        <Label className="text-xs">
                          Initial Zoom: {selectedImages[selectedImageIndex].initialZoom.toFixed(2)}x
                        </Label>
                        <Input
                          type="range"
                          min={0.5}
                          max={2}
                          step={0.1}
                          value={selectedImages[selectedImageIndex].initialZoom}
                          onChange={(e) =>
                            updateImage(selectedImageIndex, "initialZoom", Number(e.target.value))
                          }
                          className="w-full"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label className="text-xs">X Position (%)</Label>
                          <Input
                            key={`x-${selectedImageIndex}`}
                            type="number"
                            min={-50}
                            max={50}
                            step={1}
                            defaultValue={selectedImages[selectedImageIndex].initialX}
                            onBlur={(e) => {
                              const val = Number(e.target.value);
                              if (!isNaN(val)) {
                                updateImage(
                                  selectedImageIndex,
                                  "initialX",
                                  Math.max(-50, Math.min(50, val))
                                );
                              }
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Y Position (%)</Label>
                          <Input
                            key={`y-${selectedImageIndex}`}
                            type="number"
                            min={-50}
                            max={50}
                            step={1}
                            defaultValue={selectedImages[selectedImageIndex].initialY}
                            onBlur={(e) => {
                              const val = Number(e.target.value);
                              if (!isNaN(val)) {
                                updateImage(
                                  selectedImageIndex,
                                  "initialY",
                                  Math.max(-50, Math.min(50, val))
                                );
                              }
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Zoom & Camera */}
                  <AccordionItem value="zoom">
                    <AccordionTrigger className="text-sm font-medium py-3">
                      Zoom & Camera (
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
                                    className="h-6 w-6 p-0"
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>

                                {/* Timing controls */}
                                <div
                                  className={`grid ${anim.type === "pan" ? "grid-cols-2" : "grid-cols-3"} gap-2`}
                                >
                                  <div>
                                    <Label className="text-xs">Start: {anim.start}s</Label>
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
                                      <Label className="text-xs">Duration: {anim.duration}s</Label>
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
                                    <Label className="text-xs">Fade: {anim.fadeTime}s</Label>
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
                                        value={Number(anim.targetScale.toFixed(1))}
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
                                        step={0.5}
                                        value={anim.targetScale}
                                        onChange={(e) =>
                                          updateAnimation(selectedImageIndex, anim.id, {
                                            targetScale: Number(e.target.value),
                                          })
                                        }
                                        className="h-6"
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

                  {/* Visual Annotations */}
                  <AccordionItem value="annotations">
                    <AccordionTrigger className="text-sm font-medium py-3">
                      Visual Annotations (
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
                                    className="h-6 w-6 p-0"
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>

                                {/* Timing controls */}
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <Label className="text-xs">Start: {anim.start}s</Label>
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
                                    <Label className="text-xs">Duration: {anim.duration}s</Label>
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
                                    <Label className="text-xs">Fade: {anim.fadeTime}s</Label>
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
                                      <>
                                        <div>
                                          <Label className="text-xs mb-2 block">Border Color</Label>
                                          <div className="flex gap-2 items-center flex-wrap">
                                            {[
                                              { color: "#FFFFFF", label: "White" },
                                              { color: "#000000", label: "Black" },
                                              { color: "#FFEB3B", label: "Yellow" },
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
                                              ${anim.borderColor.toUpperCase() === option.color ? "ring-2 ring-blue-500 ring-offset-1" : "hover:scale-110"}
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
                                          <div className="flex gap-2">
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
                                              px-3 py-1 text-xs rounded transition-all
                                              ${
                                                anim.borderStyle === option.style
                                                  ? "bg-blue-500 text-white"
                                                  : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                                              }
                                            `}
                                              >
                                                {option.label}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      </>
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
                                                ? "bg-blue-500 text-white"
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
                                            { color: "#FFEB3B", label: "Yellow" },
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
                                            ${anim.color.toUpperCase() === option.color ? "ring-2 ring-blue-500 ring-offset-1" : "hover:scale-110"}
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

                  {/* Text Overlays */}
                  <AccordionItem value="text">
                    <AccordionTrigger className="text-sm font-medium py-3">
                      Text Overlays ({selectedImages[selectedImageIndex].textOverlays.length})
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
                                <span className="text-xs font-medium truncate flex-1">
                                  {text.text}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeText(selectedImageIndex, text.id)}
                                  className="h-6 w-6 p-0"
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>

                              <div>
                                <Label className="text-xs">Text</Label>
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
                                  <Label className="text-xs">Start: {text.start}s</Label>
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
                                  <Label className="text-xs">Duration: {text.duration}s</Label>
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
                                  <Label className="text-xs">Fade: {text.fadeTime}s</Label>
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
                                  <Label className="text-xs">Font Size: {text.fontSize}rem</Label>
                                  <Input
                                    type="range"
                                    min={1}
                                    max={3}
                                    step={0.5}
                                    value={text.fontSize}
                                    onChange={(e) =>
                                      updateText(selectedImageIndex, text.id, {
                                        fontSize: Number(e.target.value),
                                      })
                                    }
                                    className="h-6"
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

                              <div>
                                <Label className="text-xs mb-2 block">Text Color</Label>
                                <div className="flex gap-2 items-center">
                                  {[
                                    { color: "#FFFFFF", label: "White" },
                                    { color: "#000000", label: "Black" },
                                    { color: "#FFEB3B", label: "Yellow" },
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
                                      ${text.color.toUpperCase() === option.color ? "ring-2 ring-blue-500 ring-offset-1" : "hover:scale-110"}
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
                                <Label className="text-xs mb-2 block">Background</Label>
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
                                      ${text.backgroundColor === option.color ? "ring-2 ring-blue-500 ring-offset-1" : "hover:scale-110"}
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
            <div className="relative h-8 border-b bg-muted/20 px-4">
              {(() => {
                const segmentsDuration = selectedImages.reduce((sum, img) => sum + img.duration, 0);
                const baseTimelineDuration = Math.max(segmentsDuration, audioDuration);
                const startCushion = 5; // 5 second cushion at start
                const endCushion = 5; // 5 second cushion at end
                const timelineDuration = baseTimelineDuration + startCushion + endCushion;
                const ticks = [];

                // Generate tick marks
                for (let t = 0; t <= baseTimelineDuration; t += 1) {
                  const isMajor = t % 5 === 0;
                  const left = ((t + startCushion) / timelineDuration) * 100;

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
                          {t}s
                        </span>
                      )}
                    </div>
                  );
                }

                return ticks;
              })()}
            </div>

            {/* Segment Blocks */}
            <div className="flex-1 relative px-4 py-3 overflow-x-auto" ref={timelineRef}>
              <div className="h-full flex relative">
                {(() => {
                  const segmentsDuration = selectedImages.reduce((sum, i) => sum + i.duration, 0);
                  const baseTimelineDuration = Math.max(segmentsDuration, audioDuration);
                  const startCushion = 5;
                  const endCushion = 5;
                  const timelineDuration = baseTimelineDuration + startCushion + endCushion;

                  // Calculate start position (4s offset to align with 0s tick)
                  const startOffsetPercent = ((startCushion - 1) / timelineDuration) * 100;

                  return (
                    <>
                      {/* Empty space for start cushion */}
                      <div style={{ width: `${startOffsetPercent}%` }} />

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
                                    {img.duration}s
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
                                {getImageTitle(img)} ({img.duration}s)
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
                const startCushion = 5;
                const endCushion = 5;
                const timelineDuration = baseTimelineDuration + startCushion + endCushion;
                const audioEndLeft = ((audioDuration + startCushion) / timelineDuration) * 100;

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
    </div>
  );
}
