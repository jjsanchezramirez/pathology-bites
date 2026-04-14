"use client";

import { useMemo, useEffect, useRef } from "react";
import type { ExplainerSequence } from "@/shared/types/explainer";
import { computeEngineState, type EngineState } from "./engine-core";

interface UseExplainerEngineOptions {
  sequence: ExplainerSequence;
  currentTime: number;
}

export function useExplainerEngine({
  sequence,
  currentTime,
}: UseExplainerEngineOptions): EngineState {
  const preloadedRef = useRef<Set<string>>(new Set());

  const state = useMemo(
    () => computeEngineState(sequence, currentTime),
    [sequence, currentTime]
  );

  // Reset preload cache when sequence changes
  useEffect(() => {
    preloadedRef.current.clear();
  }, [sequence]);

  // Preload upcoming images
  useEffect(() => {
    const { segments } = sequence;
    const currentIndex = segments.findIndex(
      (s) => currentTime >= s.startTime && currentTime < s.endTime
    );

    // Preload current + next 2 segments
    for (let i = Math.max(0, currentIndex); i < Math.min(segments.length, currentIndex + 3); i++) {
      const url = segments[i]?.imageUrl;
      if (url && !preloadedRef.current.has(url)) {
        preloadedRef.current.add(url);
        const img = new Image();
        img.src = url;
      }
    }
  }, [sequence, currentTime]);

  return state;
}
