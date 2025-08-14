import { useState, useCallback } from 'react'
import { dataManager } from '@/shared/utils/client-data-manager'
import type { VirtualSlide, EducationalContent } from '@/shared/utils/client-data-manager'

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
  context: EducationalContent | null
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
}

/**
 * Client-side WSI question generator - eliminates server-side API calls
 * Uses direct R2 access for all data and moves question generation to browser
 */
export function useWSIQuestionGenerator(): UseWSIQuestionGeneratorReturn {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const generateQuestion = useCallback(async (category?: string): Promise<GeneratedQuestion> => {
    const startTime = Date.now()
    setIsGenerating(true)
    setError(null)

    try {
      console.log('[WSI Generator] Starting client-side generation process')

      // Step 1: Select WSI using client data manager
      console.log('[WSI Generator] Step 1 - Selecting WSI via client data manager...')
      let selectedWSI: VirtualSlide

      if (category && category !== 'all') {
        const searchResults = await dataManager.searchWSIs({
          category,
          limit: 10
        })
        
        if (searchResults.length === 0) {
          throw new Error(`No WSI slides found for category: ${category}`)
        }
        
        // Select random slide from category results
        selectedWSI = searchResults[Math.floor(Math.random() * searchResults.length)]
      } else {
        // Get random WSI sample
        const randomSamples = await dataManager.getRandomWSISample(1)
        if (randomSamples.length === 0) {
          throw new Error('No WSI slides available')
        }
        selectedWSI = randomSamples[0]
      }

      console.log(`[WSI Generator] Selected WSI - ${selectedWSI.diagnosis}`)

      // Step 2: Load relevant educational content using targeted file selection
      console.log('[WSI Generator] Step 2 - Loading educational content...')
      let context: EducationalContent | null = null

      try {
        const targetedFiles = dataManager.getTargetedFiles(
          selectedWSI.category,
          selectedWSI.subcategory,
          selectedWSI.diagnosis
        )

        console.log(`[WSI Generator] Targeting files: ${targetedFiles.join(', ')}`)

        // Load the most relevant content file
        if (targetedFiles.length > 0) {
          const contentFile = targetedFiles[0]
          const contentData = await dataManager.loadContentFile(contentFile)
          
          // Find relevant lesson/topic based on WSI metadata
          if (contentData?.subject?.lessons) {
            const relevantLesson = findRelevantLesson(contentData, selectedWSI)
            if (relevantLesson) {
              context = {
                category: contentData.category,
                subject: contentData.subject.name,
                lesson: relevantLesson.lessonKey,
                topic: relevantLesson.topicKey,
                content: relevantLesson.content
              }
              console.log(`[WSI Generator] Found relevant context: ${relevantLesson.lessonKey}/${relevantLesson.topicKey}`)
            }
          }
        }
      } catch (contextError) {
        console.warn('[WSI Generator] Context loading failed (non-blocking):', contextError)
      }

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
    clearError
  }
}

/**
 * Find the most relevant lesson/topic based on WSI metadata
 */
function findRelevantLesson(contentData: any, wsi: VirtualSlide): {
  lessonKey: string
  topicKey: string
  content: any
} | null {
  if (!contentData?.subject?.lessons) return null

  const searchTerms = [
    wsi.diagnosis.toLowerCase(),
    wsi.subcategory.toLowerCase(),
    wsi.category.toLowerCase(),
    ...((wsi as any).keywords || []).map((k: string) => k.toLowerCase())
  ].filter(Boolean)

  // Find the best matching lesson and topic
  for (const [lessonKey, lesson] of Object.entries(contentData.subject.lessons) as [string, any][]) {
    if (!lesson.topics) continue

    for (const [topicKey, topic] of Object.entries(lesson.topics) as [string, any][]) {
      const topicName = topic.name?.toLowerCase() || ''
      const lessonName = lesson.name?.toLowerCase() || ''
      
      // Check if any search term matches lesson or topic name
      const hasMatch = searchTerms.some(term => 
        topicName.includes(term) || 
        lessonName.includes(term) ||
        term.includes(topicName.split(' ')[0]) ||
        term.includes(lessonName.split(' ')[0])
      )

      if (hasMatch && topic.content) {
        return {
          lessonKey,
          topicKey,
          content: topic.content
        }
      }
    }
  }

  // Fallback: return first available lesson/topic
  const firstLesson = Object.entries(contentData.subject.lessons)[0]
  if (firstLesson) {
    const [lessonKey, lesson] = firstLesson as [string, any]
    const firstTopic = Object.entries(lesson.topics || {})[0]
    if (firstTopic) {
      const [topicKey, topic] = firstTopic as [string, any]
      if (topic.content) {
        return {
          lessonKey,
          topicKey,
          content: topic.content
        }
      }
    }
  }

  return null
}