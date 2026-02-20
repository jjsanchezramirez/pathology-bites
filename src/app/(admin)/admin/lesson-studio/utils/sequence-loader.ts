import type {
  ExplainerSequence,
  Segment,
  HighlightRegion,
  ArrowPointer,
  TextOverlay,
} from "@/shared/types/explainer";
import type { SelectedImage, Animation, TimeBasedText } from "../types";
import { buildCaptionChunks } from "./caption-builder";
import { uiToTransform, transformToUI } from "./image-helpers";

/**
 * Helper: from a sorted list of {time, opacity} entries recover animation timing.
 * Returns {start, fadeTime, holdDuration} in segment-local time.
 *
 * This is used to reverse-engineer the original animation parameters from
 * the generated keyframes when loading a saved sequence.
 */
function recoverTiming(entries: { time: number; opacity: number }[]): {
  start: number;
  fadeTime: number;
  holdDuration: number;
} {
  const visible = entries.filter((e) => e.opacity > 0.01).map((e) => e.time);
  if (visible.length === 0) {
    return { start: 0, fadeTime: 0.5, holdDuration: 1 };
  }

  const firstVisible = Math.min(...visible);
  const lastVisible = Math.max(...visible);
  const atFull = entries.filter((e) => e.opacity >= 0.99).map((e) => e.time);
  const firstFull = atFull.length > 0 ? Math.min(...atFull) : firstVisible;
  const lastFull = atFull.length > 0 ? Math.max(...atFull) : lastVisible;
  const fadeTime = Math.max(0, firstFull - firstVisible);
  const holdDuration = Math.max(0, lastFull - firstFull);

  return { start: firstVisible, fadeTime, holdDuration };
}

/**
 * Load a saved sequence JSON back into the studio.
 * Reconstructs animations and text overlays by reverse-engineering the keyframe
 * opacity timeline: find first/last appearance of each element id to recover
 * start, fadeTime, and duration.
 *
 * Note: Width/height are hardcoded to 1920x1080 since sequences don't store
 * original image dimensions. When using AI Generate, dimensions should be
 * preserved by merging animations into existing images rather than replacing them.
 *
 * @param sequence - The ExplainerSequence to load
 * @returns Array of SelectedImage objects ready for editing in the studio
 */
export function loadFromJSON(sequence: ExplainerSequence): {
  images: SelectedImage[];
  audioUrl?: string;
  captions?: typeof sequence.captions;
} {
  const images: SelectedImage[] = sequence.segments.map((seg, i) => {
    const duration = seg.endTime - seg.startTime;
    const kfs = seg.keyframes;

    // ── Collect timing windows per element id ──────────────────────────
    // For each id, track all {time, opacity} pairs across keyframes.
    const highlightWindows = new Map<
      string,
      { time: number; opacity: number; data: HighlightRegion }[]
    >();
    const arrowWindows = new Map<string, { time: number; opacity: number; data: ArrowPointer }[]>();
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
      // Convert transform coordinates (-50 to 50) to UI coordinates (0-100)
      initialX: transformToUI(kfs[0]?.transform.x ?? 0),
      initialY: transformToUI(kfs[0]?.transform.y ?? 0),
      animations,
      textOverlays,
    };
  });

  return {
    images,
    audioUrl: sequence.audioUrl,
    captions: sequence.captions,
  };
}

/**
 * Save the current studio state to a downloadable JSON file.
 * Generates a complete ExplainerSequence from the selected images and triggers
 * a browser download.
 *
 * @param selectedImages - Array of images with their animations and overlays
 * @param audioUrl - Optional audio URL to include in the sequence
 * @param audioTranscript - Optional transcript for caption generation
 * @param audioDuration - Optional audio duration for caption timing
 */
export function saveToJSON(
  selectedImages: SelectedImage[],
  audioUrl?: string,
  audioTranscript?: string,
  audioDuration?: number
): void {
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
      // Convert UI coordinates (0-100) to transform coordinates (-50 to 50)
      let baseTransform = {
        x: uiToTransform(img.initialX),
        y: uiToTransform(img.initialY),
        scale: img.initialZoom
      };

      const sortedPanAnims = img.animations
        .filter((a) => a.type === "pan")
        .sort((a, b) => a.start - b.start);

      for (const panAnim of sortedPanAnims) {
        if (time >= panAnim.start + panAnim.fadeTime) {
          // Convert UI coordinates (0-100) to transform coordinates (-50 to 50)
          baseTransform = {
            x: uiToTransform(panAnim.targetX),
            y: uiToTransform(panAnim.targetY),
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
            // Convert UI coordinates (0-100) to transform coordinates (-50 to 50)
            transform.scale =
              baseTransform.scale + (anim.targetScale - baseTransform.scale) * progress;
            transform.x = baseTransform.x + (uiToTransform(anim.targetX) - baseTransform.x) * progress;
            transform.y = baseTransform.y + (uiToTransform(anim.targetY) - baseTransform.y) * progress;
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
  const captionDuration = audioDuration && audioDuration > 0 ? audioDuration : totalDuration;
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
}
