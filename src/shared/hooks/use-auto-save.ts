'use client'

import { useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'

interface AutoSaveOptions {
  key: string
  data: any
  enabled?: boolean
  interval?: number // milliseconds
  onSave?: (data: any) => void
  onRestore?: (data: any) => void
  onError?: (error: Error) => void
}

interface AutoSaveResult {
  save: () => void
  restore: () => any
  clear: () => void
  hasStoredData: () => boolean
}

/**
 * Hook for automatic saving and restoring of form data to localStorage
 * Prevents data loss during unexpected page reloads or navigation
 */
export function useAutoSave({
  key,
  data,
  enabled = true,
  interval = 30000, // 30 seconds default
  onSave,
  onRestore,
  onError
}: AutoSaveOptions): AutoSaveResult {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedRef = useRef<string>('')

  // Generate storage key with prefix
  const storageKey = `autosave_${key}`

  const save = useCallback(() => {
    if (!enabled || typeof window === 'undefined') return

    try {
      const serializedData = JSON.stringify({
        data,
        timestamp: Date.now(),
        version: '1.0'
      })

      // Only save if data has changed
      if (serializedData !== lastSavedRef.current) {
        localStorage.setItem(storageKey, serializedData)
        lastSavedRef.current = serializedData
        onSave?.(data)
        
        // Show subtle save indicator
        console.log(`Auto-saved: ${key}`)
      }
    } catch (error) {
      console.error('Auto-save failed:', error)
      onError?.(error as Error)
    }
  }, [data, enabled, storageKey, onSave, onError, key])

  const restore = useCallback(() => {
    if (typeof window === 'undefined') return null

    try {
      const stored = localStorage.getItem(storageKey)
      if (!stored) return null

      const parsed = JSON.parse(stored)
      
      // Validate stored data structure
      if (!parsed.data || !parsed.timestamp) {
        console.warn('Invalid auto-save data structure, clearing...')
        localStorage.removeItem(storageKey)
        return null
      }

      // Check if data is too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000
      if (Date.now() - parsed.timestamp > maxAge) {
        console.log('Auto-save data expired, clearing...')
        localStorage.removeItem(storageKey)
        return null
      }

      onRestore?.(parsed.data)
      return parsed.data
    } catch (error) {
      console.error('Auto-restore failed:', error)
      onError?.(error as Error)
      // Clear corrupted data
      localStorage.removeItem(storageKey)
      return null
    }
  }, [storageKey, onRestore, onError])

  const clear = useCallback(() => {
    if (typeof window === 'undefined') return

    try {
      localStorage.removeItem(storageKey)
      lastSavedRef.current = ''
      console.log(`Auto-save cleared: ${key}`)
    } catch (error) {
      console.error('Failed to clear auto-save:', error)
      onError?.(error as Error)
    }
  }, [storageKey, onError, key])

  const hasStoredData = useCallback(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(storageKey) !== null
  }, [storageKey])

  // Set up auto-save interval
  useEffect(() => {
    if (!enabled) return

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    // Set up new interval
    intervalRef.current = setInterval(save, interval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [save, interval, enabled])

  // Save on unmount
  useEffect(() => {
    return () => {
      if (enabled) {
        save()
      }
    }
  }, [save, enabled])

  // Save on page visibility change (when user switches tabs)
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        save()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [save, enabled])

  return {
    save,
    restore,
    clear,
    hasStoredData
  }
}

/**
 * Hook specifically for form auto-save with recovery notifications
 */
export function useFormAutoSave<T>(
  key: string,
  formData: T,
  options: {
    enabled?: boolean
    interval?: number
    onRestore?: (data: T) => void
  } = {}
) {
  const { enabled = true, interval = 30000, onRestore } = options

  const autoSave = useAutoSave({
    key,
    data: formData,
    enabled,
    interval,
    onSave: () => {
      // Optional: Show save indicator
    },
    onRestore: (data: T) => {
      toast.success('Previous work restored from auto-save', {
        description: 'Your unsaved changes have been recovered.',
        duration: 5000
      })
      onRestore?.(data)
    },
    onError: (error) => {
      console.error('Form auto-save error:', error)
    }
  })

  // Check for stored data on mount and offer recovery
  useEffect(() => {
    if (enabled && autoSave.hasStoredData()) {
      const restored = autoSave.restore()
      if (restored) {
        // Data was restored and onRestore callback was called
      }
    }
  }, []) // Only run on mount

  return autoSave
}
