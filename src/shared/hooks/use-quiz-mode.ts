// src/shared/hooks/use-quiz-mode.ts
'use client'

import { usePathname } from 'next/navigation'
import { useMemo } from 'react'

/**
 * Hook to detect if the user is currently in an active quiz mode
 * Returns true for active quiz sessions (/dashboard/quiz/[id])
 * Returns false for quiz creation (/dashboard/quiz/new) and tutor mode (/dashboard/quiz/tutor)
 */
export function useQuizMode() {
  const pathname = usePathname()

  const isInQuizMode = useMemo(() => {
    if (!pathname) return false

    // Exclude /dashboard/quiz/new from quiz mode (sidebar should not collapse)
    if (pathname === '/dashboard/quiz/new') return false

    // Check if we're in any other quiz-related page
    // This includes: /dashboard/quiz/tutor, /dashboard/quiz/[id], etc.
    return pathname.startsWith('/dashboard/quiz/')
  }, [pathname])

  return {
    isInQuizMode,
    pathname
  }
}

/**
 * Hook to detect if the user is currently in Anki mode
 * Returns true when on /dashboard/anki
 */
export function useAnkiMode() {
  const pathname = usePathname()

  const isInAnkiMode = useMemo(() => {
    return pathname ? pathname.startsWith('/dashboard/anki') : false
  }, [pathname])

  return {
    isInAnkiMode,
    pathname
  }
}
