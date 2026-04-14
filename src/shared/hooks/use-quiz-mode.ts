// src/shared/hooks/use-quiz-mode.ts
"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

/**
 * Hook to detect if the user is currently in an active quiz mode
 * Returns true for active quiz sessions (/dashboard/quiz/[id])
 * Returns false for quiz creation (/dashboard/quiz/new)
 */
export function useQuizMode() {
  const pathname = usePathname();

  const isInQuizMode = useMemo(() => {
    if (!pathname) return false;

    // Exclude quiz creation pages from quiz mode (sidebar should not collapse)
    if (pathname === "/dashboard/quiz/new") return false;

    return pathname.startsWith("/dashboard/quiz/");
  }, [pathname]);

  return {
    isInQuizMode,
    pathname,
  };
}

/**
 * Hook to detect if the user is currently in Anki mode
 * Returns true when on /dashboard/anki
 */
export function useAnkiMode() {
  const pathname = usePathname();

  const isInAnkiMode = useMemo(() => {
    if (!pathname) return false;
    return pathname.startsWith("/dashboard/anki");
  }, [pathname]);

  return {
    isInAnkiMode,
    pathname,
  };
}

/**
 * Hook to detect if the user is currently in Lesson Studio mode
 * Returns true when on /admin/lesson-studio
 */
export function useLessonStudioMode() {
  const pathname = usePathname();

  const isInLessonStudioMode = useMemo(() => {
    if (!pathname) return false;
    return pathname === "/admin/lesson-studio";
  }, [pathname]);

  return {
    isInLessonStudioMode,
    pathname,
  };
}
