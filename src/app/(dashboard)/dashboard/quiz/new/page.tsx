// src/app/(dashboard)/dashboard/quiz/new/page.tsx
"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Label } from "@/shared/components/ui/label"
import { Badge } from "@/shared/components/ui/badge"
import { Slider } from "@/shared/components/ui/slider"
import { Separator } from "@/shared/components/ui/separator"
import { Play } from "lucide-react"
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

interface QuizOptionsData {
  categories: CategoryWithStats[]
  questionTypeStats: {
    all: QuestionTypeStats
    ap_only: QuestionTypeStats
    cp_only: QuestionTypeStats
  }
}

export default function NewQuizPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<QuizCreationForm>(DEFAULT_QUIZ_CONFIG)
  const [quizOptions, setQuizOptions] = useState<QuizOptionsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  // Fetch quiz options on component mount
  useEffect(() => {
    const fetchQuizOptions = async () => {
      try {
        const response = await fetch('/api/quiz/options')
        if (!response.ok) {
          throw new Error('Failed to fetch quiz options')
        }
        const result = await response.json()
        setQuizOptions(result.data)
      } catch (error) {
        console.error('Error fetching quiz options:', error)
        toast.error('Failed to load quiz options')
      } finally {
        setLoading(false)
      }
    }

    fetchQuizOptions()
  }, [])

  // Generate quiz title based on selection
  const generateQuizTitle = (): string => {
    if (!quizOptions) return 'Custom Quiz 01'

    if (formData.categorySelection === 'all') {
      return 'AP/CP Quiz 01'
    } else if (formData.categorySelection === 'ap_only') {
      return 'AP Quiz 01'
    } else if (formData.categorySelection === 'cp_only') {
      return 'CP Quiz 01'
    } else if (formData.selectedCategories.length === 1) {
      // Single category selected
      const category = quizOptions.categories.find(c => c.id === formData.selectedCategories[0])
      return category ? `${category.shortName} Quiz 01` : 'Custom Quiz 01'
    } else {
      // Multiple categories selected
      return 'Custom Quiz 01'
    }
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

  // Get available question count based on current selection
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

  const handleSubmit = async () => {
    const availableQuestions = getAvailableQuestions()

    if (availableQuestions === 0) {
      toast.error('No questions available for the selected criteria')
      return
    }

    if (formData.categorySelection === 'custom' && formData.selectedCategories.length === 0) {
      toast.error('Please select at least one category')
      return
    }

    setCreating(true)
    try {
      // Generate title if not provided
      const title = formData.title?.trim() || generateQuizTitle()

      // Create quiz payload with all required fields at the top level
      const quizPayload = {
        ...formData,
        title,
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
      console.error('Error creating quiz:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create quiz')
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
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-1/4" />
              <div className="h-10 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-1/4" />
              <div className="space-y-2">
                <div className="h-12 bg-gray-200 rounded animate-pulse" />
                <div className="h-12 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-1/4" />
              <div className="grid grid-cols-2 gap-2">
                <div className="h-12 bg-gray-200 rounded animate-pulse" />
                <div className="h-12 bg-gray-200 rounded animate-pulse" />
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

  const availableQuestions = getAvailableQuestions()
  const maxQuestions = Math.min(availableQuestions, 50) // Cap at 50 questions

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
          {/* Question Count */}
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Number of Questions</Label>
              <p className="text-xs text-muted-foreground">Choose how many questions for your quiz</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 25, 50].map((count) => (
                <Button
                  key={count}
                  variant={formData.questionCount === count ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormData(prev => ({ ...prev, questionCount: Math.min(count, maxQuestions) }))}
                  disabled={count > availableQuestions}
                >
                  {count}
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Custom: {formData.questionCount}</span>
                <span className="text-muted-foreground">{availableQuestions} available</span>
              </div>
              <Slider
                value={[formData.questionCount]}
                onValueChange={([value]) => setFormData(prev => ({ ...prev, questionCount: value }))}
                max={maxQuestions}
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

          {/* Question Type */}
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Question Type</Label>
              <p className="text-xs text-muted-foreground">Select the type of questions</p>
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
                    onClick={() => setFormData(prev => ({ ...prev, questionType: key as QuestionType }))}
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

          <Separator />

          {/* Categories */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Categories</Label>
            <div className="grid grid-cols-4 gap-2">
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
                      <div className="font-medium text-xs">{config.label}</div>
                      {key !== 'custom' && <div className="text-xs opacity-70">{count}</div>}
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
                        <span className="text-xs font-medium">{category.parent}</span>
                        <span className="text-xs">{category.name}</span>
                        <span className="text-xs opacity-70">({count})</span>
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Start Button */}
          <div className="flex justify-center">
            <Button
              onClick={handleSubmit}
              size="lg"
              className="w-full h-16 text-lg font-semibold"
              disabled={creating || availableQuestions === 0}
            >
              {creating ? (
                <>
                  <div className="h-5 w-5 mr-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Creating...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-3" />
                  Start Quiz ({formData.questionCount} questions)
                </>
              )}
            </Button>
          </div>

          {availableQuestions === 0 && (
            <p className="text-sm text-red-600 text-center">
              No questions available for the selected criteria
            </p>
          )}
        </CardContent>
      </Card>
      </div>
    </>
  )
}
