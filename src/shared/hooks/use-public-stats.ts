// src/shared/hooks/use-public-stats.ts
import { useState, useEffect } from 'react'

export interface PublicStats {
  expertQuestions: number
  categories: number
}

// localStorage cache key and TTL (24 hours)
const CACHE_KEY = 'pathology-bites-public-stats'
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

interface CachedStats {
  data: PublicStats
  timestamp: number
}

function getCachedStats(): PublicStats | null {
  if (typeof window === 'undefined') return null

  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null

    const parsed: CachedStats = JSON.parse(cached)
    const now = Date.now()

    // Check if cache is still valid
    if (now - parsed.timestamp < CACHE_TTL) {
      return parsed.data
    }

    // Cache expired, remove it
    localStorage.removeItem(CACHE_KEY)
    return null
  } catch {
    return null
  }
}

function setCachedStats(data: PublicStats): void {
  if (typeof window === 'undefined') return

  try {
    const cacheEntry: CachedStats = {
      data,
      timestamp: Date.now()
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheEntry))
  } catch {
    // localStorage might be full or disabled, ignore
  }
}

export function usePublicStats() {
  const [stats, setStats] = useState<PublicStats>({
    expertQuestions: 0,
    categories: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check localStorage cache first
    const cachedStats = getCachedStats()
    if (cachedStats) {
      setStats(cachedStats)
      setLoading(false)
      return // Use cached data, skip API call
    }

    const fetchStats = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/public/stats')

        if (!response.ok) {
          throw new Error('Failed to fetch stats')
        }

        const result = await response.json()

        if (result.success && result.data !== undefined) {
          setStats(result.data)
          // Cache the result in localStorage
          setCachedStats(result.data)
        } else {
          throw new Error('Invalid response format')
        }
      } catch (err) {
        console.error('Error fetching public stats:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch stats')
        // Use fallback values only on error
        setStats({
          expertQuestions: 0,
          categories: 0
        })
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return { stats, loading, error }
}
