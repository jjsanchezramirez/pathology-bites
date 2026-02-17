"use client";

import { useState, useEffect, useRef } from "react";
import type { ExplainerSequence } from "@/shared/types/explainer";

interface UseResourcePreloaderOptions {
  sequence: ExplainerSequence;
  audioUrl: string;
}

interface UseResourcePreloaderReturn {
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  progress: number; // 0-100
}

export function useResourcePreloader({
  sequence,
  audioUrl,
}: UseResourcePreloaderOptions): UseResourcePreloaderReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const loadedResourcesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function preloadResources() {
      setIsLoading(true);
      setIsReady(false);
      setError(null);
      setProgress(0);
      loadedResourcesRef.current.clear();

      try {
        // Collect all unique image URLs from the sequence
        const imageUrls = new Set<string>();
        for (const segment of sequence.segments) {
          if (segment.imageUrl) {
            imageUrls.add(segment.imageUrl);
          }
        }

        const hasAudio = !!audioUrl;
        const totalResources = imageUrls.size + (hasAudio ? 1 : 0);
        let loadedCount = 0;

        const updateProgress = () => {
          if (!cancelled) {
            loadedCount++;
            setProgress(
              totalResources > 0 ? Math.round((loadedCount / totalResources) * 100) : 100
            );
          }
        };

        // Preload audio (only if a URL is provided)
        const audioPromise: Promise<void> = hasAudio
          ? new Promise<void>((resolve) => {
              const audio = new Audio();
              audio.preload = "auto";

              const cleanup = () => {
                audio.removeEventListener("canplaythrough", onReady);
                audio.removeEventListener("error", onReady);
              };

              const onReady = () => {
                updateProgress();
                loadedResourcesRef.current.add(audioUrl);
                cleanup();
                resolve();
              };

              audio.addEventListener("canplaythrough", onReady);
              // Resolve on error too — don't block the whole player for audio
              audio.addEventListener("error", onReady);
              audio.src = audioUrl;
              audio.load();
            })
          : Promise.resolve();

        // Preload all images
        const imagePromises = Array.from(imageUrls).map(
          (url) =>
            new Promise<void>((resolve) => {
              const img = new Image();

              const onReady = () => {
                updateProgress();
                loadedResourcesRef.current.add(url);
                resolve();
              };

              // Resolve on error too — show broken image rather than blocking forever
              img.onload = onReady;
              img.onerror = onReady;
              img.src = url;
            })
        );

        // Wait for all resources to load
        await Promise.all([audioPromise, ...imagePromises]);

        if (!cancelled) {
          setIsReady(true);
          setIsLoading(false);
          setProgress(100);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load resources");
          setIsLoading(false);
          setIsReady(false);
        }
      }
    }

    preloadResources();

    return () => {
      cancelled = true;
    };
  }, [sequence, audioUrl]);

  return {
    isLoading,
    isReady,
    error,
    progress,
  };
}
