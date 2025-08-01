'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import {
  Check, X, Loader2, Brain, Microscope, AlertCircle,
  ExternalLink, RefreshCw, Info
} from 'lucide-react'
import { WSIViewer } from '@/shared/components/common/wsi-viewer'

// Types
interface VirtualSlide {
  id: string
  repository: string
  category: string
  subcategory: string
  diagnosis: string
  patient_info: string
  age: string | null
  gender: string | null
  clinical_history: string
  stain_type: string
  preview_image_url: string
  slide_url: string
  case_url: string
  other_urls: string[]
  source_metadata: Record<string, unknown>
}

interface QuestionOption {
  id: string
  text: string
  is_correct: boolean
  explanation: string
}

interface QuestionData {
  stem: string
  options: QuestionOption[]
  references: string[]
}

interface GeneratedQuestion {
  id: string
  wsi: VirtualSlide
  question: QuestionData
  context: any
  metadata: {
    generated_at: string
    model: string
    generation_time_ms: number
    modelIndex?: number
    image_verification?: any
    fallback_attempts?: number
    successful_model?: string
    token_usage?: {
      prompt_tokens: number
      completion_tokens: number
      total_tokens: number
    }
  }
  debug?: {
    prompt: string
    instructions: string
  }
}

// Embeddable repositories only (no Leeds, Toronto, Recut Club)
const EMBEDDABLE_REPOSITORIES = [
  'Hematopathology eTutorial',
  'Rosai Collection',
  'PathPresenter',
  'MGH Pathology'
]

// WSI Question Generator fallback model names for display
const WSI_FALLBACK_MODEL_NAMES = [
  'Gemini 2.0 Flash',       // gemini-2.0-flash
  'Gemini 2.0 Flash Lite',  // gemini-2.0-flash-lite
  'Gemini 2.5 Flash Lite',  // gemini-2.5-flash-lite
  'LLAMA 3.3 8B',           // Llama-3.3-8B-Instruct
  'LLAMA 4 Maverick',       // Llama-4-Maverick-17B-128E-Instruct-FP8
  'Mistral Small 3.1',      // mistral-small-2503
  'Ministral 8B',           // ministral-8b-2410
  'Gemini 1.5 Flash 8B',    // gemini-1.5-flash-8b
  'Mistral Small 3.2',      // mistral-small-2506
  'Ministral 3B',           // ministral-8b-2410
]

// Funny loading messages for question generation
const LOADING_MESSAGES = [
  "Teaching AI the difference between normal and 'definitely not normal'...",
  "Consulting with virtual pathologists (they work for free)...",
  "Spinning the wheel of diagnostic confusion...",
  "Asking the slide what it wants to be when it grows up...",
  "Calibrating the microscope of artificial intelligence...",
  "Bribing the AI with virtual coffee for better questions...",
  "Translating 'pink and purple stuff' into medical terminology...",
  "Convincing the algorithm that everything isn't cancer...",
  "Teaching the computer to spot the needle in the histologic haystack...",
  "Generating questions that would make your attending proud...",
  "Channeling the spirit of Rudolf Virchow...",
  "Asking 'What would House MD diagnose?' (then ignoring the answer)...",
  "Consulting the ancient texts of Robbins and Cotran...",
  "Performing digital differential diagnosis dance...",
  "Summoning the ghost of pathology past...",
  "Teaching AI that 'it's probably fine' isn't a diagnosis...",
  "Convincing the computer that zebras do exist in pathology...",
  "Generating questions harder than your board exams...",
  "Asking the slide to reveal its deepest, darkest secrets...",
  "Calibrating the sarcasm detector for pathology humor...",
  "Teaching AI the fine art of 'consistent with'...",
  "Consulting with Dr. Google (but better)...",
  "Generating questions that won't make you cry... much...",
  "Teaching the algorithm about Wilson's disease (it's always Wilson's)...",
  "Asking 'Is it lupus?' (spoiler: it's never lupus in pathology)...",
  "Convincing AI that 'reactive changes' is a real diagnosis...",
  "Teaching the computer to appreciate the beauty of mitotic figures...",
  "Generating questions with just the right amount of existential dread...",
  "Consulting the pathology oracle (results may vary)...",
  "Teaching AI that 'atypical' means 'I have no idea'..."
]

interface WSIQuestionGeneratorProps {
  className?: string
  showCategoryFilter?: boolean
  compact?: boolean
}

