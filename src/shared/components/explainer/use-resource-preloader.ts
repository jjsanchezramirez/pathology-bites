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

        const totalResources = imageUrls.size + 1; // images + audio
        let loadedCount = 0;

        // Preload audio
        const audioPromise = new Promise<void>((resolve, reject) => {
          const audio = new Audio();
          audio.preload = "auto";

          const onCanPlayThrough = () => {
            if (!cancelled) {
              loadedCount++;
              setProgress(Math.round((loadedCount / totalResources) * 100));
              loadedResourcesRef.current.add(audioUrl);
            }
            cleanup();
            resolve();
          };

          const onError = () => {
            cleanup();
            reject(new Error("Failed to load audio"));
          };

          const cleanup = () => {
            audio.removeEventListener("canplaythrough", onCanPlayThrough);
            audio.removeEventListener("error", onError);
          };

          audio.addEventListener("canplaythrough", onCanPlayThrough);
          audio.addEventListener("error", onError);
          audio.src = audioUrl;
          audio.load();
        });

        // Preload all images
        const imagePromises = Array.from(imageUrls).map(
          (url) =>
            new Promise<void>((resolve, reject) => {
              const img = new Image();

              img.onload = () => {
                if (!cancelled) {
                  loadedCount++;
                  setProgress(Math.round((loadedCount / totalResources) * 100));
                  loadedResourcesRef.current.add(url);
                }
                resolve();
              };

              img.onerror = () => {
                reject(new Error(`Failed to load image: ${url}`));
              };

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
