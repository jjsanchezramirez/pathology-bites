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
  const { generateQuestion, isGenerating, error, clearError, isWSIDataLoading, isReady } = useWSIQuestionGenerator()

  const [currentQuestion, setCurrentQuestion] = useState<GeneratedQuestion | null>(null)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [showExplanation, setShowExplanation] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState('')
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Extract categories directly from client-side WSI data (like virtual slides page)
  const { wsiData } = useWSIQuestionGenerator()
  
  useEffect(() => {
    if (!showCategoryFilter || !wsiData) return

    
    // Extract unique categories from loaded WSI data
    const categories = Array.from(new Set(
      wsiData.map((slide: any) => (slide.category || '').toString().trim())
    ))
      .filter((val: string) => val.length > 0)
      .sort()

    setAvailableCategories(categories)
  }, [showCategoryFilter, wsiData])

  // Auto-generate first question on component mount - use ref to prevent infinite loops
  const hasAutoGenerated = useRef(false)

  useEffect(() => {
    // Only auto-generate if:
    // 1. We haven't auto-generated yet
    // 2. No current question exists
    // 3. Not currently generating
    // 4. No error state
    // 5. WSI data is ready (not loading and has data)
    if (!hasAutoGenerated.current && !currentQuestion && !isGenerating && !error && isReady && !isWSIDataLoading) {
      hasAutoGenerated.current = true
      generateNewQuestion()
    }
  }, [currentQuestion, isGenerating, error, isReady, isWSIDataLoading]) // Include all dependencies

  // Cycle through loading messages while generating
  useEffect(() => {
    if (isGenerating) {
      // Set initial message
      const initialIndex = Math.floor(Math.random() * LOADING_MESSAGES.length)
      setLoadingMessageIndex(initialIndex)
      setCurrentLoadingMessage(LOADING_MESSAGES[initialIndex])

      // Cycle through messages every 2 seconds for better visibility
      loadingIntervalRef.current = setInterval(() => {
        setLoadingMessageIndex(prev => {
          const nextIndex = (prev + 1) % LOADING_MESSAGES.length
          setCurrentLoadingMessage(LOADING_MESSAGES[nextIndex])
          return nextIndex
        })
      }, 2000)
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
    // Scroll to the main content section (bottom of hero) immediately when button is clicked
    const contentSection = document.getElementById('wsi-content')
    if (contentSection) {
      contentSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    // Reset state for new question generation
    setSelectedOption(null)
    setIsAnswered(false)
    setShowExplanation(false)
    clearError()

    try {
      const question = await generateQuestion(selectedCategory === 'all' ? undefined : selectedCategory)

      // Ensure the WSI has the repository field (in case the API response doesn't include it)
      if (question.wsi) {
        question.wsi = ensureWSIRepository(question.wsi)
      }

      setCurrentQuestion(question)
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

  // Helper function to ensure WSI has repository field
  const getRepositoryFromId = (id: string): string => {
    const prefix = id.split('_')[0]
    const repoMap: Record<string, string> = {
      'mgh': 'MGH Pathology',
      'hemepath': 'Hematopathology eTutorial',
      'rosai': 'Rosai Collection',
      'pathpresenter': 'PathPresenter'
    }
    return repoMap[prefix] || prefix
  }

  // Ensure WSI object has repository field
  const ensureWSIRepository = (wsi: any) => {
    if (!wsi.repository && wsi.id) {
      wsi.repository = getRepositoryFromId(wsi.id)
    }
    return wsi
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

  if (isGenerating || isWSIDataLoading) {
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
                    <p className="text-sm font-medium text-foreground">
                      {isWSIDataLoading ? 'Loading WSI Data...' : 'Generating WSI Question...'}
                    </p>
                    <p className="text-xs text-primary font-medium">
                      {isWSIDataLoading ? 'Loading virtual slide database...' : 'Preparing your pathology challenge...'}
                    </p>

                    <p className="text-xs text-muted-foreground italic leading-relaxed min-h-[2.5rem] flex items-center justify-center transition-opacity duration-500">
                      {isWSIDataLoading
                        ? 'Connecting to virtual slide repository...'
                        : (currentLoadingMessage || "Teaching AI the difference between normal and 'definitely not normal'...")
                      }
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

  // Safety check to ensure we have a valid question structure
  if (!currentQuestion.wsi || !currentQuestion.question) {
    return (
      <div className={`w-full max-w-4xl mx-auto ${className}`} style={{ minHeight: '600px' }}>
        <Card className="h-full">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
              <p className="text-sm font-medium text-destructive">Invalid question data</p>
              <p className="text-xs text-muted-foreground">Please try generating a new question</p>
              <Button onClick={generateNewQuestion} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`w-full max-w-4xl mx-auto ${className}`} style={{ minHeight: '600px' }}>
      {/* Top Controls - Standardized Responsive Layout */}
      <div className="mb-6 space-y-4">
        {/* Control Bar: Desktop horizontal, Mobile stacked */}
        <div className="space-y-4 md:space-y-0">

          {/* Desktop: Single horizontal line */}
          <div className="hidden md:flex md:items-center md:justify-between md:gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Category Filter */}
              {showCategoryFilter && availableCategories.length > 0 && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <label className="text-sm font-medium whitespace-nowrap">Category:</label>
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

              {/* View Original Link */}
              {currentQuestion && (
                <a
                  href={currentQuestion.wsi.slide_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 transition-colors flex items-center gap-1 text-sm font-medium flex-shrink-0"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="whitespace-nowrap">View Original</span>
                </a>
              )}
            </div>

            {/* New Question Button - Desktop */}
            <Button
              onClick={generateNewQuestion}
              disabled={isGenerating}
              className="min-w-[140px] flex-shrink-0"
              size="default"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  <span className="whitespace-nowrap">Generating...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  <span className="whitespace-nowrap">New Question</span>
                </>
              )}
            </Button>
          </div>

          {/* Mobile: Stacked layout */}
          <div className="md:hidden space-y-3">
            {/* Category Filter - Full width on mobile */}
            {showCategoryFilter && availableCategories.length > 0 && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium">Category:</label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full">
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

            {/* Action buttons row */}
            <div className="flex gap-2">
              {/* New Question Button - Mobile */}
              <Button
                onClick={generateNewQuestion}
                disabled={isGenerating}
                className="flex-1"
                size="sm"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    <span className="whitespace-nowrap">Generating...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    <span className="whitespace-nowrap">New</span>
                  </>
                )}
              </Button>

              {/* View Original Link - Mobile */}
              {currentQuestion && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <a
                    href={currentQuestion.wsi.slide_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    <span className="whitespace-nowrap">View</span>
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Warning Disclaimer */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3">
          <div className="flex items-start gap-2 text-xs sm:text-sm text-red-700">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>AI-generated content without human oversight. May contain incorrect information.</span>
          </div>
        </div>
      </div>

      <Card className="h-full">
        <CardContent className="space-y-3 sm:space-y-4 pt-4 sm:pt-6 px-3 sm:px-6">
          {/* Question Text */}
          <div className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
            {currentQuestion.question.stem}
          </div>

          {/* WSI Viewer */}
          <div className="w-full">
            <WSIViewer slide={currentQuestion.wsi} showMetadata={false} />

            {/* WSI Disclaimer with Authors */}
            <div className="mt-2 text-xs text-muted-foreground text-center">
              <div>
                Virtual slide provided by <span className="font-bold">PathPresenter</span> and <span className="font-bold">Ace My Path</span>. All credits belong to the original authors.
              </div>
              {currentQuestion.wsi.source_metadata?.authors && Array.isArray(currentQuestion.wsi.source_metadata.authors) && currentQuestion.wsi.source_metadata.authors.length > 0 && (
                <div className="mt-1">
                  <span className="font-bold">Authors:</span> {(() => {
                    const authors = currentQuestion.wsi.source_metadata.authors as string[]
                    const formatAuthor = (author: string) => {
                      const parts = author.split(' – ')
                      if (parts.length === 2) {
                        return (
                          <span key={author}>
                            {parts[0]} – <em>{parts[1]}</em>
                          </span>
                        )
                      }
                      return author
                    }
                    
                    if (authors.length === 1) {
                      return formatAuthor(authors[0])
                    } else if (authors.length === 2) {
                      return (
                        <span>
                          {formatAuthor(authors[0])} and {formatAuthor(authors[1])}
                        </span>
                      )
                    } else {
                      return (
                        <span>
                          {authors.slice(0, -1).map((author, index) => (
                            <span key={author}>
                              {formatAuthor(author)}{index < authors.slice(0, -1).length - 1 ? ', ' : ''}
                            </span>
                          ))}, and {formatAuthor(authors[authors.length - 1])}
                        </span>
                      )
                    }
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Answer Options */}
          <div className="grid gap-2" role="listbox" aria-label="Answer options">
            {currentQuestion.question.question_options.map((option, index) => {
              const isSelected = selectedOption === option.id
              const showCorrect = isAnswered && option.is_correct
              const showIncorrect = isAnswered && isSelected && !option.is_correct
              const optionLabel = getOptionLabel(option.id, index)

              return (
                <button
                  key={option.id}
                  onClick={() => handleOptionClick(option.id)}
                  className={`
                    p-2 sm:p-3 rounded-md text-left border text-xs sm:text-sm transition-colors duration-200
                    ${!isAnswered ? 'hover:border-muted-foreground/50 hover:bg-muted/30' : ''}
                    ${isSelected && !showCorrect && !showIncorrect ? 'border-muted-foreground/70' : 'border-muted-foreground/30'}
                    ${showCorrect ? 'bg-green-50 border-green-600 dark:bg-green-950/30' : ''}
                    ${showIncorrect ? 'bg-red-50 border-red-600 dark:bg-red-950/30' : ''}
                  `}
                  disabled={isAnswered}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="flex items-center gap-2">
                    <span className={`
                      flex items-center justify-center w-5 h-5 rounded-full border text-xs
                      ${isSelected && !showCorrect && !showIncorrect ? 'border-muted-foreground/70' : 'border-muted-foreground/30'}
                      ${showCorrect ? 'border-green-600' : ''}
                      ${showIncorrect ? 'border-red-600' : ''}
                    `}>
                      {optionLabel}
                    </span>
                    <span className="flex-1">{option.text}</span>
                    {showCorrect && <Check className="w-4 h-4 text-green-600" />}
                    {showIncorrect && <X className="w-4 h-4 text-red-600" />}
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
              <div className="p-2 sm:p-3 rounded-lg bg-muted/50 text-xs sm:text-sm space-y-3 sm:space-y-4">
                {/* Teaching Point */}
                <div>
                  <h4 className="font-medium text-xs uppercase mb-1">Teaching Point</h4>
                  <div className="text-muted-foreground leading-relaxed">
                    {currentQuestion.question.question_options.find(option => option.is_correct)?.explanation || 'No explanation available.'}
                  </div>
                </div>

                {/* Option Explanations */}
                {currentQuestion.question.question_options.some(opt => opt.explanation) && (
                  <div>
                    <h4 className="font-medium text-xs uppercase mb-1">Answer Explanations</h4>
                    <div className="space-y-2 text-muted-foreground">
                      {currentQuestion.question.question_options
                        .filter(option => option.explanation && !option.is_correct)
                        .map((option) => {
                          const optionIndex = currentQuestion.question.question_options.findIndex(opt => opt.id === option.id)
                          const optionLabel = getOptionLabel(option.id, optionIndex)

                          return (
                            <div key={option.id} className="leading-relaxed">
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
                  <div className="text-xs text-muted-foreground text-center mb-3 leading-relaxed">
                    <div className="break-words">
                      {currentQuestion.metadata.successful_model || currentQuestion.metadata.model} • {
                        (() => {
                          const tokenUsage = currentQuestion.metadata.token_usage
                          if (tokenUsage) {

                            if (tokenUsage.total_tokens && typeof tokenUsage.total_tokens === 'number') {
                              return `${tokenUsage.total_tokens.toLocaleString()} tokens`
                            }
                          }
                          return 'Tokens: N/A'
                        })()
                      } • {currentQuestion.metadata.generation_time_ms}ms
                      {(currentQuestion.metadata.fallback_attempts || 0) > 1 && (
                        <span className="text-amber-600"> • Backup system used</span>
                      )}
                    </div>
                  </div>

                  {/* Try Another Button */}
                  <div className="flex justify-center sm:justify-end">
                    <Button
                      onClick={generateNewQuestion}
                      disabled={isGenerating}
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
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