export function WSIQuestionGenerator({
  className = '',
  showCategoryFilter = true,
  compact = false
}: WSIQuestionGeneratorProps) {
  const [currentQuestion, setCurrentQuestion] = useState<GeneratedQuestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [showExplanation, setShowExplanation] = useState(false)
  const [shouldScrollToTop, setShouldScrollToTop] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState('')
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
  const [currentModelIndex, setCurrentModelIndex] = useState(0)
  const [modelAttempts, setModelAttempts] = useState<string[]>([])
  const [fallbackInProgress, setFallbackInProgress] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Load available categories from virtual slides
  useEffect(() => {
    if (!showCategoryFilter) return
    
    const loadCategories = async () => {
      try {
        const response = await fetch('/data/virtual-slides.json')
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const slides = await response.json()
        
        // Filter to embeddable repositories only
        const embeddableSlides = slides.filter((slide: VirtualSlide) => 
          EMBEDDABLE_REPOSITORIES.includes(slide.repository)
        )

        const uniqueCategories = [...new Set(embeddableSlides.map((slide: VirtualSlide) => slide.category))]
          .filter(Boolean) as string[]

        setAvailableCategories(uniqueCategories)
      } catch (error) {
        console.error('Failed to load categories:', error)
        setError('Failed to load slide categories')
      }
    }

    loadCategories()
  }, [showCategoryFilter])

  // Auto-scroll to top when new question is generated
  useEffect(() => {
    if (shouldScrollToTop && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setShouldScrollToTop(false)
    }
  }, [shouldScrollToTop])

  // Auto-generate first question on component mount
  useEffect(() => {
    if (!currentQuestion && !loading) {
      generateNewQuestion()
    }
  }, [])

  // Cycle through loading messages while generating
  useEffect(() => {
    if (loading) {
      // Set initial message
      const initialIndex = Math.floor(Math.random() * LOADING_MESSAGES.length)
      setLoadingMessageIndex(initialIndex)
      setCurrentLoadingMessage(LOADING_MESSAGES[initialIndex])

      // Cycle through messages every 2.5 seconds
      loadingIntervalRef.current = setInterval(() => {
        setLoadingMessageIndex(prev => {
          const nextIndex = (prev + 1) % LOADING_MESSAGES.length
          setCurrentLoadingMessage(LOADING_MESSAGES[nextIndex])
          return nextIndex
        })
      }, 4000)
    } else {
      // Clear interval when not loading
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current)
        loadingIntervalRef.current = null
      }
    }

    // Cleanup on unmount
    return () => {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current)
      }
    }
  }, [loading])

  const generateNewQuestion = async () => {
    // Reset state for new question generation
    setLoading(true)
    setLoadingStep('Preparing question...')
    setError(null)
    setSelectedOption(null)
    setIsAnswered(false)
    setShowExplanation(false)
    setCurrentModelIndex(0)
    setModelAttempts([])
    setFallbackInProgress(false)

    try {
      await generateQuestionWithFallback()
    } catch (err) {
      console.error('Error generating question:', err)
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to generate question. Please try again.')
      }
    } finally {
      setLoading(false)
      setFallbackInProgress(false)
    }
  }

  const generateQuestionWithFallback = async (modelIndex: number = 0) => {
    console.log('WSI Question Generator: Starting multi-step generation process')

    // Step 1: Select WSI
    console.log('WSI Question Generator: Step 1 - Selecting WSI...')
    setLoadingStep('Preparing question...')
    const wsiUrl = selectedCategory && selectedCategory !== 'all'
      ? `/api/tools/wsi-question-generator/select-wsi?category=${encodeURIComponent(selectedCategory)}`
      : '/api/tools/wsi-question-generator/select-wsi'

    const wsiResponse = await fetch(wsiUrl, {
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (!wsiResponse.ok) {
      throw new Error(`WSI Selection failed: ${wsiResponse.status} ${wsiResponse.statusText}`)
    }

    const wsiData = await wsiResponse.json()
    if (!wsiData.success || !wsiData.wsi) {
      throw new Error('Failed to select WSI')
    }

    const selectedWSI = wsiData.wsi
    console.log(`WSI Question Generator: Selected WSI - ${selectedWSI.diagnosis}`)

    // Step 2: Find context
    console.log('WSI Question Generator: Step 2 - Finding context...')
    setLoadingStep('Gathering information...')
    const contextResponse = await fetch('/api/tools/wsi-question-generator/find-context', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        diagnosis: selectedWSI.diagnosis,
        category: selectedWSI.category
      })
    })

    if (!contextResponse.ok) {
      throw new Error(`Context search failed: ${contextResponse.status} ${contextResponse.statusText}`)
    }

    const contextData = await contextResponse.json()
    if (!contextData.success) {
      throw new Error('Failed to find context')
    }

    const context = contextData.context
    console.log(`WSI Question Generator: Context found - ${!!context}`)

    // Step 3: Verify image accessibility (optional, non-blocking)
    console.log('WSI Question Generator: Step 3 - Verifying image accessibility...')
    setLoadingStep('Finalizing setup...')
    let imageVerification = null
    try {
      const imageResponse = await fetch('/api/tools/wsi-question-generator/verify-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: selectedWSI.slide_url || selectedWSI.case_url,
          thumbnailUrl: selectedWSI.preview_image_url
        })
      })

      if (imageResponse.ok) {
        const imageData = await imageResponse.json()
        if (imageData.success) {
          imageVerification = imageData
          console.log(`WSI Question Generator: Image accessible - ${imageData.image.accessible}`)
        }
      }
    } catch (imageError) {
      console.warn('WSI Question Generator: Image verification failed (non-blocking):', imageError)
    }

    // Step 4: Generate question with fallback system
    await generateQuestionWithModelFallback(selectedWSI, context, imageVerification, wsiData, contextData, modelIndex)
  }

  const generateQuestionWithModelFallback = async (
    selectedWSI: VirtualSlide,
    context: any,
    imageVerification: any,
    wsiData: any,
    contextData: any,
    modelIndex: number = 0,
    recursionDepth: number = 0
  ) => {
    // Prevent infinite recursion
    if (recursionDepth > WSI_FALLBACK_MODEL_NAMES.length) {
      throw new Error('Maximum recursion depth exceeded. Please try again later.')
    }
    
    if (modelIndex >= WSI_FALLBACK_MODEL_NAMES.length) {
      throw new Error('All fallback models have been exhausted. Please try again later.')
    }

    const currentModelName = WSI_FALLBACK_MODEL_NAMES[modelIndex]
    setCurrentModelIndex(modelIndex)
    setModelAttempts(prev => [...prev, currentModelName])

    if (modelIndex > 0) {
      setFallbackInProgress(true)
      setLoadingStep('Trying alternative approach...')
    } else {
      setLoadingStep('Generating question...')
    }

    console.log(`WSI Question Generator: Step 4 - Generating question with model ${modelIndex + 1}/${WSI_FALLBACK_MODEL_NAMES.length}: ${currentModelName}`)

    try {
      const questionResponse = await fetch('/api/tools/wsi-question-generator/generate-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wsi: selectedWSI,
          context: context,
          modelIndex: modelIndex
        })
      })

      const questionData = await questionResponse.json()

      if (!questionResponse.ok) {
        // Check if we should try the next model
        const nextIndex = questionData.nextModelIndex
        if (nextIndex !== null && nextIndex !== undefined && nextIndex > modelIndex && nextIndex < WSI_FALLBACK_MODEL_NAMES.length) {
          console.warn(`WSI Question Generator: Model ${currentModelName} failed, trying next model (index ${nextIndex})...`)
          // Recursively try the next model
          return await generateQuestionWithModelFallback(
            selectedWSI,
            context,
            imageVerification,
            wsiData,
            contextData,
            nextIndex,
            recursionDepth + 1
          )
        } else {
          throw new Error(questionData.error || `Question generation failed: ${questionResponse.status} ${questionResponse.statusText}`)
        }
      }

      if (!questionData.success || !questionData.question) {
        throw new Error('Failed to generate question')
      }

      console.log(`WSI Question Generator: Successfully generated question with ${currentModelName}`)

      // Combine all data into the expected format
      const generatedQuestion = {
        id: `wsi-${selectedWSI.id}-${Date.now()}`,
        wsi: selectedWSI,
        question: questionData.question,
        context: context,
        metadata: {
          generated_at: new Date().toISOString(),
          model: questionData.metadata?.model || currentModelName,
          modelIndex: questionData.metadata?.modelIndex || modelIndex,
          generation_time_ms: (wsiData.metadata?.selection_time_ms || 0) +
                              (contextData.metadata?.search_time_ms || 0) +
                              (questionData.metadata?.generation_time_ms || 0),
          image_verification: imageVerification,
          fallback_attempts: modelAttempts.length,
          successful_model: currentModelName,
          token_usage: questionData.metadata?.token_usage
        },
        debug: questionData.debug
      }

      setCurrentQuestion(generatedQuestion)
      setShouldScrollToTop(true)

    } catch (modelError) {
      console.error(`WSI Question Generator: Model ${currentModelName} failed:`, modelError)

      // Try the next model if available
      const nextModelIndex = modelIndex + 1
      if (nextModelIndex < WSI_FALLBACK_MODEL_NAMES.length) {
        console.log(`WSI Question Generator: Trying fallback model ${nextModelIndex + 1}/${WSI_FALLBACK_MODEL_NAMES.length}`)
        return await generateQuestionWithModelFallback(
          selectedWSI,
          context,
          imageVerification,
          wsiData,
          contextData,
          nextModelIndex,
          recursionDepth + 1
        )
      } else {
        throw new Error(`All ${WSI_FALLBACK_MODEL_NAMES.length} fallback models failed. Please try again later.`)
      }
    }
  }

  const handleOptionClick = (optionId: string) => {
    if (!isAnswered) {
      setSelectedOption(optionId)
      setIsAnswered(true)
      // Short delay before showing explanation for animation
      setTimeout(() => setShowExplanation(true), 300)
    }
  }



  const getOptionLabel = (id: string, index: number) => {
    return id || String.fromCharCode(65 + index) // A, B, C, D, E
  }

  if (error) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Card className="w-full">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
              <div className="space-y-2">
                <p className="font-medium text-destructive">Error Loading Question</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button onClick={generateNewQuestion} disabled={loading}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`w-full max-w-4xl mx-auto ${className}`} style={{ minHeight: '600px' }}>
        {/* Category Filter */}
        {showCategoryFilter && availableCategories.length > 0 && (
          <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Category:</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {availableCategories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {loadingStep || "Generating..."}
            </Button>
          </div>
        )}

        <Card className="h-full animate-pulse">
          <CardContent className="space-y-4 pt-6">
            {/* Question text skeleton */}
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded-lg w-3/4" />
              <div className="h-4 bg-muted rounded-lg w-full" />
              <div className="h-4 bg-muted rounded-lg w-5/6" />
              <div className="h-4 bg-muted rounded-lg w-2/3" />
            </div>

            {/* Metadata skeleton */}
            <div className="h-4 bg-muted rounded-lg w-full max-w-md" />

            {/* WSI viewer skeleton */}
            <div className="relative w-full border rounded-lg" style={{ aspectRatio: '16/10' }}>
              <div className="absolute inset-0 bg-muted rounded-lg w-full h-full flex items-center justify-center">
                <div className="text-center space-y-3 max-w-md px-4">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Generating WSI Question...</p>
                    <p className="text-xs text-primary font-medium">
                      {loadingStep || "Preparing your pathology challenge..."}
                    </p>

                    {/* Simplified fallback progress */}
                    {fallbackInProgress && modelAttempts.length > 1 && (
                      <div className="space-y-1">
                        <p className="text-xs text-amber-600 font-medium">
                          Trying alternative approach (attempt {currentModelIndex + 1})
                        </p>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground italic leading-relaxed min-h-[2.5rem] flex items-center justify-center transition-opacity duration-500">
                      {currentLoadingMessage || "Teaching AI the difference between normal and 'definitely not normal'..."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Options skeleton */}
            <div className="grid gap-2 pt-2">
              {[...Array(5)].map((_, index) => (
                <div
                  key={index}
                  className="p-2 rounded-md border border-muted flex items-center gap-2"
                >
                  <div className="w-5 h-5 rounded-full bg-muted shrink-0" />
                  <div className="h-4 bg-muted rounded w-3/4 grow" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // If no question and not loading, auto-generate
  if (!currentQuestion && !loading) {
    // This will trigger the useEffect to generate a question
    return null
  }

  // If no question available, show loading (this shouldn't happen with auto-generation)
  if (!currentQuestion) {
    return null
  }

  return (
    <div ref={containerRef} className={`w-full max-w-4xl mx-auto ${className}`} style={{ minHeight: '600px' }}>
      {/* Top Controls */}
      <div className="mb-6 space-y-4">
        {/* Category Filter and Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            {showCategoryFilter && availableCategories.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Category:</label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {availableCategories.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* WSI Metadata */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">{currentQuestion.wsi.repository}</Badge>
              <span>•</span>
              <a
                href={currentQuestion.wsi.slide_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700 transition-colors flex items-center gap-1"
              >
                View Original Slide
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <Button onClick={generateNewQuestion} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            New Question
          </Button>
        </div>

        {/* Warning Disclaimer */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <Info className="h-4 w-4 flex-shrink-0" />
            <span>AI-generated content without human oversight. May contain incorrect information.</span>
          </div>
        </div>
      </div>

      <Card className="h-full">
        <CardContent className="space-y-4 pt-6">
          {/* Question Text */}
          <div className="text-sm text-foreground/90">
            {currentQuestion.question.stem}
          </div>

          {/* WSI Viewer */}
          <div className="w-full">
            <WSIViewer slide={currentQuestion.wsi} showMetadata={false} />

            {/* WSI Disclaimer */}
            <div className="mt-2 text-xs text-muted-foreground text-center">
              <span>Virtual slide provided by {currentQuestion.wsi.repository}. All credits belong to the original authors.</span>
            </div>
          </div>

          {/* Answer Options */}
          <div className="grid gap-2" role="listbox" aria-label="Answer options">
            {currentQuestion.question.options.map((option, index) => {
              const isSelected = selectedOption === option.id
              const showCorrect = isAnswered && option.is_correct
              const showIncorrect = isAnswered && isSelected && !option.is_correct
              const optionLabel = getOptionLabel(option.id, index)

              return (
                <button
                  key={option.id}
                  onClick={() => handleOptionClick(option.id)}
                  className={`
                    p-2 rounded-md text-left border text-sm transition-colors duration-200
                    ${!isAnswered ? 'hover:border-primary/50 hover:bg-primary/5' : ''}
                    ${isSelected ? 'border-primary' : 'border'}
                    ${showCorrect ? 'bg-green-50 border-green-500 dark:bg-green-950/30' : ''}
                    ${showIncorrect ? 'bg-red-50 border-red-500 dark:bg-red-950/30' : ''}
                  `}
                  disabled={isAnswered}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="flex items-center gap-2">
                    <span className={`
                      flex items-center justify-center w-5 h-5 rounded-full border text-xs
                      ${isSelected ? 'border-primary' : 'border-muted-foreground/30'}
                      ${showCorrect ? 'border-green-500' : ''}
                      ${showIncorrect ? 'border-red-500' : ''}
                    `}>
                      {optionLabel}
                    </span>
                    <span className="flex-1">{option.text}</span>
                    {showCorrect && <Check className="w-4 h-4 text-green-500" />}
                    {showIncorrect && <X className="w-4 h-4 text-red-500" />}
                  </div>
                </button>
              )
            })}
          </div>



          {/* Answer Explanations */}
          {isAnswered && (
            <div className={`transform transition-all duration-500 ${
              showExplanation ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}>
              <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-4">
                {/* Teaching Point */}
                <div>
                  <h4 className="font-medium text-xs uppercase mb-1">Teaching Point</h4>
                  <div className="text-muted-foreground">
                    {currentQuestion.question.options.find(option => option.is_correct)?.explanation || 'No explanation available.'}
                  </div>
                </div>

                {/* Option Explanations */}
                {currentQuestion.question.options.some(opt => opt.explanation) && (
                  <div>
                    <h4 className="font-medium text-xs uppercase mb-1">Answer Explanations</h4>
                    <div className="space-y-2 text-muted-foreground">
                      {currentQuestion.question.options
                        .filter(option => option.explanation && !option.is_correct)
                        .map((option) => {
                          const optionIndex = currentQuestion.question.options.findIndex(opt => opt.id === option.id)
                          const optionLabel = getOptionLabel(option.id, optionIndex)

                          return (
                            <div key={option.id}>
                              <span className="font-medium">{optionLabel}.</span> {option.explanation}
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}

                {/* AI Disclaimer */}
                <div className="pt-2 border-t">
                  <div className="flex items-start gap-2 text-xs text-amber-700">
                    <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>AI-generated content. May contain inaccuracies. Verify with authoritative sources.</span>
                  </div>
                </div>

                {/* Generation Metadata - Single Line */}
                <div className="pt-2 border-t">
                  <div className="text-xs text-muted-foreground text-center mb-3">
                    {currentQuestion.metadata.successful_model || currentQuestion.metadata.model} • {
                      currentQuestion.metadata.token_usage
                        ? `${currentQuestion.metadata.token_usage.total_tokens} tokens`
                        : 'Tokens: N/A'
                    } • {
                      currentQuestion.context
                        ? 'Context: Yes'
                        : 'Context: No'
                    } • {currentQuestion.metadata.generation_time_ms}ms
                    {(currentQuestion.metadata.fallback_attempts || 0) > 1 && (
                      <span className="text-amber-600"> • Backup system used</span>
                    )}
                  </div>

                  {/* Try Another Button */}
                  <div className="flex justify-end">
                    <Button
                      onClick={generateNewQuestion}
                      disabled={loading}
                      variant="outline"
                      size="sm"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Try Another
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
