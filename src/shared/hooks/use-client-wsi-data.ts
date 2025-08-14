"use client"

import { useEffect, useState } from 'react'
import { VirtualSlide } from '@/shared/types/virtual-slides'

// Module-scope cache so we only fetch once per session
let cachedWSIPromise: Promise<VirtualSlide[]> | null = null

// WSI data URL - using the same file as virtual slides
const WSI_DATA_URL = 'https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/virtual-slides/virtual-slides.json'

export async function loadClientWSIData(): Promise<VirtualSlide[]> {
  if (cachedWSIPromise) return cachedWSIPromise

  async function fetchWithFallback() {
    const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit & { timeoutMs?: number }) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), init?.timeoutMs ?? 8000)
      try {
        const res = await fetch(input, { ...init, signal: controller.signal })
        return res
      } finally {
        clearTimeout(timeout)
      }
    }

    try {
      const res = await fetchWithTimeout(WSI_DATA_URL, {
        cache: 'force-cache',
        headers: {
          'Accept': 'application/json'
        },
        timeoutMs: 8000
      })
      if (!res.ok) throw new Error(`Failed: ${res.status}`)
      return res
    } catch (e: any) {
      console.warn('[WSI Data] R2 fetch failed in dev, falling back to /api/public-data/virtual-slides', e)

      // Fallback to server-side API (same as virtual slides)
      try {
        const fallbackRes = await fetchWithTimeout('/api/public-data/virtual-slides', {
          cache: 'force-cache',
          headers: {
            'Accept': 'application/json'
          },
          timeoutMs: 8000
        })
        if (!fallbackRes.ok) throw new Error(`Fallback failed: ${fallbackRes.status}`)
        return fallbackRes
      } catch (fallbackError) {
        const msg = e?.name === 'AbortError'
          ? 'Timed out fetching WSI data. Please check your network and try again.'
          : (e?.message || 'Failed to fetch WSI dataset.')

        console.error('[WSI Data] Both R2 and fallback API failed.', fallbackError)
        throw new Error(msg)
      }
    }
  }

  cachedWSIPromise = fetchWithFallback()
    .then(async (res) => {
      if (!res.ok) throw new Error(`Failed to fetch WSI data: ${res.status}`)
      const json = await res.json()
      // Support both array and wrapped formats
      const entries: VirtualSlide[] = Array.isArray(json) ? json : (json.data ?? [])
      console.log(`[WSI Data] ✅ Loaded ${entries.length} WSI slides`)
      return entries
    })

  return cachedWSIPromise
}

export interface UseClientWSIDataResult {
  wsiData: VirtualSlide[] | null
  isLoading: boolean
  error: string | null
  selectRandomWSI: () => VirtualSlide | null
  getWSIByCategory: (category: string) => VirtualSlide[]
  getWSIByDiagnosis: (diagnosis: string) => VirtualSlide[]
}

export function useClientWSIData(): UseClientWSIDataResult {
  const [wsiData, setWSIData] = useState<VirtualSlide[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    // Check if data is already cached
    if (cachedWSIPromise) {
      console.log('[WSI Data] Using cached data promise')
      setIsLoading(true)
      cachedWSIPromise
        .then(data => {
          if (mounted) {
            console.log('[WSI Data] ✅ Loaded from cache:', data.length, 'slides')
            setWSIData(data)
            setError(null)
            setIsLoading(false)
          }
        })
        .catch(err => {
          if (mounted) {
            console.error('[WSI Data] ❌ Cache error:', err)
            setError(err.message || 'Failed to load WSI data')
            setWSIData(null)
            setIsLoading(false)
          }
        })
    } else {
      // Load fresh data
      console.log('[WSI Data] Loading fresh data from R2')
      setIsLoading(true)
      loadClientWSIData()
        .then(data => {
          if (mounted) {
            console.log('[WSI Data] ✅ Fresh load complete:', data.length, 'slides')
            setWSIData(data)
            setError(null)
            setIsLoading(false)
          }
        })
        .catch(err => {
          if (mounted) {
            console.error('[WSI Data] ❌ Fresh load error:', err)
            setError(err.message || 'Failed to load WSI data')
            setWSIData(null)
            setIsLoading(false)
          }
        })
    }

    return () => { mounted = false }
  }, [])

  const selectRandomWSI = (): VirtualSlide | null => {
    if (!wsiData || wsiData.length === 0) return null
    const randomIndex = Math.floor(Math.random() * wsiData.length)
    return wsiData[randomIndex]
  }

  const getWSIByCategory = (category: string): VirtualSlide[] => {
    if (!wsiData) return []
    return wsiData.filter(slide => 
      slide.category.toLowerCase().includes(category.toLowerCase())
    )
  }

  const getWSIByDiagnosis = (diagnosis: string): VirtualSlide[] => {
    if (!wsiData) return []
    return wsiData.filter(slide => 
      slide.diagnosis.toLowerCase().includes(diagnosis.toLowerCase())
    )
  }

  return {
    wsiData,
    isLoading,
    error,
    selectRandomWSI,
    getWSIByCategory,
    getWSIByDiagnosis
  }
}
