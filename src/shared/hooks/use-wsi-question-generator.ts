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

      // Step 1: Select WSI using simplified approach
      console.log('[WSI Generator] Step 1 - Selecting WSI...')
      let selectedWSI: VirtualSlide

      if (category && category !== 'all') {
        const categorySlides = finalWSIData.filter(slide =>
          slide.category.toLowerCase().includes(category.toLowerCase())
        )
        if (categorySlides.length === 0) {
          throw new Error(`No WSI slides found for category: ${category}`)
        }
        selectedWSI = categorySlides[Math.floor(Math.random() * categorySlides.length)]
      } else {
        const randomIndex = Math.floor(Math.random() * finalWSIData.length)
        selectedWSI = finalWSIData[randomIndex]
        if (!selectedWSI) {
          throw new Error('Failed to select random WSI')
        }
      }

      console.log(`[WSI Generator] Selected WSI - ${selectedWSI.diagnosis}`)

      // Step 2: Skip educational content for simplified approach
      console.log('[WSI Generator] Step 2 - Skipping educational content (simplified mode)...')
      const context = null

      // Step 3: Generate question using client-side generation
      console.log('[WSI Generator] Step 3 - Generating question via fallback API...')
      
      // For now, we still need to call the question generation API since it involves AI
      // But we've eliminated the WSI selection and context search API calls
      const baseUrl = typeof window !== 'undefined' 
        ? window.location.origin 
        : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

      const questionResponse = await fetch(`${baseUrl}/api/tools/wsi-question-generator/generate-question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wsi: selectedWSI,
          context: context
        })
      })

      if (!questionResponse.ok) {
        throw new Error(`Question generation failed: ${questionResponse.status} ${questionResponse.statusText}`)
      }

      const questionData = await questionResponse.json()
      if (!questionData.success || !questionData.question) {
        throw new Error('Failed to generate question')
      }

      console.log('[WSI Generator] Successfully generated question')

      // Combine all data into the expected format
      const generationTime = Date.now() - startTime
      const generatedQuestion: GeneratedQuestion = {
        id: `wsi-${selectedWSI.id}-${Date.now()}`,
        wsi: selectedWSI,
        question: questionData.question,
        context: context,
        metadata: {
          generated_at: new Date().toISOString(),
          model: questionData.metadata?.model || 'unknown',
          generation_time_ms: generationTime,
          image_verification: null // Image verification happens client-side if needed
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

  return {
    generateQuestion,
    isGenerating,
    error,
    clearError,
    isWSIDataLoading: isLoadingWSI,
    isReady: !isLoadingWSI && !wsiError && wsiData && wsiData.length > 0
  }
}

