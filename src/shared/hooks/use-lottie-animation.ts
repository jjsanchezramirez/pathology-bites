// src/shared/hooks/use-lottie-animation.ts
// Hook for loading Lottie animations with localStorage caching

import { useEffect, useState } from 'react'
import { lottieCacheService } from '@/shared/services/lottie-cache-service'

const ANIMATION_BASE_URL = 'https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/animations'

interface UseLottieAnimationResult {
  animationData: unknown | null
  isLoading: boolean
  error: Error | null
}

/**
 * Hook to load Lottie animations with automatic localStorage caching
 * 
 * @param animationName - Name of the animation file (without .json extension)
 * @returns Object containing animationData, isLoading, and error states
 * 
 * @example
 * const { animationData, isLoading } = useLottieAnimation('badge')
 * const { animationData } = useLottieAnimation('under_construction')
 */
export function useLottieAnimation(animationName: string): UseLottieAnimationResult {
  const [animationData, setAnimationData] = useState<unknown>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadAnimation = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Try to get from cache first
        const cached = lottieCacheService.get(animationName)
        
        if (cached) {
          console.log(`[LottieCache] ✅ Cache hit for ${animationName}`)
          if (isMounted) {
            setAnimationData(cached)
            setIsLoading(false)
          }
          return
        }

        // Cache miss - fetch from R2
        console.log(`[LottieCache] ⬇️ Fetching ${animationName} from R2`)
        const response = await fetch(`${ANIMATION_BASE_URL}/${animationName}.json`)
        
        if (!response.ok) {
          throw new Error(`Failed to load animation: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()

        // Store in cache for future use
        lottieCacheService.set(animationName, data)
        console.log(`[LottieCache] 💾 Cached ${animationName}`)

        if (isMounted) {
          setAnimationData(data)
          setIsLoading(false)
        }
      } catch (err) {
        console.error(`[LottieCache] ❌ Error loading ${animationName}:`, err)
        const errorObj = err instanceof Error ? err : new Error('Failed to load animation')
        if (isMounted) {
          setError(errorObj)
          setIsLoading(false)
        }
      }
    }

    loadAnimation()

    return () => {
      isMounted = false
    }
  }, [animationName])

  return { animationData, isLoading, error }
}

