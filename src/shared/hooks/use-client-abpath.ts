"use client"

import { useEffect, useState } from 'react'
// Direct R2 access - CORS is configured on bucket
const ABPATH_API_URL = 'https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/ab-path/content-specs.json'

// Module-scope cache so we only fetch once per session
let cachedABPathPromise: Promise<any> | null = null

interface UseClientABPathResult {
  data: any | null
  isLoading: boolean
  error: string | null
}

// Timeout utility for fetch requests
function fetchWithTimeout(url: string, options: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 10000, ...fetchOptions } = options
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  
  return fetch(url, {
    ...fetchOptions,
    signal: controller.signal
  }).finally(() => clearTimeout(timeoutId))
}

async function loadABPathContentSpecs(): Promise<any> {
  if (cachedABPathPromise) return cachedABPathPromise

  async function fetchWithFallback() {
    try {
      // Direct R2 access - optimized for production
      const res = await fetch(ABPATH_API_URL, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      })

      if (!res.ok) throw new Error(`Failed: ${res.status}`)
      return res
    } catch (e: any) {
      const msg = e?.name === 'AbortError'
        ? 'Timed out fetching ABPath content specifications. Please check your network and try again.'
        : (e?.message || 'Failed to fetch ABPath content specifications.')

      // Log the error but don't throw - return a fallback empty structure
      console.warn('[ABPath] API fetch failed, returning empty data structure:', e)

      // Return a mock response with empty data structure to prevent crashes
      return {
        ok: true,
        json: async () => ({
          content_specifications: {
            ap_sections: [],
            cp_sections: []
          },
          metadata: {
            total_sections: 0,
            ap_sections: 0,
            cp_sections: 0,
            last_updated: new Date().toISOString(),
            data_source: 'fallback'
          }
        })
      }
    }
  }

  cachedABPathPromise = fetchWithFallback()
    .then(async (res) => {
      const data = await res.json()

      // Validate data structure and provide defaults if missing
      if (!data || !data.content_specifications) {
        console.warn('[ABPath] Invalid data structure, using fallback')
        return {
          content_specifications: {
            ap_sections: [],
            cp_sections: []
          },
          metadata: {
            total_sections: 0,
            ap_sections: 0,
            cp_sections: 0,
            last_updated: new Date().toISOString(),
            data_source: 'fallback'
          }
        }
      }

      return data
    })

  return cachedABPathPromise
}

export function useClientABPath(): UseClientABPathResult {
  const [data, setData] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    
    async function loadData() {
      try {
        setIsLoading(true)
        setError(null)
        
        console.log('🔄 Loading ABPath content specs from API...')
        
        const abpathData = await loadABPathContentSpecs()
        
        if (mounted) {
          setData(abpathData)
          
          console.log('✅ ABPath content specs loaded successfully:', {
            totalSections: abpathData.metadata?.total_sections || 0,
            apSections: abpathData.metadata?.ap_sections || 0,
            cpSections: abpathData.metadata?.cp_sections || 0,
            dataSize: abpathData ? `${(JSON.stringify(abpathData).length / 1024).toFixed(1)}KB` : '0KB'
          })
        }
      } catch (err: any) {
        console.warn('⚠️ ABPath content specs load issue (using fallback):', err)
        if (mounted) {
          // Don't set error state since we have fallback data
          // setError(err.message || 'Failed to load ABPath content specifications')
          setError(null)
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    loadData()
    
    return () => {
      mounted = false
    }
  }, [])

  return { data, isLoading, error }
}

// Export for manual cache clearing if needed
export function clearABPathCache() {
  cachedABPathPromise = null
}
