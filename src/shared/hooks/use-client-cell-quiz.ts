"use client"

import { useEffect, useState, useCallback } from 'react'
import { CELL_QUIZ_IMAGES_URL, CELL_QUIZ_REFERENCES_URL } from '@/shared/config/cell-quiz'
import { transformCellQuizData } from '@/shared/utils/r2-url-transformer'

// Module-scope cache so we only fetch once per session
let cachedImagesPromise: Promise<any> | null = null
let cachedReferencesPromise: Promise<any> | null = null

interface UseCellQuizResult {
  cellData: any | null
  bloodCellsReference: any | null
  isLoading: boolean
  error: string | null
}

async function loadCellQuizImages(): Promise<any> {
  if (cachedImagesPromise) return cachedImagesPromise

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
      const res = await fetchWithTimeout(CELL_QUIZ_IMAGES_URL, { cache: 'force-cache', timeoutMs: 8000 })
      if (!res.ok) throw new Error(`Failed: ${res.status}`)
      return res
    } catch (e: any) {
      const msg = e?.name === 'AbortError'
        ? 'Timed out fetching cell quiz images. Please check your network and try again.'
        : (e?.message || 'Failed to fetch cell quiz images.')

      // In production, do NOT fall back to Vercel proxy to avoid bandwidth/invocations.
      if (process.env.NODE_ENV === 'production') {
        console.error('[CellQuiz] R2 fetch failed in production. Check R2 CORS and network.', e)
        throw new Error(msg)
      }
      // In development, fallback to local proxy to ease testing when R2 CORS is not configured.
      console.warn('[CellQuiz] R2 fetch failed in dev, falling back to /api/tools/cell-quiz/images')
      return await fetchWithTimeout('/api/tools/cell-quiz/images', { cache: 'force-cache', timeoutMs: 8000 })
    }
  }

  cachedImagesPromise = fetchWithFallback()
    .then(async (res) => {
      if (!res.ok) throw new Error(`Failed to fetch cell quiz images: ${res.status}`)
      const data = await res.json()
      // Transform URLs to use R2 public URLs on client-side
      return transformCellQuizData(data)
    })

  return cachedImagesPromise
}

async function loadCellQuizReferences(): Promise<any> {
  if (cachedReferencesPromise) return cachedReferencesPromise

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
      const res = await fetchWithTimeout(CELL_QUIZ_REFERENCES_URL, { cache: 'force-cache', timeoutMs: 8000 })
      if (!res.ok) throw new Error(`Failed: ${res.status}`)
      return res
    } catch (e: any) {
      const msg = e?.name === 'AbortError'
        ? 'Timed out fetching cell quiz references. Please check your network and try again.'
        : (e?.message || 'Failed to fetch cell quiz references.')

      // In production, do NOT fall back to Vercel proxy to avoid bandwidth/invocations.
      if (process.env.NODE_ENV === 'production') {
        console.error('[CellQuiz] R2 fetch failed in production. Check R2 CORS and network.', e)
        throw new Error(msg)
      }
      // In development, fallback to local proxy to ease testing when R2 CORS is not configured.
      console.warn('[CellQuiz] R2 fetch failed in dev, falling back to /api/tools/cell-quiz/references')
      return await fetchWithTimeout('/api/tools/cell-quiz/references', { cache: 'force-cache', timeoutMs: 8000 })
    }
  }

  cachedReferencesPromise = fetchWithFallback()
    .then(async (res) => {
      if (!res.ok) throw new Error(`Failed to fetch cell quiz references: ${res.status}`)
      return await res.json()
    })

  return cachedReferencesPromise
}

export function useClientCellQuiz(): UseCellQuizResult {
  const [cellData, setCellData] = useState<any | null>(null)
  const [bloodCellsReference, setBloodCellsReference] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    
    async function loadData() {
      try {
        setIsLoading(true)
        setError(null)
        
        console.log('🔄 Loading cell quiz data from R2...')
        
        // Load both datasets in parallel
        const [imagesData, referencesData] = await Promise.all([
          loadCellQuizImages(),
          loadCellQuizReferences()
        ])
        
        if (mounted) {
          setCellData(imagesData)
          setBloodCellsReference(referencesData)
          
          console.log('✅ Cell quiz data loaded successfully:', {
            images: {
              cellCount: imagesData ? Object.keys(imagesData).length : 0,
              sampleCells: imagesData ? Object.keys(imagesData).slice(0, 3) : [],
              dataSize: imagesData ? `${(JSON.stringify(imagesData).length / 1024).toFixed(1)}KB` : '0KB'
            },
            references: {
              hasCells: !!referencesData?.cells,
              cellCount: referencesData?.cells?.length || 0,
              dataSize: referencesData ? `${(JSON.stringify(referencesData).length / 1024).toFixed(1)}KB` : '0KB'
            }
          })
        }
      } catch (err: any) {
        console.error('❌ Failed to load cell quiz data:', err)
        if (mounted) {
          setError(err.message || 'Failed to load cell quiz data')
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }
    
    loadData()
    return () => { mounted = false }
  }, [])

  return {
    cellData,
    bloodCellsReference,
    isLoading,
    error
  }
}