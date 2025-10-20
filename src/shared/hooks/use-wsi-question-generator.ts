import { useState, useCallback } from 'react'
import { useClientWSIData } from './use-client-wsi-data'
import { VirtualSlide } from '@/shared/types/virtual-slides'
import { getWSIHistoryTracker } from '@/shared/utils/wsi-history-tracker'

interface QuestionData {
  stem: string
  options: Array<{
    id: string
    text: string
    is_correct: boolean
    explanation: string
  }>
  teaching_point: string
  references: string[]
}

interface APIQuestionData {
  stem: string
  question_options: Array<{
    id: string
    text: string
    is_correct: boolean
    explanation: string
  }>
  teaching_point: string
  references: string[]
}

interface GeneratedQuestion {
  id: string
  wsi: VirtualSlide
  question: QuestionData
  context: any | null
  metadata: {
    generated_at: string
    model: string
    generation_time_ms: number
    image_verification?: any
    token_usage?: any
  }
  debug?: any
}

interface UseWSIQuestionGeneratorReturn {
  generateQuestion: (category?: string) => Promise<GeneratedQuestion>
  isGenerating: boolean
  error: string | null
  clearError: () => void
  isWSIDataLoading: boolean
  isReady: boolean
  wsiData: VirtualSlide[] | null
}

/**
 * WSI Question Generator Hook
 * Uses single optimized endpoint for question generation with Meta LLAMA support
 */
