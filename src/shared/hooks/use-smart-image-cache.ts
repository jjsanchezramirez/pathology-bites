// src/shared/hooks/use-smart-image-cache.ts
/**
 * Smart image caching utility for repeated images
 * Optimizes for Vercel limits while enabling browser caching
 */

import { useCallback } from 'react'

interface ImageCacheOptions {
  priority?: boolean // For critical images
  preload?: boolean // Preload on mount
}

export function useSmartImageCache() {
  const cacheImage = useCallback((imageSrc: string, options: ImageCacheOptions = {}) => {
    if (typeof window === 'undefined') return

    // Simple browser cache hint - let browser decide caching strategy
    const img = new window.Image()
    img.src = imageSrc
    
    if (options.priority) {
      // For critical images, add to head as preload hint
      const existingLink = document.querySelector(`link[href="${imageSrc}"]`)
      if (!existingLink) {
        const link = document.createElement('link')
        link.rel = 'preload'
        link.as = 'image'
        link.href = imageSrc
        document.head.appendChild(link)
      }
    }
  }, [])

  const preloadImages = useCallback((imageSrcs: string[]) => {
    imageSrcs.forEach(src => {
      cacheImage(src, { preload: true })
    })
  }, [cacheImage])

  const getCacheStats = useCallback(() => {
    if (typeof window === 'undefined') return null
    
    const preloadLinks = document.querySelectorAll('link[rel="preload"][as="image"]')
    return {
      preloadedImages: preloadLinks.length,
      browserCacheAvailable: 'caches' in window
    }
  }, [])

  return {
    cacheImage,
    preloadImages,
    getCacheStats
  }
}

/**
 * Image onLoad handler for smart caching
 */
export function useImageCacheHandler(imageSrc: string, priority = false) {
  const { cacheImage } = useSmartImageCache()
  
  return useCallback(() => {
    cacheImage(imageSrc, { priority })
  }, [cacheImage, imageSrc, priority])
}