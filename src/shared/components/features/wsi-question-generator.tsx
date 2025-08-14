'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import {
  Check, X, Loader2, AlertCircle,
  ExternalLink, RefreshCw, Info
} from 'lucide-react'
import { WSIViewer } from '@/shared/components/common/wsi-viewer'


// Import client-side hook for WSI question generation
import { useWSIQuestionGenerator } from '@/shared/hooks/use-wsi-question-generator'
import { dataManager } from '@/shared/utils/client-data-manager'

// Import the canonical VirtualSlide interface
import { VirtualSlide } from '@/shared/types/virtual-slides'

// Client-side WSI interface (from client utilities)
interface ClientVirtualSlide {
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
  image_url?: string
  slide_url?: string
  case_url?: string
  thumbnail_url?: string
  preview_image_url?: string
  magnification?: string
  organ_system?: string
  difficulty_level?: string
  keywords?: string[]
  other_urls?: string[]
  source_metadata?: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

// Function to convert client WSI to canonical format
function normalizeClientWSI(clientWSI: ClientVirtualSlide): VirtualSlide {
  // Ensure we have a valid image URL (prefer slide_url, then case_url, then image_url)
  const imageUrl = clientWSI.slide_url || clientWSI.case_url || clientWSI.image_url || ''
  
  return {
    id: clientWSI.id,
    repository: clientWSI.repository,
    category: clientWSI.category,
    subcategory: clientWSI.subcategory,
    diagnosis: clientWSI.diagnosis,
    patient_info: clientWSI.patient_info,
    age: clientWSI.age,
    gender: clientWSI.gender,
    clinical_history: clientWSI.clinical_history,
    stain_type: clientWSI.stain_type,
    image_url: imageUrl, // Add the image_url field that LLM generation expects
    preview_image_url: clientWSI.preview_image_url || clientWSI.thumbnail_url || '',
    slide_url: clientWSI.slide_url || clientWSI.image_url || '',
    case_url: clientWSI.case_url || clientWSI.slide_url || clientWSI.image_url || '',
    other_urls: clientWSI.other_urls || [],
    source_metadata: clientWSI.source_metadata || {}
  }
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
  // Use the new client-side hook for WSI question generation
  const { generateQuestion, isGenerating, error, clearError } = useWSIQuestionGenerator()
  
  const [currentQuestion, setCurrentQuestion] = useState<GeneratedQuestion | null>(null)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [showExplanation, setShowExplanation] = useState(false)
  const [shouldScrollToTop, setShouldScrollToTop] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState('')
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Load available categories using optimized endpoint
  useEffect(() => {
    if (!showCategoryFilter) return

    const loadCategories = async () => {
      try {
        console.log('[WSI Question Generator] Loading categories via optimized endpoint...')
        const response = await fetch('/api/tools/wsi-question-generator/categories')
        
        if (!response.ok) {
          throw new Error(`Failed to fetch categories: ${response.status}`)
        }
        
        const result = await response.json()
        
        if (result.success && result.categories) {
          setAvailableCategories(result.categories)
          console.log(`[WSI Question Generator] Loaded ${result.categories.length} categories`)
        } else {
          throw new Error('Invalid categories response')
        }
      } catch (error) {
        console.error('Failed to load categories:', error)
        // Note: Error handling for categories loading - could be enhanced with toast notification
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

  // Auto-generate first question on component mount - use ref to prevent infinite loops
  const hasAutoGenerated = useRef(false)

  useEffect(() => {
    if (!hasAutoGenerated.current && !currentQuestion && !isGenerating && !error) {
      hasAutoGenerated.current = true
      generateNewQuestion()
    }
  }, [currentQuestion, isGenerating, error]) // Include dependencies to prevent stale closures

  // Cycle through loading messages while generating
  useEffect(() => {
    if (isGenerating) {
      // Set initial message
      const initialIndex = Math.floor(Math.random() * LOADING_MESSAGES.length)
      setLoadingMessageIndex(initialIndex)
      setCurrentLoadingMessage(LOADING_MESSAGES[initialIndex])

      // Cycle through messages every 4 seconds
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
  }, [isGenerating])

  const generateNewQuestion = async () => {
    // Reset state for new question generation
    setSelectedOption(null)
    setIsAnswered(false)
    setShowExplanation(false)
    clearError()

    try {
      const question = await generateQuestion(selectedCategory === 'all' ? undefined : selectedCategory)
      setCurrentQuestion(question)
      setShouldScrollToTop(true)
    } catch (err) {
      console.error('Error generating question:', err)
      // Error state is managed by the hook
    }
  }

  // Legacy functions removed - using new hook-based approach

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
              <Button onClick={generateNewQuestion} disabled={isGenerating}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isGenerating) {
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
              Generating...
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
                      Preparing your pathology challenge...
                    </p>

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

  // If no question available, show loading state instead of null
  if (!currentQuestion) {
    return (
      <div className={`w-full max-w-4xl mx-auto ${className}`} style={{ minHeight: '600px' }}>
        <Card className="h-full">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm font-medium">Initializing WSI Question Generator...</p>
              <p className="text-xs text-muted-foreground">Preparing your pathology challenge</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
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

          <Button onClick={generateNewQuestion} disabled={isGenerating}>
            {isGenerating ? (
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
                        ? `Context: ${currentQuestion.context.subject} - ${currentQuestion.context.topic}`
                        : 'Context: None'
                    } • {currentQuestion.metadata.generation_time_ms}ms
                    {(currentQuestion.metadata.fallback_attempts || 0) > 1 && (
                      <span className="text-amber-600"> • Backup system used</span>
                    )}
                  </div>

                  {/* Try Another Button */}
                  <div className="flex justify-end">
                    <Button
                      onClick={generateNewQuestion}
                      disabled={isGenerating}
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
