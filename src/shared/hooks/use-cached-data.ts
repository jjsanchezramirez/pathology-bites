// src/shared/hooks/use-cached-data.ts
// Hook for cached data fetching with intelligent cache management

import { useState, useEffect, useCallback, useRef } from 'react'
import { cacheService, type CacheOptions } from '@/shared/services/cache-service'

interface UseCachedDataOptions<T> extends CacheOptions {
  enabled?: boolean
  refetchOnMount?: boolean
  refetchOnWindowFocus?: boolean
  staleTime?: number // Time before data is considered stale (but still served from cache)
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
}

interface UseCachedDataResult<T> {
  data: T | null
  isLoading: boolean
  error: Error | null
  isStale: boolean
  refetch: () => Promise<void>
  invalidate: () => void
}

export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseCachedDataOptions<T> = {}
): UseCachedDataResult<T> {
  const {
    enabled = true,
    refetchOnMount = true,
    refetchOnWindowFocus = false,
    staleTime = 2 * 60 * 1000, // 2 minutes
    ttl = 5 * 60 * 1000, // 5 minutes
    storage = 'memory',
    prefix = 'pathology-bites-cache',
    onSuccess,
    onError
  } = options

  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [isStale, setIsStale] = useState(false)
  const [lastFetch, setLastFetch] = useState<number>(0)

  const mounted = useRef(true)
  const fetchingRef = useRef(false)

  // Check if data is stale
  const checkStaleStatus = useCallback((timestamp: number) => {
    const now = Date.now()
    return now - timestamp > staleTime
  }, [staleTime])

  // Fetch data with caching
  const fetchData = useCallback(async (force = false) => {
    if (!enabled || fetchingRef.current) return

    // Try to get from cache first
    if (!force) {
      const cached = cacheService.get<{ data: T; timestamp: number }>(key, { storage, prefix })
      if (cached) {
        setData(cached.data)
        setLastFetch(cached.timestamp)
        setIsStale(checkStaleStatus(cached.timestamp))
        setError(null)

        // If data is not stale, don't fetch
        if (!checkStaleStatus(cached.timestamp)) {
          return
        }
      }
    }

    try {
      fetchingRef.current = true
      setIsLoading(true)
      setError(null)

      console.log(`🔄 Fetching fresh data for key: ${key}`)
      const result = await fetcher()

      if (!mounted.current) return

      const timestamp = Date.now()

      // Cache the result
      cacheService.set(
        key,
        { data: result, timestamp },
        { ttl, storage, prefix }
      )

      setData(result)
      setLastFetch(timestamp)
      setIsStale(false)
      onSuccess?.(result)

    } catch (err) {
      if (!mounted.current) return

      const error = err instanceof Error ? err : new Error('Fetch failed')
      setError(error)
      onError?.(error)
      console.error(`❌ Failed to fetch data for key: ${key}`, error)

    } finally {
      if (mounted.current) {
        setIsLoading(false)
      }
      fetchingRef.current = false
    }
  }, [key, fetcher, enabled, storage, prefix, ttl, staleTime, checkStaleStatus, onSuccess, onError])

  // Invalidate cache and refetch
  const invalidate = useCallback(() => {
    cacheService.delete(key, { storage, prefix })
    setData(null)
    setIsStale(false)
    setLastFetch(0)
    if (enabled) {
      fetchData(true)
    }
  }, [key, storage, prefix, enabled, fetchData])

  // Refetch data
  const refetch = useCallback(async () => {
    await fetchData(true)
  }, [fetchData])

  // Initial fetch
  useEffect(() => {
    mounted.current = true

    if (enabled && refetchOnMount) {
      fetchData()
    }

    return () => {
      mounted.current = false
    }
  }, [enabled, refetchOnMount, fetchData])

  // Window focus refetch
  useEffect(() => {
    if (!refetchOnWindowFocus || !enabled) return

    const handleFocus = () => {
      // Only refetch if data is stale
      if (lastFetch && checkStaleStatus(lastFetch)) {
        fetchData()
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [refetchOnWindowFocus, enabled, lastFetch, checkStaleStatus, fetchData])

  return {
    data,
    isLoading,
    error,
    isStale,
    refetch,
    invalidate
  }
}