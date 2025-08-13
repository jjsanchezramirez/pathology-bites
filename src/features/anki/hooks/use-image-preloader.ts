// src/features/anki/hooks/use-image-preloader.ts
/**
 * Hook for preloading images to improve Anki card performance
 * Aggressively preloads images from upcoming cards
 */

import { useEffect, useRef } from 'react'
import { AnkiCard } from '../types/anki-card'

interface UseImagePreloaderOptions {
  enabled?: boolean
  preloadCount?: number // Number of upcoming cards to preload
  priority?: 'high' | 'low'
}

export function useImagePreloader(
  cards: AnkiCard[],
  currentIndex: number,
  options: UseImagePreloaderOptions = {}
) {
  const {
    enabled = true,
    preloadCount = 5,
    priority = 'low'
  } = options

  const preloadedImages = useRef<Set<string>>(new Set())
  const preloadQueue = useRef<string[]>([])

  // Extract image URLs from card content
  const extractImageUrls = (content: string): string[] => {
    const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g
    const urls: string[] = []
    let match

    while ((match = imgRegex.exec(content)) !== null) {
      let src = match[1]
      
      // Convert relative paths to direct R2 CDN URLs
      // Files are now organized in anki/ subfolder
      if (!src.startsWith('http')) {
        const sanitizedSrc = src.replace(/\s+/g, '_')
        const publicUrl = 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev'
        src = `${publicUrl}/anki/${sanitizedSrc}`
      }
      
      urls.push(src)
    }

    return urls
  }

  // Get all image URLs from a card
  const getCardImageUrls = (card: AnkiCard): string[] => {
    const urls: string[] = []
    
    if (card.question) {
      urls.push(...extractImageUrls(card.question))
    }
    
    if (card.answer) {
      urls.push(...extractImageUrls(card.answer))
    }

    // Extract from fields if available
    if (card.fields) {
      Object.values(card.fields).forEach(fieldValue => {
        if (typeof fieldValue === 'string') {
          urls.push(...extractImageUrls(fieldValue))
        }
      })
    }

    return urls
  }

  // Preload a single image
  const preloadImage = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (preloadedImages.current.has(url)) {
        resolve()
        return
      }

      const img = new Image()
      
      img.onload = () => {
        preloadedImages.current.add(url)
        resolve()
      }
      
      img.onerror = () => {
        console.warn(`Failed to preload image: ${url}`)
        reject(new Error(`Failed to preload image: ${url}`))
      }

      // Set loading priority
      if ('loading' in img) {
        img.loading = priority === 'high' ? 'eager' : 'lazy'
      }

      img.src = url
    })
  }

  // Process preload queue
  const processPreloadQueue = async () => {
    if (preloadQueue.current.length === 0) return

    const batch = preloadQueue.current.splice(0, 3) // Process 3 images at a time
    
    try {
      await Promise.allSettled(
        batch.map(url => preloadImage(url))
      )
    } catch (error) {
      console.warn('Batch preload error:', error)
    }

    // Continue processing if there are more images
    if (preloadQueue.current.length > 0) {
      setTimeout(processPreloadQueue, 100) // Small delay between batches
    }
  }

  // Add images to preload queue
  const queueImagesForPreload = (urls: string[]) => {
    const newUrls = urls.filter(url => 
      !preloadedImages.current.has(url) && 
      !preloadQueue.current.includes(url)
    )
    
    preloadQueue.current.push(...newUrls)
  }

  useEffect(() => {
    if (!enabled || cards.length === 0) return

    // Get upcoming cards to preload
    const upcomingCards = cards.slice(
      currentIndex + 1, 
      currentIndex + 1 + preloadCount
    )

    // Collect all image URLs from upcoming cards
    const imageUrls: string[] = []
    upcomingCards.forEach(card => {
      imageUrls.push(...getCardImageUrls(card))
    })

    // Queue images for preloading
    if (imageUrls.length > 0) {
      queueImagesForPreload(imageUrls)
      processPreloadQueue()
    }
  }, [cards, currentIndex, enabled, preloadCount])

  // Preload current card images with high priority
  useEffect(() => {
    if (!enabled || !cards[currentIndex]) return

    const currentCard = cards[currentIndex]
    const currentImageUrls = getCardImageUrls(currentCard)

    // Preload current card images immediately with high priority
    currentImageUrls.forEach(url => {
      if (!preloadedImages.current.has(url)) {
        preloadImage(url).catch(() => {
          // Ignore errors for current card preloading
        })
      }
    })
  }, [cards, currentIndex, enabled])

  // Cleanup function
  const clearPreloadCache = () => {
    preloadedImages.current.clear()
    preloadQueue.current = []
  }

  return {
    preloadedCount: preloadedImages.current.size,
    queueLength: preloadQueue.current.length,
    clearCache: clearPreloadCache
  }
}

/**
 * Hook for preloading images from a specific list of URLs
 */
export function useImageListPreloader(
  imageUrls: string[],
  options: { enabled?: boolean; priority?: 'high' | 'low' } = {}
) {
  const { enabled = true, priority = 'low' } = options
  const preloadedImages = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!enabled || imageUrls.length === 0) return

    const preloadImage = (url: string): Promise<void> => {
      return new Promise((resolve) => {
        if (preloadedImages.current.has(url)) {
          resolve()
          return
        }

        const img = new Image()
        
        img.onload = () => {
          preloadedImages.current.add(url)
          resolve()
        }
        
        img.onerror = () => {
          console.warn(`Failed to preload image: ${url}`)
          resolve() // Don't reject to avoid breaking the batch
        }

        if ('loading' in img) {
          img.loading = priority === 'high' ? 'eager' : 'lazy'
        }

        img.src = url
      })
    }

    // Preload all images
    Promise.allSettled(
      imageUrls.map(url => preloadImage(url))
    ).then(() => {
      console.log(`Preloaded ${preloadedImages.current.size}/${imageUrls.length} images`)
    })
  }, [imageUrls, enabled, priority])

  return {
    preloadedCount: preloadedImages.current.size,
    totalCount: imageUrls.length
  }
}
