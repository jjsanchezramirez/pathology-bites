// src/shared/hooks/use-public-stats.ts
import { useState, useEffect } from 'react'

export interface PublicStats {
  questions: number
  images: number
  categories: number
}

export function usePublicStats() {
  const [stats, setStats] = useState<PublicStats>({
    questions: 500,
    images: 1200,
    categories: 25
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/public/stats')
        
        if (!response.ok) {
          throw new Error('Failed to fetch stats')
        }

        const result = await response.json()
        
        if (result.success && result.data) {
          setStats(result.data)
        }
      } catch (err) {
        console.error('Error fetching public stats:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch stats')
        // Keep fallback values on error
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return { stats, loading, error }
}
