// src/shared/contexts/font-size-context.tsx
'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
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

  const updateTextZoom = async (newZoom: number) => {
    const validZoom = getValidZoomLevel(newZoom)
    setTextZoomState(validZoom)
    applyTextZoom(validZoom)

    // Update localStorage immediately
    localStorage.setItem(STORAGE_KEY, validZoom.toString())

    // Try to update database only if user is authenticated (don't block UI if it fails)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        await userSettingsService.updateUISettings({
          text_zoom: validZoom
        })
      }
    } catch (error) {
      console.warn('Error saving text zoom to database:', error)
      // Continue with localStorage-only operation
    }
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
