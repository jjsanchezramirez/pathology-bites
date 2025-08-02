// src/shared/components/optimization/data-preloader.tsx
/**
 * Data preloader component that proactively loads commonly accessed data
 * to improve performance and reduce bandwidth consumption
 */

'use client'

import { useEffect } from 'react'
import { useDataPreloader, useCacheCleaner } from '@/shared/hooks/use-optimized-quiz-data'

interface DataPreloaderProps {
  /** Whether to preload data on component mount */
  autoPreload?: boolean
  /** Whether to show preloading status in console */
  verbose?: boolean
}

export function DataPreloader({ 
  autoPreload = true, 
  verbose = false 
}: DataPreloaderProps) {
  const { preloadCommonData, isPreloading } = useDataPreloader()
  const { clearQuizCache } = useCacheCleaner()

  useEffect(() => {
    if (autoPreload) {
      // Small delay to avoid blocking initial render
      const timer = setTimeout(() => {
        if (verbose) {
          console.log('🚀 Starting data preload...')
        }
        preloadCommonData()
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [autoPreload, preloadCommonData, verbose])

  useEffect(() => {
    if (verbose && isPreloading) {
      console.log('⏳ Preloading common data...')
    }
    if (verbose && !isPreloading) {
      console.log('✅ Data preload complete')
    }
  }, [isPreloading, verbose])

  // Clear cache on page unload to prevent stale data
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Only clear if data is older than 1 hour
      const cacheKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('pathology-bites-')
      )
      
      const now = Date.now()
      const oneHour = 60 * 60 * 1000
      
      cacheKeys.forEach(key => {
        try {
          const cached = JSON.parse(localStorage.getItem(key) || '{}')
          if (cached.timestamp && (now - cached.timestamp) > oneHour) {
            localStorage.removeItem(key)
            if (verbose) {
              console.log(`🧹 Cleared stale cache: ${key}`)
            }
          }
        } catch (error) {
          // Invalid cache entry, remove it
          localStorage.removeItem(key)
        }
      })
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [verbose])

  // This component doesn't render anything visible
  return null
}

/**
 * Hook to manually trigger cache operations
 */
export function useCacheManager() {
  const { clearQuizCache } = useCacheCleaner()
  const { preloadCommonData, isPreloading } = useDataPreloader()

  const getCacheStats = () => {
    const cacheKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('pathology-bites-')
    )
    
    let totalSize = 0
    const stats = cacheKeys.map(key => {
      const value = localStorage.getItem(key) || ''
      const size = new Blob([value]).size
      totalSize += size
      
      try {
        const parsed = JSON.parse(value)
        return {
          key,
          size,
          timestamp: parsed.timestamp,
          age: parsed.timestamp ? Date.now() - parsed.timestamp : 0
        }
      } catch {
        return {
          key,
          size,
          timestamp: null,
          age: 0
        }
      }
    })

    return {
      totalEntries: cacheKeys.length,
      totalSize,
      totalSizeKB: Math.round(totalSize / 1024 * 100) / 100,
      entries: stats
    }
  }

  const clearOldCache = (maxAgeMs: number = 24 * 60 * 60 * 1000) => {
    const now = Date.now()
    const cacheKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('pathology-bites-')
    )
    
    let clearedCount = 0
    cacheKeys.forEach(key => {
      try {
        const cached = JSON.parse(localStorage.getItem(key) || '{}')
        if (cached.timestamp && (now - cached.timestamp) > maxAgeMs) {
          localStorage.removeItem(key)
          clearedCount++
        }
      } catch (error) {
        localStorage.removeItem(key)
        clearedCount++
      }
    })

    return clearedCount
  }

  return {
    clearQuizCache,
    preloadCommonData,
    isPreloading,
    getCacheStats,
    clearOldCache
  }
}

/**
 * Development component for cache debugging
 */
export function CacheDebugger() {
  const { getCacheStats, clearQuizCache, clearOldCache } = useCacheManager()

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  const stats = getCacheStats()

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <div><strong>Cache Stats</strong></div>
      <div>Entries: {stats.totalEntries}</div>
      <div>Size: {stats.totalSizeKB} KB</div>
      <div style={{ marginTop: '5px' }}>
        <button 
          onClick={clearQuizCache}
          style={{ 
            marginRight: '5px', 
            padding: '2px 5px',
            fontSize: '10px'
          }}
        >
          Clear All
        </button>
        <button 
          onClick={() => clearOldCache()}
          style={{ 
            padding: '2px 5px',
            fontSize: '10px'
          }}
        >
          Clear Old
        </button>
      </div>
    </div>
  )
}
