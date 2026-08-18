"use client";

/**
 * Lets a page ask the shell for more room: sidebar collapsed to its rail, and a
 * full-height `main` with no page padding — the same treatment an active quiz
 * gets, minus the route.
 *
 * Quizzes, Anki and lesson studio declare this by pathname (layout-routes.ts,
 * use-quiz-mode.ts), which works because the whole route is immersive. A layout
 * the reader toggles on and off within one page has no pathname to key on, so it
 * needs a channel instead. The header deliberately stays visible either way.
 */

import { createContext, useContext, useEffect } from "react";

const ImmersiveModeContext = createContext<((active: boolean) => void) | null>(null);

export const ImmersiveModeProvider = ImmersiveModeContext.Provider;

/**
 * Hold the shell in immersive mode for as long as `active` is true and this
 * component is mounted. Releases on unmount, so navigating away cannot strand
 * the shell in a collapsed state.
 */
export function useImmersiveMode(active: boolean) {
  const setImmersive = useContext(ImmersiveModeContext);

  useEffect(() => {
    if (!setImmersive) return;
    setImmersive(active);
    return () => setImmersive(false);
  }, [active, setImmersive]);
}
