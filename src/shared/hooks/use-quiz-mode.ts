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
    // Check if we're in any quiz-related page
    // This includes: /dashboard/quiz/new, /dashboard/quiz/tutor, /dashboard/quiz/[id], etc.
    return pathname ? pathname.startsWith('/dashboard/quiz/') : false
  }, [pathname])

  return {
    isInQuizMode,
    pathname
  }
}
