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



  // Fetch data with caching
  const fetchData = useCallback(async (force = false) => {
    if (!enabled || fetchingRef.current) return

    // Try to get from cache first
    if (!force) {
      const cached = cacheService.get<{ data: T; timestamp: number }>(key, { storage, prefix })
      if (cached) {
        setData(cached.data)
        setLastFetch(cached.timestamp)
        const isStaleData = Date.now() - cached.timestamp > staleTime
        setIsStale(isStaleData)
        setError(null)

        // If data is not stale, don't fetch
        if (!isStaleData) {
          return
        }
      }
    }

    try {
      fetchingRef.current = true
      setIsLoading(true)
      setError(null)

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

    } finally {
      if (mounted.current) {
        setIsLoading(false)
      }
      fetchingRef.current = false
    }
  }, [key, enabled, storage, prefix, ttl, fetcher])

  // Create refs for stable function references
  const fetchDataRef = useRef(fetchData)
  fetchDataRef.current = fetchData

  // Invalidate cache and refetch
  const invalidate = useCallback(() => {
    cacheService.delete(key, { storage, prefix })
    setData(null)
    setIsStale(false)
    setLastFetch(0)
    if (enabled) {
      fetchDataRef.current(true)
    }
  }, [key, storage, prefix, enabled])

  // Refetch data
  const refetch = useCallback(async () => {
    await fetchDataRef.current(true)
  }, [])

  // Initial fetch
  useEffect(() => {
    mounted.current = true

    if (enabled && refetchOnMount) {
      fetchDataRef.current()
    }

    return () => {
      mounted.current = false
    }
  }, [enabled, refetchOnMount])

  // Window focus refetch
  useEffect(() => {
    if (!refetchOnWindowFocus || !enabled) return

    const handleFocus = () => {
      // Only refetch if data is stale
      if (lastFetch && Date.now() - lastFetch > staleTime) {
        fetchDataRef.current()
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [refetchOnWindowFocus, enabled, lastFetch, staleTime])

  return {
    data,
    isLoading,
    error,
    isStale,
    refetch,
    invalidate
  }
}