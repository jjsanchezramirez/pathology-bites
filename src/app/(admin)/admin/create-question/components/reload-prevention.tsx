'use client'

import { useEffect } from 'react'

interface ReloadPreventionProps {
  hasUnsavedChanges: boolean
  enabled?: boolean
}

/**
 * Component that prevents automatic page reloads and data refetching
 * when users have unsaved changes in the create-question workflow
 */
export function ReloadPrevention({ hasUnsavedChanges, enabled = true }: ReloadPreventionProps) {

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    // Add a global flag to indicate unsaved changes
    if (hasUnsavedChanges) {
      (window as any).__PATHOLOGY_BITES_UNSAVED_CHANGES__ = true
      console.log('🛡️ Marked page as having unsaved changes - preventing automatic reloads')
    } else {
      (window as any).__PATHOLOGY_BITES_UNSAVED_CHANGES__ = false
      console.log('✅ Cleared unsaved changes flag - automatic reloads allowed')
    }

    // Override the page visibility change handler to prevent refetching
    const handleVisibilityChange = (event: Event) => {
      if (hasUnsavedChanges && document.visibilityState === 'visible') {
        console.log('🛡️ Prevented visibility-based refetch due to unsaved changes')
        event.stopImmediatePropagation()
      }
    }

    // Add our handler with high priority (capture phase)
    document.addEventListener('visibilitychange', handleVisibilityChange, true)

    // Override window focus to prevent refetching
    const handleWindowFocus = (event: Event) => {
      if (hasUnsavedChanges) {
        console.log('🛡️ Prevented focus-based refetch due to unsaved changes')
        event.stopImmediatePropagation()
      }
    }

    window.addEventListener('focus', handleWindowFocus, true)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange, true)
      window.removeEventListener('focus', handleWindowFocus, true)
    }
  }, [hasUnsavedChanges, enabled])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        (window as any).__PATHOLOGY_BITES_UNSAVED_CHANGES__ = false
      }
    }
  }, [])

  // This component doesn't render anything
  return null
}
