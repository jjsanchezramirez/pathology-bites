// src/app/(dashboard)/dashboard/quiz/new/page.tsx
"use client"

import React, { useState, useEffect } from "react"
import { useCachedData } from '@/shared/hooks/use-cached-data'
import { useZeroApiNetworkStatus } from '@/shared/hooks/use-zero-api-network-status'
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/shared/components/ui/card"
import { Skeleton } from "@/shared/components/ui/skeleton"
import { Button } from "@/shared/components/ui/button"
import { Label } from "@/shared/components/ui/label"
import { Badge } from "@/shared/components/ui/badge"
import { Slider } from "@/shared/components/ui/slider"
import { Separator } from "@/shared/components/ui/separator"
import { Input } from "@/shared/components/ui/input"
import { BookOpen, WifiOff } from "lucide-react"
import { userSettingsService } from '@/shared/services/user-settings'

import {
  QuizMode,
  QuizTiming,
  QuestionType,
  CategorySelection,
  QuizCreationForm,
  CategoryWithStats,
  QuestionTypeStats,
  QUIZ_MODE_CONFIG,
  QUIZ_TIMING_CONFIG,
  QUESTION_TYPE_CONFIG,
  CATEGORY_SELECTION_CONFIG,
  DEFAULT_QUIZ_CONFIG
} from "@/features/quiz/types/quiz"
import { toast } from "sonner"
import { FeaturePlaceholder } from "@/features/dashboard/components"
import { isQuizFeaturesEnabled } from "@/shared/config/feature-flags"

interface QuizOptionsData {
  categories: CategoryWithStats[]
  questionTypeStats: {
    all: QuestionTypeStats
    ap_only: QuestionTypeStats
    cp_only: QuestionTypeStats
  }
}

// Remove local interface since we're using the one from the service

