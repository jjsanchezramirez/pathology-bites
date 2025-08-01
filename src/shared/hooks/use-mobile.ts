// src/shared/hooks/use-mobile.ts
'use client'

import { useState, useEffect } from 'react'

/**
 * Hook to detect if the current screen size is mobile
 * Uses Tailwind's md breakpoint (768px) as the threshold
 * Only responds to actual viewport size changes, not text scaling
 */
export function useMobile() {
  // Initialize as true (mobile-first) to prevent layout shift on mobile devices
  const [isMobile, setIsMobile] = useState(true)

  useEffect(() => {
    // Use fixed breakpoint based on actual viewport width only
    const mediaQuery = window.matchMedia('(max-width: 767px)')

    // Set initial value
    setIsMobile(mediaQuery.matches)

    // Create event listener
    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches)
    }

    // Add listener
    mediaQuery.addEventListener('change', handleChange)

    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, []) // No dependencies - only respond to viewport changes

  return isMobile
}