export function useWSIQuestionGenerator(): UseWSIQuestionGeneratorReturn {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { wsiData, isLoading: isLoadingWSI, error: wsiError, selectRandomWSI, getWSIByCategory } = useClientWSIData()
  
  console.log('[WSI Hook] Loaded - SINGLE ENDPOINT VERSION - no prepare/parse routes')

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const generateQuestion = useCallback(async (category?: string): Promise<GeneratedQuestion> => {
    const startTime = Date.now()
    setIsGenerating(true)
    setError(null)

    try {
      console.log('[WSI Generator] Starting question generation')

      // Ensure WSI data is available - use direct access to cached promise
      let finalWSIData = wsiData

      if (!finalWSIData || finalWSIData.length === 0) {
        if (wsiError) {
          throw new Error(`WSI data error: ${wsiError}`)
        }

        console.log('[WSI Generator] WSI data not available in hook, accessing cache directly...')

        try {
          // Import and call the loadClientWSIData function directly
          const { loadClientWSIData } = await import('./use-client-wsi-data')
          finalWSIData = await loadClientWSIData()
          console.log('[WSI Generator] ✅ WSI data loaded from cache:', finalWSIData.length, 'slides')
        } catch (cacheError) {
          throw new Error('Failed to load WSI data from cache: ' + (cacheError as Error).message)
        }
      }

      // Check if we have any WSI data at all
      if (!finalWSIData || finalWSIData.length === 0) {
        throw new Error('No WSI slides available. This may be due to repository filtering or data loading issues.')
      }

      // Step 1: Select WSI using simplified approach with history tracking
      console.log(`[WSI Generator] Step 1 - Selecting WSI from ${finalWSIData.length} available slides...`)
      let selectedWSI: VirtualSlide

      // Get history tracker
      const historyTracker = getWSIHistoryTracker()
      const effectiveCategory = category || 'all'
      const recentIds = historyTracker.getRecentIds(effectiveCategory)

      console.log(`[WSI Generator] Recent history size for "${effectiveCategory}": ${recentIds.length} slides`)

      if (category && category !== 'all') {
        // Filter by category first
        let categorySlides = finalWSIData.filter(slide =>
          slide.category.toLowerCase().includes(category.toLowerCase())
        )

        if (categorySlides.length === 0) {
          throw new Error(`No WSI slides found for category: ${category}. Available slides: ${finalWSIData.length}`)
        }

        // Filter out recently shown slides
        let availableSlides = categorySlides.filter(slide => !recentIds.includes(slide.id))

        // If all slides in category have been shown, reset and use all category slides
        if (availableSlides.length === 0) {
          console.log(`[WSI Generator] All ${categorySlides.length} slides in "${category}" have been shown. Resetting history for this category.`)
          historyTracker.clearCategory(effectiveCategory)
          availableSlides = categorySlides
        }

        selectedWSI = availableSlides[Math.floor(Math.random() * availableSlides.length)]
        console.log(`[WSI Generator] Selected from ${availableSlides.length} available slides in category: ${category} (${categorySlides.length} total, ${recentIds.length} recently shown)`)
      } else {
        // Filter out recently shown slides from all slides
        let availableSlides = finalWSIData.filter(slide => !recentIds.includes(slide.id))

        // If all slides have been shown, reset and use all slides
        if (availableSlides.length === 0) {
          console.log(`[WSI Generator] All ${finalWSIData.length} slides have been shown. Resetting history.`)
          historyTracker.clearAll()
          availableSlides = finalWSIData
        }

        const randomIndex = Math.floor(Math.random() * availableSlides.length)
        selectedWSI = availableSlides[randomIndex]

        if (!selectedWSI) {
          throw new Error('Failed to select random WSI')
        }
        console.log(`[WSI Generator] Selected random slide from ${availableSlides.length} available slides (${finalWSIData.length} total, ${recentIds.length} recently shown)`)
      }

      console.log(`[WSI Generator] Selected WSI - ${selectedWSI.diagnosis}`)

      // Step 2: Generate question using main generate route
      console.log('[WSI Generator] Step 2 - Using main generate route...')

      const baseUrl = typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

      // Generate question with fallback support
      console.log('[WSI Generator] Generating question with AI fallback...')
      const questionData = await generateQuestionWithFallback(selectedWSI, 0)

      if (!questionData.success || !questionData.question) {
        throw new Error('Failed to generate question')
      }

      // Log retry information if available
      if (questionData.metadata?.retry_info) {
        const retryInfo = questionData.metadata.retry_info
        if (retryInfo.retries > 0) {
          console.log(`[WSI Generator] ✅ Success after ${retryInfo.retries} retries in ${retryInfo.totalTime}ms`)
        } else {
          console.log(`[WSI Generator] ✅ Success on first attempt in ${retryInfo.totalTime}ms`)
        }
      } else {
        console.log('[WSI Generator] Successfully generated question')
      }

      // Log token usage for debugging
      console.log('[WSI Generator] Token usage from API:', questionData.metadata?.token_usage)

      // Combine all data into the expected format
      const generationTime = Date.now() - startTime

      // Map API response format to hook interface format
      const apiQuestion = questionData.question as APIQuestionData
      const questionWithOptions: QuestionData = {
        ...apiQuestion,
        options: apiQuestion.question_options || []
      }

      const generatedQuestion: GeneratedQuestion = {
        id: `wsi-${selectedWSI.id}-${Date.now()}`,
        wsi: selectedWSI,
        question: questionWithOptions,
        context: null,
        metadata: {
          generated_at: new Date().toISOString(),
          model: questionData.metadata?.model || 'unknown',
          generation_time_ms: generationTime,
          image_verification: null, // Image verification happens client-side if needed
          token_usage: questionData.metadata?.token_usage || null
        },
        debug: questionData.debug
      }

      // Add to history after successful generation
      historyTracker.addToHistory(selectedWSI.id, effectiveCategory)
      console.log(`[WSI Generator] Added ${selectedWSI.id} to history. Stats:`, historyTracker.getStats())

      return generatedQuestion

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      console.error('[WSI Generator] Client-side generation failed:', errorMessage)
      setError(errorMessage)
      throw err
    } finally {
      setIsGenerating(false)
    }
  }, [])


  // Main generation function with model fallback
  const generateQuestionWithFallback = useCallback(async (wsi: any, modelIndex: number): Promise<any> => {
    console.log(`[WSI Generator] Attempting generation with model index: ${modelIndex}`)

    const baseUrl = typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    console.log('[WSI Generator] Using SINGLE /generate endpoint (no multi-step)')
    const response = await fetch(`${baseUrl}/api/public/tools/wsi-question-generator/generate?cb=${Date.now()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        wsi: wsi,
        modelIndex: modelIndex
      })
    })

    if (!response.ok) {
      // Try to get detailed error information for further fallback
      try {
        const errorData = await response.json()
        if (errorData.nextModelIndex !== null) {
          // Recursive fallback to next model
          console.log(`[WSI Generator] Continuing fallback to model: ${errorData.nextModel}`)
          return generateQuestionWithFallback(wsi, errorData.nextModelIndex)
        } else {
          // No more models available
          const errorMsg = errorData.error || `All models exhausted: ${response.status} ${response.statusText}`
          throw new Error(errorMsg)
        }
      } catch (parseError) {
        throw new Error(`Fallback failed: ${response.status} ${response.statusText}`)
      }
    }

    const questionData = await response.json()
    if (!questionData.success || !questionData.question) {
      throw new Error('Fallback question generation failed')
    }

    return questionData
  }, [])

  return {
    generateQuestion,
    isGenerating,
    error,
    clearError,
    isWSIDataLoading: isLoadingWSI,
    isReady: !isLoadingWSI && !wsiError && wsiData !== null,
    wsiData
  }
}