export default function NewQuizPage() {
  const featuresEnabled = isQuizFeaturesEnabled()
  const router = useRouter()
  const { isOnline } = useZeroApiNetworkStatus()
  const [formData, setFormData] = useState<QuizCreationForm>(DEFAULT_QUIZ_CONFIG)
  const [quizOptions, setQuizOptions] = useState<QuizOptionsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [previousQuizTitles, setPreviousQuizTitles] = useState<string[]>([])
  const [loadingTitles, setLoadingTitles] = useState(true)

  // Use cached data for user settings
  const { data: userSettings } = useCachedData(
    'user-quiz-settings',
    async () => {
      return await userSettingsService.getQuizSettings()
    },
    {
      ttl: 5 * 60 * 1000, // 5 minutes cache
      staleTime: 2 * 60 * 1000, // 2 minutes stale time
      storage: 'memory',
      prefix: 'pathology-bites-user-settings'
    }
  )

  // Apply user settings when available
  useEffect(() => {
    if (userSettings) {
      setFormData(prev => ({
        ...prev,
        questionCount: userSettings.default_question_count,
        mode: userSettings.default_mode,
        timing: userSettings.default_timing,
        questionType: userSettings.default_question_type,
        categorySelection: userSettings.default_category_selection
      }))
    }
  }, [userSettings])

  // Use cached data for quiz titles (limit to recent 100 for title generation)
  const { data: recentSessions } = useCachedData(
    'recent-quiz-titles',
    async () => {
      const response = await fetch('/api/quiz/sessions?limit=100')
      if (response.ok) {
        const data = await response.json()
        return data.data?.map((session: any) => session.title) || []
      }
      return []
    },
    {
      ttl: 5 * 60 * 1000, // 5 minutes cache
      staleTime: 2 * 60 * 1000, // 2 minutes stale time
      storage: 'memory',
      prefix: 'pathology-bites-quiz-titles',
      onSuccess: (titles) => {
        setPreviousQuizTitles(titles)
        setLoadingTitles(false)
      },
      onError: () => {
        setLoadingTitles(false)
      }
    }
  )

  // Update titles when cached data is available
  useEffect(() => {
    if (recentSessions) {
      setPreviousQuizTitles(recentSessions)
      setLoadingTitles(false)
    }
  }, [recentSessions])

  // Use cached data for quiz options
  const { data: quizOptionsData, isLoading } = useCachedData(
    'quiz-options',
    async () => {
      const response = await fetch('/api/quiz/options')
      if (!response.ok) {
        throw new Error('Failed to fetch quiz options')
      }
      const result = await response.json()
      return result.data
    },
    {
      ttl: 10 * 60 * 1000, // 10 minutes cache (quiz options don't change often)
      staleTime: 5 * 60 * 1000, // 5 minutes stale time
      storage: 'memory',
      prefix: 'pathology-bites-quiz-options',
      onSuccess: (data) => {
        setQuizOptions(data)
        setLoading(false)
      },
      onError: () => {
        toast.error('Failed to load quiz options')
        setLoading(false)
      }
    }
  )

  // Update quiz options when cached data is available
  useEffect(() => {
    if (quizOptionsData) {
      setQuizOptions(quizOptionsData)
      setLoading(false)
    }
  }, [quizOptionsData])

  // Set loading state based on cached data loading
  useEffect(() => {
    setLoading(isLoading)
  }, [isLoading])

  // Auto-adjust question count when available questions change
  useEffect(() => {
    if (!quizOptions) return

    const availableQuestions = getAvailableQuestions()

    // If current question count exceeds available questions, adjust it
    if (formData.questionCount > availableQuestions && availableQuestions > 0) {
      setFormData(prev => ({
        ...prev,
        questionCount: Math.min(prev.questionCount, availableQuestions)
      }))
    }
  }, [formData.questionType, formData.categorySelection, formData.selectedCategories, quizOptions])

  // Show placeholder if features are disabled
  if (!featuresEnabled) {
    return (
      <FeaturePlaceholder
        title="New Quiz"
        description="Enhanced quiz creation with more customization options is nearly ready. Soon you'll be able to create custom quizzes with advanced filtering, difficulty selection, and personalized question sets tailored to your learning goals."
        status="in-final-stages"
      />
    )
  }

  // Generate sequential quiz title based on previous quizzes
  const generateQuizTitle = (): string => {
    // Guard clause to ensure all required data is available
    if (!formData || !previousQuizTitles) {
      return 'New Quiz'
    }

    let baseTitle: string
    let pattern: RegExp

    switch (formData.categorySelection) {
      case 'all':
        baseTitle = 'AP/CP Quiz'
        pattern = /^AP\/CP Quiz No (\d+)$/
        break
      case 'ap_only':
        baseTitle = 'AP Only Quiz'
        pattern = /^AP Only Quiz No (\d+)$/
        break
      case 'cp_only':
        baseTitle = 'CP Only Quiz'
        pattern = /^CP Only Quiz No (\d+)$/
        break
      default:
        baseTitle = 'Custom Quiz'
        pattern = /^Custom Quiz No (\d+)$/
        break
    }

    // Find the highest number for this quiz type
    let highestNumber = 0
    previousQuizTitles.forEach(title => {
      const match = title.match(pattern)
      if (match) {
        const number = parseInt(match[1], 10)
        if (number > highestNumber) {
          highestNumber = number
        }
      }
    })

    const nextNumber = highestNumber + 1
    return `${baseTitle} No ${nextNumber}`
  }

  const handleCategorySelectionChange = (selection: CategorySelection) => {
    setFormData(prev => ({
      ...prev,
      categorySelection: selection,
      selectedCategories: selection === 'custom' ? prev.selectedCategories : []
    }))
  }

  const handleCategoryToggle = (categoryId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedCategories: prev.selectedCategories.includes(categoryId)
        ? prev.selectedCategories.filter(id => id !== categoryId)
        : [...prev.selectedCategories, categoryId]
    }))
  }

  const handleQuestionTypeChange = (questionType: QuestionType) => {
    setFormData(prev => ({
      ...prev,
      questionType
    }))
  }

  // Get available questions for current configuration
  const getAvailableQuestions = (): number => {
    if (!quizOptions) return 0

    if (formData.categorySelection === 'all') {
      return quizOptions.questionTypeStats.all[formData.questionType]
    } else if (formData.categorySelection === 'ap_only') {
      return quizOptions.questionTypeStats.ap_only[formData.questionType]
    } else if (formData.categorySelection === 'cp_only') {
      return quizOptions.questionTypeStats.cp_only[formData.questionType]
    } else {
      // Custom selection
      return formData.selectedCategories.reduce((total, categoryId) => {
        const category = quizOptions.categories.find(c => c.id === categoryId)
        return total + (category?.questionStats[formData.questionType] || 0)
      }, 0)
    }
  }

  // Simple validation function
  const validateQuizConfig = () => {
    if (!isOnline) {
      return { isValid: false, error: 'No internet connection. Please check your network and try again.' }
    }

    if (formData.categorySelection === 'custom' && formData.selectedCategories.length === 0) {
      return { isValid: false, error: 'Please select at least one category' }
    }

    const availableQuestions = getAvailableQuestions()
    if (availableQuestions === 0) {
      return { isValid: false, error: 'No questions available for the selected criteria' }
    }

    return { isValid: true, error: null }
  }

  const handleSubmit = async () => {
    // Early network check to prevent unnecessary processing
    if (!isOnline) {
      toast.error('No internet connection. Quiz creation requires an active network connection.')
      return
    }

    // Simple validation
    const validation = validateQuizConfig()
    if (!validation.isValid) {
      toast.error(validation.error!)
      return
    }

    setCreating(true)
    try {
      // Generate title if not provided
      const title = formData.title?.trim() || (formData && previousQuizTitles ? generateQuizTitle() : 'New Quiz')

      // Use the effective question count (already constrained)
      const finalQuestionCount = Math.min(effectiveFormData.questionCount, availableQuestions)

      // Create quiz payload
      const quizPayload = {
        ...effectiveFormData,
        title,
        questionCount: finalQuestionCount,
        showExplanations: QUIZ_MODE_CONFIG[formData.mode].showExplanations,
        timePerQuestion: formData.timing === 'timed' ? QUIZ_TIMING_CONFIG.timed.timePerQuestion : undefined
      }

      const response = await fetch('/api/quiz/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(quizPayload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create quiz')
      }

      const result = await response.json()
      toast.success('Quiz created successfully!')

      // Redirect to quiz session
      router.push(`/dashboard/quiz/${result.data.sessionId}`)
    } catch (error) {
      // Check if this might be a network error
      if (error instanceof TypeError && error.message.includes('fetch')) {
        toast.error('Network error: Please check your internet connection and try again.')
      } else if (error instanceof Error && (error.message.includes('NetworkError') || error.message.includes('fetch'))) {
        toast.error('Connection failed: Unable to reach the server. Please check your network.')
      } else {
        toast.error(error instanceof Error ? error.message : 'Failed to create quiz')
      }
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Quiz</h1>
          <p className="text-muted-foreground">Loading quiz options...</p>
        </div>
        <Card>
          <CardContent className="p-6 space-y-6">
            {/* Quiz Mode Section Skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-4 w-24" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="p-4 border rounded-lg space-y-2">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            </div>

            {/* Question Settings Skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-4 w-32" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            </div>

            {/* Question Type and Category Selection Skeleton */}
            <div className="space-y-6">
              {/* Question Type Skeleton */}
              <div className="space-y-4">
                <Skeleton className="h-4 w-24" />
                <div className="grid grid-cols-1 gap-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              </div>

              {/* Categories Skeleton */}
              <div className="space-y-4">
                <Skeleton className="h-4 w-20" />
                <div className="grid grid-cols-1 gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              </div>
            </div>

            {/* Start Button Skeleton */}
            <div className="space-y-3">
              <div className="flex justify-center">
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!quizOptions) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Quiz</h1>
          <p className="text-muted-foreground text-red-600">
            Failed to load quiz options. Please refresh the page.
          </p>
        </div>
      </div>
    )
  }

  // Get standard question count options (always show all, but some may be disabled)
  const getQuestionCountOptions = (): number[] => {
    return [5, 10, 25, 50]
  }

  // Get current available questions and ensure form data is constrained
  const availableQuestions = getAvailableQuestions()
  const questionCountOptions = getQuestionCountOptions()

  // Ensure current question count doesn't exceed available questions
  const constrainedQuestionCount = Math.min(formData.questionCount, Math.max(1, availableQuestions))
  const effectiveFormData = {
    ...formData,
    questionCount: constrainedQuestionCount
  }

  return (
    <>
      <div className="space-y-6">



      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Quiz</h1>
        <p className="text-muted-foreground">
          Configure your quiz settings and start learning
        </p>
      </div>

      {/* Main Configuration Card */}
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Quiz Name */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Quiz Name</Label>
            <Input
              placeholder={loadingTitles ? "Loading..." : (formData && previousQuizTitles ? generateQuizTitle() : "New Quiz")}
              value={formData.title || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              {loadingTitles
                ? "Loading previous quiz names..."
                : `Leave blank to auto-generate: "${formData && previousQuizTitles ? generateQuizTitle() : "New Quiz"}"`
              }
            </p>
          </div>

          <Separator />

          {/* Question Count */}
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Number of Questions</Label>
              <p className="text-xs text-muted-foreground">Choose how many questions for your quiz</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {questionCountOptions.map((count) => {
                const isSelected = effectiveFormData.questionCount === count
                const isDisabled = count > availableQuestions

                return (
                  <Button
                    key={count}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormData(prev => ({ ...prev, questionCount: count }))}
                    disabled={isDisabled}
                  >
                    {count}
                  </Button>
                )
              })}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Custom: {effectiveFormData.questionCount}</span>
                <span className="text-muted-foreground">Max: {availableQuestions}</span>
              </div>
              <Slider
                value={[effectiveFormData.questionCount]}
                onValueChange={([value]) => setFormData(prev => ({ ...prev, questionCount: value }))}
                max={Math.min(50, availableQuestions)}
                min={1}
                step={1}
                className="w-full"
              />
            </div>
          </div>

          <Separator />

          {/* Learning Mode & Timing */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Mode</Label>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(QUIZ_MODE_CONFIG).map(([key, config]) => (
                  <Button
                    key={key}
                    variant={formData.mode === key ? "default" : "outline"}
                    onClick={() => setFormData(prev => ({ ...prev, mode: key as QuizMode }))}
                  >
                    {config.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Timing</Label>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(QUIZ_TIMING_CONFIG).map(([key, config]) => (
                  <Button
                    key={key}
                    variant={formData.timing === key ? "default" : "outline"}
                    onClick={() => setFormData(prev => ({ ...prev, timing: key as QuizTiming }))}
                  >
                    {config.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          {/* Question Type and Categories - Vertical Layout */}
          <div className="space-y-6">
            {/* Question Type */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Question Type</Label>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(QUESTION_TYPE_CONFIG).map(([key, config]) => {
                  const count = quizOptions ? (
                    formData.categorySelection === 'all' ? quizOptions.questionTypeStats.all[key as QuestionType] :
                    formData.categorySelection === 'ap_only' ? quizOptions.questionTypeStats.ap_only[key as QuestionType] :
                    formData.categorySelection === 'cp_only' ? quizOptions.questionTypeStats.cp_only[key as QuestionType] :
                    formData.selectedCategories.reduce((total, categoryId) => {
                      const category = quizOptions.categories.find(c => c.id === categoryId)
                      return total + (category?.questionStats[key as QuestionType] || 0)
                    }, 0)
                  ) : 0

                  return (
                    <Button
                      key={key}
                      variant={formData.questionType === key ? "default" : "outline"}
                      className="h-auto p-3 justify-between"
                      onClick={() => handleQuestionTypeChange(key as QuestionType)}
                    >
                      <div className="text-left">
                        <div className="font-medium text-sm">{config.label}</div>
                      </div>
                      <Badge variant="secondary" className="text-xs">{count}</Badge>
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* Categories */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Categories</Label>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(CATEGORY_SELECTION_CONFIG).map(([key, config]) => {
                  const stats = quizOptions?.questionTypeStats[key as keyof typeof quizOptions.questionTypeStats]
                  const count = stats ? stats[formData.questionType] : 0

                  return (
                    <Button
                      key={key}
                      variant={formData.categorySelection === key ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleCategorySelectionChange(key as CategorySelection)}
                      disabled={key !== 'custom' && count === 0}
                    >
                      <div className="text-center">
                        <div className="font-medium text-xs">
                          {key === 'custom' ? config.label : `${config.label} (${count})`}
                        </div>
                      </div>
                    </Button>
                  )
                })}
              </div>

              {/* Custom Category Selection - Always visible when custom is selected */}
              {formData.categorySelection === 'custom' && quizOptions && (
                <div className="space-y-3 border-t pt-3 mt-3">
                  <Label className="text-sm font-medium">Select Specific Categories</Label>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                    {quizOptions.categories.map((category) => {
                      const count = category.questionStats[formData.questionType]
                      if (count === 0) return null

                      const isSelected = formData.selectedCategories.includes(category.id)

                      return (
                        <Badge
                          key={category.id}
                          variant={isSelected ? "default" : "outline"}
                          className="cursor-pointer hover:bg-secondary/80 flex items-center gap-1 px-2 py-1"
                          onClick={() => handleCategoryToggle(category.id)}
                        >
                          <span className="text-xs">{category.shortName}</span>
                          <span className="text-xs opacity-70">({count})</span>
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Start Button */}
          <div className="space-y-3">
            <div className="flex justify-center">
              <Button
                onClick={handleSubmit}
                size="lg"
                className="w-full h-16 text-lg font-semibold"
                disabled={creating || !validateQuizConfig().isValid}
              >
                {creating ? (
                  <>
                    <div className="h-5 w-5 mr-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Creating...
                  </>
                ) : !isOnline ? (
                  <>
                    <WifiOff className="h-5 w-5 mr-3" />
                    No Connection
                  </>
                ) : (
                  <>
                    <BookOpen className="h-5 w-5 mr-3" />
                    Start Quiz
                  </>
                )}
              </Button>
            </div>

            {/* Show helpful message when button is disabled */}
            {!creating && !validateQuizConfig().isValid && (
              <p className="text-sm text-muted-foreground text-center">
                {validateQuizConfig().error}
              </p>
            )}


          </div>
        </CardContent>
      </Card>
      </div>
    </>
  )
}
