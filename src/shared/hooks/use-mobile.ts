// src/shared/hooks/use-mobile.ts
"use client";

import { useState, useEffect } from "react";

/**
 * Hook to detect if the current screen size is mobile
 * Uses Tailwind's md breakpoint (768px) as the threshold
 * Only responds to actual viewport size changes, not text scaling
 */
export function useMobile() {
  // Initialize as undefined to avoid SSR/client mismatch.
  // Components should treat undefined as "not yet known" and defer layout decisions.
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    setIsMobile(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isMobile;
}
