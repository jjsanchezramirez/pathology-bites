// src/shared/contexts/font-size-context.tsx
'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface FontSizeContextType {
  fontSize: number
  increaseFontSize: () => void
  decreaseFontSize: () => void
  resetFontSize: () => void
  canIncrease: boolean
  canDecrease: boolean
}

const FontSizeContext = createContext<FontSizeContextType | undefined>(undefined)

const MIN_FONT_SIZE = 0.75 // 75% of original size
const MAX_FONT_SIZE = 1.0  // 100% of original size (current size is maximum)
const FONT_SIZE_STEP = 0.05 // 5% increments
const DEFAULT_FONT_SIZE = 1.0
const STORAGE_KEY = 'pathology-bites-font-size'

export function FontSizeProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE)
  const [mounted, setMounted] = useState(false)

  // Load font size from localStorage on mount
  useEffect(() => {
    const savedFontSize = localStorage.getItem(STORAGE_KEY)
    if (savedFontSize) {
      const parsedSize = parseFloat(savedFontSize)
      if (parsedSize >= MIN_FONT_SIZE && parsedSize <= MAX_FONT_SIZE) {
        setFontSize(parsedSize)
      }
    }
    setMounted(true)
  }, [])

  // Apply font size to CSS custom property
  useEffect(() => {
    if (mounted) {
      document.documentElement.style.setProperty('--font-scale', fontSize.toString())
      localStorage.setItem(STORAGE_KEY, fontSize.toString())
    }
  }, [fontSize, mounted])

  const increaseFontSize = () => {
    setFontSize(prev => Math.min(prev + FONT_SIZE_STEP, MAX_FONT_SIZE))
  }

  const decreaseFontSize = () => {
    setFontSize(prev => Math.max(prev - FONT_SIZE_STEP, MIN_FONT_SIZE))
  }

  const resetFontSize = () => {
    setFontSize(DEFAULT_FONT_SIZE)
  }

  const canIncrease = fontSize < MAX_FONT_SIZE
  const canDecrease = fontSize > MIN_FONT_SIZE

  const value: FontSizeContextType = {
    fontSize,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    canIncrease,
    canDecrease,
  }

  return (
    <FontSizeContext.Provider value={value}>
      {children}
    </FontSizeContext.Provider>
  )
}

export function useFontSize() {
  const context = useContext(FontSizeContext)
  if (context === undefined) {
    throw new Error('useFontSize must be used within a FontSizeProvider')
  }
  return context
}
