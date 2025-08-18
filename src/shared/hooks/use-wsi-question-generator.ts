import { useState, useCallback } from 'react'
import { useClientWSIData } from './use-client-wsi-data'
import { VirtualSlide } from '@/shared/types/virtual-slides'

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
 * Client-side WSI question generator - eliminates server-side API calls
 * Uses direct R2 access for all data and moves question generation to browser
 */
export function useWSIQuestionGenerator(): UseWSIQuestionGeneratorReturn {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { wsiData, isLoading: isLoadingWSI, error: wsiError, selectRandomWSI, getWSIByCategory } = useClientWSIData()

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const generateQuestion = useCallback(async (category?: string): Promise<GeneratedQuestion> => {
    const startTime = Date.now()
    setIsGenerating(true)
    setError(null)

    try {
      console.log('[WSI Generator] Starting client-side generation process')

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

      // Step 1: Select WSI using simplified approach
      console.log(`[WSI Generator] Step 1 - Selecting WSI from ${finalWSIData.length} available slides...`)
      let selectedWSI: VirtualSlide

      if (category && category !== 'all') {
        const categorySlides = finalWSIData.filter(slide =>
          slide.category.toLowerCase().includes(category.toLowerCase())
        )
        if (categorySlides.length === 0) {
          throw new Error(`No WSI slides found for category: ${category}. Available slides: ${finalWSIData.length}`)
        }
        selectedWSI = categorySlides[Math.floor(Math.random() * categorySlides.length)]
        console.log(`[WSI Generator] Selected from ${categorySlides.length} slides in category: ${category}`)
      } else {
        const randomIndex = Math.floor(Math.random() * finalWSIData.length)
        selectedWSI = finalWSIData[randomIndex]
        if (!selectedWSI) {
          throw new Error('Failed to select random WSI')
        }
        console.log(`[WSI Generator] Selected random slide (index ${randomIndex} of ${finalWSIData.length})`)
      }

      console.log(`[WSI Generator] Selected WSI - ${selectedWSI.diagnosis}`)

      // Step 2: Generate question using simplified approach (no context needed)
      console.log('[WSI Generator] Step 2 - Generating question using simplified approach...')
      console.log('[WSI Generator] Step 3 - Generating question via fallback API...')
      
      // For now, we still need to call the question generation API since it involves AI
      // But we've eliminated the WSI selection and context search API calls
      const baseUrl = typeof window !== 'undefined' 
        ? window.location.origin 
        : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

      const questionResponse = await fetch(`${baseUrl}/api/tools/wsi-question-generator/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wsi: selectedWSI
        })
      })

      if (!questionResponse.ok) {
        // Try to get detailed error information
        try {
          const errorData = await questionResponse.json()
          if (errorData.nextModelIndex !== null) {
            // There's a fallback model available, try it
            console.log(`[WSI Generator] Trying fallback model: ${errorData.nextModel}`)
            return generateQuestionWithFallback(selectedWSI, errorData.nextModelIndex)
          } else {
            // No more models available
            const errorMsg = errorData.error || `Question generation failed: ${questionResponse.status} ${questionResponse.statusText}`
            throw new Error(errorMsg)
          }
        } catch (parseError) {
          throw new Error(`Question generation failed: ${questionResponse.status} ${questionResponse.statusText}`)
        }
      }

      const questionData = await questionResponse.json()
      console.log('[WSI Generator Hook] Full API response:', questionData)
      console.log('[WSI Generator Hook] Token usage in response:', questionData.metadata?.token_usage)
      
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
      const generatedQuestion: GeneratedQuestion = {
        id: `wsi-${selectedWSI.id}-${Date.now()}`,
        wsi: selectedWSI,
        question: questionData.question,
        context: null,
        metadata: {
          generated_at: new Date().toISOString(),
          model: questionData.metadata?.model || 'unknown',
          generation_time_ms: generationTime,
          image_verification: null, // Image verification happens client-side if needed
          token_usage: questionData.metadata?.token_usage || null,
          successful_model: questionData.metadata?.model,
          fallback_attempts: questionData.metadata?.modelIndex ? questionData.metadata.modelIndex + 1 : 1
        },
        debug: questionData.debug
      }

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

  // Helper function to handle model fallback
  const generateQuestionWithFallback = useCallback(async (wsi: any, modelIndex: number): Promise<any> => {
    console.log(`[WSI Generator] Attempting fallback with model index: ${modelIndex}`)

    const fallbackResponse = await fetch('/api/tools/wsi-question-generator/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        wsi: wsi,
        modelIndex: modelIndex
      })
    })

    if (!fallbackResponse.ok) {
      // Try to get detailed error information for further fallback
      try {
        const errorData = await fallbackResponse.json()
        if (errorData.nextModelIndex !== null) {
          // Recursive fallback to next model
          console.log(`[WSI Generator] Continuing fallback to model: ${errorData.nextModel}`)
          return generateQuestionWithFallback(wsi, errorData.nextModelIndex)
        } else {
          // No more models available
          const errorMsg = errorData.error || `All models exhausted: ${fallbackResponse.status} ${fallbackResponse.statusText}`
          throw new Error(errorMsg)
        }
      } catch (parseError) {
        throw new Error(`Fallback failed: ${fallbackResponse.status} ${fallbackResponse.statusText}`)
      }
    }

    const questionData = await fallbackResponse.json()
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

