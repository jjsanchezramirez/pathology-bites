"use client";

import { useMemo, useEffect, useRef } from "react";
import type { Lesson } from "@/shared/lesson/types";
import { evaluate, slideStarts, type FrameState } from "@/shared/lesson/evaluate";

interface UseExplainerEngineOptions {
  lesson: Lesson;
  currentTime: number;
  /** 0..1 reduced-motion multiplier (1 = full motion). */
  motion?: number;
}

export function useExplainerEngine({
  lesson,
  currentTime,
  motion = 1,
}: UseExplainerEngineOptions): FrameState {
  const preloadedRef = useRef<Set<string>>(new Set());

  const state = useMemo(
    () => evaluate(lesson, currentTime, { motion }),
    [lesson, currentTime, motion]
  );

  // Reset preload cache when the lesson changes.
  useEffect(() => {
    preloadedRef.current.clear();
  }, [lesson]);

  // Preload the current + next 2 slide background images.
  useEffect(() => {
    const { slides } = lesson;
    const { starts } = slideStarts(lesson);
    let currentIndex = slides.findIndex(
      (_, i) => currentTime >= starts[i] && currentTime < starts[i] + slides[i].duration
    );
    if (currentIndex < 0) currentIndex = 0;

    for (let i = currentIndex; i < Math.min(slides.length, currentIndex + 3); i++) {
      const bg = slides[i]?.elements.find(
        (e) =>
          e.kind === "image" && (e.id.startsWith("image-bg-") || (e.rect.w >= 99 && e.rect.h >= 99))
      );
      const url = bg && bg.kind === "image" ? bg.imageUrl : undefined;
      if (url && !preloadedRef.current.has(url)) {
        preloadedRef.current.add(url);
        const img = new Image();
        img.src = url;
      }
    }
  }, [lesson, currentTime]);

  return state;
}
