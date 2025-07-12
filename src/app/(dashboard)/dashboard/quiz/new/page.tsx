// src/app/(dashboard)/dashboard/quiz/new/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Slider } from "@/shared/components/ui/slider"
import { Badge } from "@/shared/components/ui/badge"
import {
  Brain,
  Target,
  Settings,
  Play,
  BarChart3
} from "lucide-react"
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
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create New Quiz</h1>
          <p className="text-muted-foreground">
            Loading quiz options...
          </p>
        </div>
        <div className="space-y-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!quizOptions) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create New Quiz</h1>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4 pt-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg">
            <Play className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Create New Quiz
            </h1>
            <p className="text-lg text-gray-600 mt-2">Configure your personalized learning experience</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Configuration */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quiz Title */}
            <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Settings className="h-5 w-5 text-blue-600" />
                  </div>
                  Quiz Title
                  <span className="text-sm font-normal text-gray-500">(Optional)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Input
                    placeholder={`Auto-generated: ${generateQuizTitle()}`}
                    value={formData.title || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="text-sm text-gray-600">
                    Leave blank to auto-generate based on your selection
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Learning Mode */}
            <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Brain className="h-5 w-5 text-green-600" />
                  </div>
                  Learning Mode
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4">
                  {Object.entries(QUIZ_MODE_CONFIG).map(([key, config]) => (
                    <div
                      key={key}
                      className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                        formData.mode === key
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
                      }`}
                      onClick={() => setFormData(prev => ({ ...prev, mode: key as QuizMode }))}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{config.icon}</span>
                          <div>
                            <div className="font-semibold text-gray-900">{config.label}</div>
                            <div className="text-sm text-gray-600 mt-1">{config.description}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            config.showExplanations
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {config.showExplanations ? 'With explanations' : 'No explanations'}
                          </span>
                          {formData.mode === key && (
                            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

        {/* Timing */}
        <Card>
          <CardHeader>
            <CardTitle>Timing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(QUIZ_TIMING_CONFIG).map(([key, config]) => (
                <Button
                  key={key}
                  variant={formData.timing === key ? "default" : "outline"}
                  className="h-auto p-4 justify-start"
                  onClick={() => setFormData(prev => ({ ...prev, timing: key as QuizTiming }))}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{config.icon}</span>
                    <div className="text-left">
                      <div className="font-semibold">{config.label}</div>
                      <div className="text-xs text-muted-foreground">{config.description}</div>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Question Type Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Question Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3">
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
                    className="h-auto p-4 justify-between"
                    onClick={() => setFormData(prev => ({ ...prev, questionType: key as QuestionType }))}
                  >
                    <div className="text-left">
                      <div className="font-medium">{config.label}</div>
                      <div className="text-xs text-muted-foreground">{config.description}</div>
                    </div>
                    <Badge variant="secondary">{count} available</Badge>
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Category Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Categories
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Category Selection Type */}
            <div className="grid grid-cols-1 gap-3">
              {Object.entries(CATEGORY_SELECTION_CONFIG).map(([key, config]) => {
                const stats = quizOptions?.questionTypeStats[key as keyof typeof quizOptions.questionTypeStats]
                const count = stats ? stats[formData.questionType] : 0

                return (
                  <Button
                    key={key}
                    variant={formData.categorySelection === key ? "default" : "outline"}
                    className="h-auto p-4 justify-between"
                    onClick={() => handleCategorySelectionChange(key as CategorySelection)}
                  >
                    <div className="text-left">
                      <div className="font-medium">{config.label}</div>
                      <div className="text-xs text-muted-foreground">{config.description}</div>
                    </div>
                    {key !== 'custom' && <Badge variant="secondary">{count} available</Badge>}
                  </Button>
                )
              })}
            </div>

            {/* Custom Category Selection */}
            {formData.categorySelection === 'custom' && quizOptions && (
              <div className="space-y-3 border-t pt-4">
                <Label className="text-sm font-medium">Select Categories</Label>
                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                  {quizOptions.categories.map((category) => {
                    const count = category.questionStats[formData.questionType]
                    return (
                      <Button
                        key={category.id}
                        variant={formData.selectedCategories.includes(category.id) ? "default" : "outline"}
                        className="h-auto p-3 justify-between"
                        onClick={() => handleCategoryToggle(category.id)}
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {category.parent}
                          </Badge>
                          <span className="font-medium text-sm">{category.name}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {count}
                        </Badge>
                      </Button>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

          </div>

          {/* Right Column - Summary & Actions */}
          <div className="lg:col-span-1 space-y-6">
            {/* Quiz Summary */}
            <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm sticky top-6">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-purple-600" />
                  </div>
                  Quiz Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Title:</span>
                    <span className="text-sm font-medium text-right max-w-32 truncate">
                      {formData.title?.trim() || generateQuizTitle()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Mode:</span>
                    <span className="text-sm font-medium">
                      {QUIZ_MODE_CONFIG[formData.mode].label}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Timing:</span>
                    <span className="text-sm font-medium">
                      {QUIZ_TIMING_CONFIG[formData.timing].label}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Questions:</span>
                    <span className="text-sm font-medium">
                      {formData.questionCount} of {availableQuestions}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-600">Categories:</span>
                    <span className="text-sm font-medium text-right max-w-32 truncate">
                      {CATEGORY_SELECTION_CONFIG[formData.categorySelection].label}
                      {formData.categorySelection === 'custom' && ` (${formData.selectedCategories.length})`}
                    </span>
                  </div>
                </div>

                {/* Question Count Slider */}
                <div className="pt-4 border-t border-gray-100">
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Questions: {formData.questionCount}</span>
                      <span className="text-gray-500">
                        {availableQuestions} available
                      </span>
                    </div>
                    <Slider
                      value={[formData.questionCount]}
                      onValueChange={([value]) => setFormData(prev => ({ ...prev, questionCount: value }))}
                      max={maxQuestions}
                      min={1}
                      step={1}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-500 text-center">
                      {formData.questionCount === availableQuestions ? 'All available questions' :
                       formData.questionCount === maxQuestions ? 'Maximum 50 questions' :
                       `${formData.questionCount} of ${availableQuestions} questions`}
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="pt-4">
                  <Button
                    onClick={handleSubmit}
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg"
                    size="lg"
                    disabled={creating || availableQuestions === 0}
                  >
                    {creating ? (
                      <>
                        <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Creating Quiz...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Start Quiz
                      </>
                    )}
                  </Button>

                  {availableQuestions === 0 && (
                    <p className="text-sm text-red-600 text-center mt-3">
                      No questions available for the selected criteria
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
