"use client"

import { useEffect, useMemo, useState, useCallback } from 'react'
import { AnkomaData, AnkomaDeck } from '@/features/anki/types/anki-card'
import { parseAnkomaData } from '@/features/anki/utils/ankoma-parser'
import { ANKOMA_JSON_URL } from '@/shared/config/ankoma'

// Module-scope cache so we only fetch once per session
let cachedAnkomaPromise: Promise<AnkomaData> | null = null

async function loadClientAnkoma(): Promise<AnkomaData> {
  if (cachedAnkomaPromise) return cachedAnkomaPromise

  async function fetchWithFallback() {
    const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit & { timeoutMs?: number }) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), init?.timeoutMs ?? 15000)
      try {
        const res = await fetch(input, { ...init, signal: controller.signal })
        return res
      } finally {
        clearTimeout(timeout)
      }
    }

    try {
      const res = await fetchWithTimeout(ANKOMA_JSON_URL, { cache: 'force-cache', timeoutMs: 15000 })
      if (!res.ok) throw new Error(`Failed: ${res.status}`)
      return res
    } catch (e: any) {
      const msg = e?.name === 'AbortError'
        ? 'Timed out fetching Ankoma data. Please check your network and try again.'
        : (e?.message || 'Failed to fetch Ankoma dataset.')

      // In production, do NOT fall back to Vercel proxy to avoid bandwidth/invocations.
      if (process.env.NODE_ENV === 'production') {
        console.error('[Ankoma] R2 fetch failed in production. Check R2 CORS and network.', e)
        throw new Error(msg)
      }
      // In development, fallback to local API route for easier testing
      console.warn('[Ankoma] R2 fetch failed in dev, falling back to /api/debug/anki-data/ankoma.json')
      return await fetchWithTimeout('/api/debug/anki-data/ankoma.json', { cache: 'force-cache', timeoutMs: 15000 })
    }
  }

  cachedAnkomaPromise = fetchWithFallback()
    .then(async (res) => {
      if (!res.ok) throw new Error(`Failed to fetch Ankoma data: ${res.status}`)
      const rawData: AnkomaDeck = await res.json()
      return parseAnkomaData(rawData)
    })

  return cachedAnkomaPromise
}

export function useClientAnkoma() {
  const [ankomaData, setAnkomaData] = useState<AnkomaData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setIsLoading(true)
    loadClientAnkoma()
      .then(data => { if (mounted) setAnkomaData(data) })
      .catch(err => { if (mounted) setError(err.message || 'Failed to load Ankoma data') })
      .finally(() => { if (mounted) setIsLoading(false) })
    return () => { mounted = false }
  }, [])

  const totalCards = ankomaData?.totalCards || 0
  const sections = ankomaData?.sections || []
  const lastLoaded = ankomaData?.lastLoaded

  return {
    // Data
    ankomaData,
    sections,
    isLoading,
    error,

    // Metadata
    totalCards,
    lastLoaded,
    
    // Cache status
    isDataCached: !!cachedAnkomaPromise
  }
}