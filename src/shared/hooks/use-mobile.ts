// src/shared/hooks/use-mobile.ts
'use client'

import { useState, useEffect } from 'react'

/**
 * Hook to detect if the current screen size is mobile
 * Uses Tailwind's lg breakpoint (1024px) as the threshold
 */
export function useMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Use Tailwind's lg breakpoint (1024px)
    const mediaQuery = window.matchMedia('(max-width: 1023px)')

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
  }, [])

  return isMobile
}
