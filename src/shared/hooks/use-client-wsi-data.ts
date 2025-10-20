"use client"

import { useEffect, useState } from 'react'
import { VirtualSlide } from '@/shared/types/virtual-slides'

// Module-scope cache so we only fetch once per session
let cachedWSIPromise: Promise<VirtualSlide[]> | null = null

// WSI data URL - using the optimized PathPresenter cases
const WSI_DATA_URL = 'https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/virtual-slides/public_wsi_cases.json'

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

    const res = await fetchWithTimeout(WSI_DATA_URL, {
      cache: 'force-cache',
      headers: {
        'Accept': 'application/json'
      },
      timeoutMs: 8000
    })
    
    if (!res.ok) {
      throw new Error(`Failed to fetch WSI data: ${res.status} ${res.statusText}`)
    }
    
    return res
  }

  cachedWSIPromise = fetchWithFallback()
    .then(async (res) => {
      if (!res.ok) throw new Error(`Failed to fetch WSI data: ${res.status}`)
      const json = await res.json()
      
      // Handle the new PathPresenter cases JSON format
      const pathPresenterCases = json.cases || []
      
      // Convert PathPresenter cases to VirtualSlide format
      const entries: VirtualSlide[] = pathPresenterCases.map((pathCase: any, index: number) => {
        // Generate consistent ID
        const caseId = `pathpresenter_${index + 1}`
        
        // Parse authors - handle both string and array formats
        let authorsArray: string[] = []
        if (pathCase.authors) {
          if (Array.isArray(pathCase.authors)) {
            authorsArray = pathCase.authors
          } else if (typeof pathCase.authors === 'string') {
            authorsArray = [pathCase.authors]
          }
        }
        
        // Extract age and gender from clinical history if available
        const clinicalHistory = pathCase.clinical_history || ''
        const ageMatch = clinicalHistory.match(/(\d+)[-\s]?year[-\s]?old/i)
        const genderMatch = clinicalHistory.match(/\b(male|female|man|woman)\b/i)
        
        return {
          id: caseId,
          repository: 'PathPresenter',
          category: pathCase.chapter || 'Unknown',
          subcategory: pathCase.organ_system || 'Unknown',
          diagnosis: pathCase.diagnosis || 'Unknown diagnosis',
          patient_info: `${pathCase.organ_system || 'Unknown organ'} case from PathPresenter`,
          age: ageMatch ? ageMatch[1] : null,
          gender: genderMatch ? genderMatch[1].toLowerCase() : null,
          clinical_history: clinicalHistory,
          stain_type: 'H&E', // Assume H&E for PathPresenter cases
          image_url: pathCase.url,
          slide_url: pathCase.url,
          case_url: pathCase.url,
          thumbnail_url: '',
          preview_image_url: '',
          magnification: 'Variable',
          organ_system: pathCase.organ_system,
          difficulty_level: 'medium',
          keywords: [],
          other_urls: [],
          source_metadata: {
            pages: pathCase.pages,
            microscopic_features: pathCase.microscopic_features,
            other_prognostic_factors: pathCase.other_prognostic_factors,
            immuno_profile: pathCase.immuno_profile,
            molecular_profile: pathCase.molecular_profile,
            differential_diagnosis: pathCase.differential_diagnosis,
            authors: authorsArray
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      })
      
      // Filter out any entries without valid URLs
      const validEntries = entries.filter(slide => 
        slide.image_url && 
        slide.image_url.startsWith('http') && 
        !slide.image_url.includes('localhost')
      )
      
      console.log(`[WSI Data] ✅ Loaded ${validEntries.length} PathPresenter cases (from ${pathPresenterCases.length} total cases)`)
      
      if (validEntries.length === 0) {
        console.warn('[WSI Data] ⚠️ No valid PathPresenter cases found! This may cause loading issues.')
      }
      
      return validEntries
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
