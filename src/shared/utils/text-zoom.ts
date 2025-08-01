// src/shared/utils/text-zoom.ts
// Utility functions for text zoom configuration

export interface TextZoomConfig {
  min: number
  max: number
  default: number
  step: number
}

/**
 * Get text zoom configuration from environment variables
 */
export function getTextZoomConfig(): TextZoomConfig {
  const min = parseFloat(process.env.NEXT_PUBLIC_MIN_TEXT_ZOOM_SIZE || '0.75')
  const max = parseFloat(process.env.NEXT_PUBLIC_MAX_TEXT_ZOOM_SIZE || '1.25')
  const defaultZoom = parseFloat(process.env.NEXT_PUBLIC_DEFAULT_TEXT_ZOOM_SIZE || '1.0')
  const step = parseFloat(process.env.NEXT_PUBLIC_TEXT_ZOOM_STEP || '0.05')

  return {
    min,
    max,
    default: defaultZoom,
    step
  }
}

/**
 * Convert zoom level to font size in pixels (with decimal precision)
 */
export function zoomToFontSize(zoom: number): number {
  const baseSize = 16 // Base font size in pixels
  // Round to 1 decimal place to preserve precision while avoiding sub-pixel issues
  return Math.round(baseSize * zoom * 10) / 10
}

/**
 * Convert font size to zoom level
 */
export function fontSizeToZoom(fontSize: number): number {
  const baseSize = 16
  return fontSize / baseSize
}

/**
 * Get available zoom levels based on configuration
 */
export function getAvailableZoomLevels(): Array<{ value: number; label: string }> {
  const config = getTextZoomConfig()
  const levels: Array<{ value: number; label: string }> = []
  
  for (let zoom = config.min; zoom <= config.max; zoom += config.step) {
    // Round to avoid floating point precision issues
    const roundedZoom = Math.round(zoom * 100) / 100
    const percentage = Math.round(roundedZoom * 100)
    const fontSize = zoomToFontSize(roundedZoom)
    
    levels.push({
      value: roundedZoom,
      label: `${percentage}% (${fontSize}px)`
    })
  }
  
  return levels
}

/**
 * Apply text zoom to document
 */
export function applyTextZoom(zoom: number): void {
  if (typeof document !== 'undefined') {
    const fontSize = zoomToFontSize(zoom)
    document.documentElement.style.fontSize = `${fontSize}px`

    // Also set a CSS custom property for more granular control
    document.documentElement.style.setProperty('--text-zoom', zoom.toString())
    document.documentElement.style.setProperty('--text-zoom-percentage', `${Math.round(zoom * 100)}%`)
  }
}

/**
 * Get the closest valid zoom level
 */
export function getValidZoomLevel(zoom: number): number {
  const config = getTextZoomConfig()

  if (zoom < config.min) return config.min
  if (zoom > config.max) return config.max

  // Round to nearest step with better precision handling
  const steps = Math.round((zoom - config.min) / config.step)
  const result = config.min + (steps * config.step)

  // Round to 2 decimal places to avoid floating point precision issues
  return Math.round(result * 100) / 100
}

/**
 * Convert legacy font size to zoom level
 */
export function legacyFontSizeToZoom(fontSize: 'small' | 'medium' | 'large'): number {
  switch (fontSize) {
    case 'small':
      return 0.875 // 14px
    case 'large':
      return 1.125 // 18px
    case 'medium':
    default:
      return 1.0 // 16px
  }
}

/**
 * Convert zoom level to legacy font size
 */
export function zoomToLegacyFontSize(zoom: number): 'small' | 'medium' | 'large' {
  if (zoom <= 0.9) return 'small'
  if (zoom >= 1.1) return 'large'
  return 'medium'
}
