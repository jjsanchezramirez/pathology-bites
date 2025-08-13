// src/shared/contexts/font-size-context.tsx
'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react'
import {
  getTextZoomConfig,
  applyTextZoom,
  getValidZoomLevel
} from '@/shared/utils/text-zoom'
import { userSettingsService } from '@/shared/services/user-settings'
import { createClient } from '@/shared/services/client'

interface TextZoomContextType {
  textZoom: number
  increaseTextZoom: () => void
  decreaseTextZoom: () => void
  resetTextZoom: () => void
  setTextZoom: (zoom: number) => void
  canIncrease: boolean
  canDecrease: boolean
  isLoading: boolean
}

const TextZoomContext = createContext<TextZoomContextType | undefined>(undefined)

const STORAGE_KEY = 'pathology-bites-text-zoom'

export function TextZoomProvider({ children }: { children: ReactNode }) {
  const [textZoom, setTextZoomState] = useState(1.0)
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const config = getTextZoomConfig()
  
  // Debounce database updates to avoid API calls on every button press
  const dbUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingZoomRef = useRef<number | null>(null)

  // Load text zoom from database/localStorage on mount
  useEffect(() => {
    const loadTextZoom = async () => {
      try {
        setIsLoading(true)

        // Check if user is authenticated before trying to fetch from database
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        let zoom: number

        if (user) {
          // User is authenticated, try to get from database first
          try {
            const userSettings = await userSettingsService.getUserSettings()
            zoom = userSettings.ui_settings.text_zoom

            if (!zoom) {
              // Fallback to localStorage
              const savedZoom = localStorage.getItem(STORAGE_KEY)
              if (savedZoom) {
                zoom = parseFloat(savedZoom)
              } else {
                zoom = config.default
              }
            }
          } catch (dbError) {
            // Database fetch failed, fallback to localStorage
            console.warn('Failed to fetch user settings, using localStorage:', dbError)
            const savedZoom = localStorage.getItem(STORAGE_KEY)
            zoom = savedZoom ? parseFloat(savedZoom) : config.default
          }
        } else {
          // User is not authenticated, use localStorage or default
          const savedZoom = localStorage.getItem(STORAGE_KEY)
          zoom = savedZoom ? parseFloat(savedZoom) : config.default
        }

        const validZoom = getValidZoomLevel(zoom)
        setTextZoomState(validZoom)
        applyTextZoom(validZoom)

        // Always sync localStorage for consistency
        localStorage.setItem(STORAGE_KEY, validZoom.toString())
      } catch (error) {
        console.error('Error loading text zoom:', error)
        // Final fallback to localStorage or default
        const savedZoom = localStorage.getItem(STORAGE_KEY)
        const zoom = savedZoom ? parseFloat(savedZoom) : config.default
        const validZoom = getValidZoomLevel(zoom)
        setTextZoomState(validZoom)
        applyTextZoom(validZoom)
        localStorage.setItem(STORAGE_KEY, validZoom.toString())
      } finally {
        setIsLoading(false)
        setMounted(true)
      }
    }

    loadTextZoom()
  }, [config.default])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (dbUpdateTimeoutRef.current) {
        clearTimeout(dbUpdateTimeoutRef.current)
      }
    }
  }, [])

  // Debounced database update function
  const debouncedDatabaseUpdate = useCallback(async (zoom: number) => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        await userSettingsService.updateUISettings({
          text_zoom: zoom
        })
      }
    } catch (error) {
      // Silently fail - localStorage is already updated
    }
  }, [])

  const updateTextZoom = (newZoom: number) => {
    const validZoom = getValidZoomLevel(newZoom)
    setTextZoomState(validZoom)
    applyTextZoom(validZoom)

    // Update localStorage immediately for instant response
    localStorage.setItem(STORAGE_KEY, validZoom.toString())

    // Store the pending zoom value
    pendingZoomRef.current = validZoom

    // Clear any existing timeout
    if (dbUpdateTimeoutRef.current) {
      clearTimeout(dbUpdateTimeoutRef.current)
    }

    // Debounce database update for 1 second
    dbUpdateTimeoutRef.current = setTimeout(() => {
      const finalZoom = pendingZoomRef.current
      if (finalZoom !== null) {
        debouncedDatabaseUpdate(finalZoom)
        pendingZoomRef.current = null
      }
    }, 1000)
  }

  const increaseTextZoom = () => {
    const newZoom = Math.min(config.max, textZoom + config.step)
    updateTextZoom(newZoom)
  }

  const decreaseTextZoom = () => {
    const newZoom = Math.max(config.min, textZoom - config.step)
    updateTextZoom(newZoom)
  }

  const resetTextZoom = () => {
    updateTextZoom(config.default)
  }

  const setTextZoom = (zoom: number) => {
    updateTextZoom(zoom)
  }

  const canIncrease = textZoom < config.max
  const canDecrease = textZoom > config.min

  const value: TextZoomContextType = {
    textZoom,
    increaseTextZoom,
    decreaseTextZoom,
    resetTextZoom,
    setTextZoom,
    canIncrease,
    canDecrease,
    isLoading,
  }

  return (
    <TextZoomContext.Provider value={value}>
      {children}
    </TextZoomContext.Provider>
  )
}

export function useTextZoom() {
  const context = useContext(TextZoomContext)
  if (context === undefined) {
    throw new Error('useTextZoom must be used within a TextZoomProvider')
  }
  return context
}

// Legacy export for backward compatibility
export const useFontSize = useTextZoom
