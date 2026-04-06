"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_PREFIX = "tutorial:";

/**
 * Hook to track whether a tutorial has been completed.
 * Uses localStorage for instant reads (no loading flash).
 * Can be extended to sync with a DB table later for cross-device persistence.
 *
 * @param tutorialId - Unique identifier for the tutorial (e.g. "study-schedule")
 * @returns { showTutorial, completeTutorial, resetTutorial }
 */
export function useTutorial(tutorialId: string) {
  const key = `${STORAGE_PREFIX}${tutorialId}`;

  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    // Only show if not previously completed
    const completed = localStorage.getItem(key);
    if (!completed) {
      setShowTutorial(true);
    }
  }, [key]);

  const completeTutorial = useCallback(() => {
    localStorage.setItem(key, new Date().toISOString());
    setShowTutorial(false);
  }, [key]);

  const resetTutorial = useCallback(() => {
    localStorage.removeItem(key);
    setShowTutorial(true);
  }, [key]);

  return { showTutorial, completeTutorial, resetTutorial };
}
