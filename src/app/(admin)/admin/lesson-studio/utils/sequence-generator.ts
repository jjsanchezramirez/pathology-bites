import type { ExplainerSequence, Segment } from "@/shared/types/explainer";
import type { SelectedImage } from "../types";
import { buildCaptionChunks } from "./caption-builder";

/**
 * Generate a complete ExplainerSequence from selected images with their animations.
 * This function creates keyframes at all time points where something changes
 * (animation starts/ends, text appears/disappears, etc.)
 *
 * @param selectedImages - Array of images with their duration, animations, and text overlays
 * @param audioUrl - Optional audio URL to include in the sequence
 * @param audioTranscript - Optional transcript for caption generation
 * @param audioDuration - Optional audio duration for caption timing
 * @returns Complete ExplainerSequence ready for playback or export
 */
export function generateSequence(
  selectedImages: SelectedImage[],
  audioUrl?: string,
  audioTranscript?: string,
  audioDuration?: number
): ExplainerSequence | null {
  if (selectedImages.length === 0) {
    return null;
  }

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
              const fadeOutProgress = anim.fadeTime > 0 ? (time - fadeOutStart) / anim.fadeTime : 0;
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

  const sequence: ExplainerSequence = {
    version: 1 as const,
    duration: totalDuration,
    aspectRatio: "16:9",
    segments,
    ...(audioUrl ? { audioUrl } : {}),
  };

  // Add captions if transcript and duration are available
  if (audioTranscript && audioDuration && audioDuration > 0) {
    const captions = buildCaptionChunks(audioTranscript, audioDuration);
    if (captions.length > 0) {
      sequence.captions = captions;
    }
  }

  return sequence;
}
