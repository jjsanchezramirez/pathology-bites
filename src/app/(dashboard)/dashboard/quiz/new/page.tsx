// src/app/(dashboard)/dashboard/quiz/new/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Textarea } from "@/shared/components/ui/textarea"
import { Switch } from "@/shared/components/ui/switch"
import { Slider } from "@/shared/components/ui/slider"
import { Badge } from "@/shared/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/shared/components/ui/select"
import { 
  Brain, 
  Clock, 
  Target, 
  Settings, 
  Play,
  BookOpen,
  Timer,
  Shuffle,
  Eye,
  RotateCcw
} from "lucide-react"
import { QuizMode, QuizDifficulty, QUIZ_MODE_CONFIG, QUIZ_DIFFICULTY_CONFIG } from "@/features/quiz/types/quiz"
import { toast } from "sonner"

interface QuizFormData {
  title: string
  mode: QuizMode
  questionCount: number
  timeLimit?: number
  timePerQuestion?: number
  difficulty: QuizDifficulty
  selectedCategories: string[]
  selectedTags: string[]
  selectedQuestionSets: string[]
  shuffleQuestions: boolean
  shuffleAnswers: boolean
  showExplanations: boolean
  allowReview: boolean
  showProgress: boolean
}

interface QuizOption {
  id: string
  name: string
  questionCount: number
  description?: string
  color?: string
}

interface QuizOptionsData {
  categories: QuizOption[]
  questionSets: QuizOption[]
  tags: QuizOption[]
  totalQuestions: number
  difficultyCounts: {
    easy: number
    medium: number
    hard: number
  }
}

export default function NewQuizPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<QuizFormData>({
    title: '',
    mode: 'tutor',
    questionCount: 20,
    difficulty: 'mixed',
    selectedCategories: [],
    selectedTags: [],
    selectedQuestionSets: [],
    shuffleQuestions: true,
    shuffleAnswers: true,
    showExplanations: true,
    allowReview: true,
    showProgress: true
  })

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

  const handleModeChange = (mode: QuizMode) => {
    const modeConfig = QUIZ_MODE_CONFIG[mode]
    setFormData(prev => ({
      ...prev,
      mode,
      ...modeConfig.defaultConfig,
      timeLimit: mode === 'timed' ? 60 : undefined,
      timePerQuestion: mode === 'timed' ? 90 : undefined
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

  const handleQuestionSetToggle = (setId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedQuestionSets: prev.selectedQuestionSets.includes(setId)
        ? prev.selectedQuestionSets.filter(id => id !== setId)
        : [...prev.selectedQuestionSets, setId]
    }))
  }

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error('Please enter a quiz title')
      return
    }

    if (formData.selectedCategories.length === 0 &&
        formData.selectedQuestionSets.length === 0 &&
        formData.selectedTags.length === 0) {
      toast.error('Please select at least one category, question set, or tag')
      return
    }

    setCreating(true)
    try {
      const response = await fetch('/api/quiz/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
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
          <h1 className="text-3xl font-bold tracking-tight">Create New Quiz</h1>
          <p className="text-muted-foreground">
            Loading quiz options...
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
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
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-4 bg-gray-200 rounded animate-pulse" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (!quizOptions) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create New Quiz</h1>
          <p className="text-muted-foreground text-red-600">
            Failed to load quiz options. Please refresh the page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create New Quiz</h1>
        <p className="text-muted-foreground">
          Customize your learning experience with different modes and settings.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Basic Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Quiz Title</Label>
                <Input
                  id="title"
                  placeholder="Enter quiz title..."
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Number of Questions</Label>
                  <div className="space-y-2">
                    <Slider
                      value={[formData.questionCount]}
                      onValueChange={([value]) => setFormData(prev => ({ ...prev, questionCount: value }))}
                      max={100}
                      min={5}
                      step={5}
                      className="w-full"
                    />
                    <div className="text-sm text-muted-foreground text-center">
                      {formData.questionCount} questions
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Difficulty</Label>
                  <Select 
                    value={formData.difficulty} 
                    onValueChange={(value: QuizDifficulty) => setFormData(prev => ({ ...prev, difficulty: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(QUIZ_DIFFICULTY_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <span>{config.icon}</span>
                            <span>{config.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quiz Mode Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Quiz Mode
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(QUIZ_MODE_CONFIG).map(([key, config]) => (
                  <div
                    key={key}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      formData.mode === key 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => handleModeChange(key as QuizMode)}
                  >
                    <div className="text-2xl mb-2">{config.icon}</div>
                    <h3 className="font-semibold mb-1">{config.label}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{config.description}</p>
                    <div className="space-y-1">
                      {config.features.map((feature, index) => (
                        <div key={index} className="text-xs text-muted-foreground">
                          • {feature}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Time Settings */}
          {formData.mode === 'timed' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Time Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Total Time Limit (minutes)</Label>
                    <Input
                      type="number"
                      value={formData.timeLimit || ''}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        timeLimit: e.target.value ? parseInt(e.target.value) : undefined 
                      }))}
                      placeholder="60"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Time per Question (seconds)</Label>
                    <Input
                      type="number"
                      value={formData.timePerQuestion || ''}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        timePerQuestion: e.target.value ? parseInt(e.target.value) : undefined 
                      }))}
                      placeholder="90"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Question Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Question Selection
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="categories" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="categories">Categories</TabsTrigger>
                  <TabsTrigger value="sets">Question Sets</TabsTrigger>
                </TabsList>
                
                <TabsContent value="categories" className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {quizOptions.categories.map((category) => (
                      <div
                        key={category.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-all ${
                          formData.selectedCategories.includes(category.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => handleCategoryToggle(category.id)}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{category.name}</span>
                          <Badge variant="secondary">{category.questionCount}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  {quizOptions.categories.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No categories available
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="sets" className="space-y-4">
                  <div className="space-y-3">
                    {quizOptions.questionSets.map((set) => (
                      <div
                        key={set.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-all ${
                          formData.selectedQuestionSets.includes(set.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => handleQuestionSetToggle(set.id)}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{set.name}</span>
                          <Badge variant="secondary">{set.questionCount} questions</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  {quizOptions.questionSets.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No question sets available
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Settings Panel */}
        <div className="space-y-6">
          {/* Quiz Options */}
          <Card>
            <CardHeader>
              <CardTitle>Quiz Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Shuffle className="h-4 w-4" />
                    Shuffle Questions
                  </Label>
                  <p className="text-sm text-muted-foreground">Randomize question order</p>
                </div>
                <Switch
                  checked={formData.shuffleQuestions}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, shuffleQuestions: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Shuffle Answers
                  </Label>
                  <p className="text-sm text-muted-foreground">Randomize answer options</p>
                </div>
                <Switch
                  checked={formData.shuffleAnswers}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, shuffleAnswers: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Show Explanations
                  </Label>
                  <p className="text-sm text-muted-foreground">Display explanations after answers</p>
                </div>
                <Switch
                  checked={formData.showExplanations}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, showExplanations: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Allow Review
                  </Label>
                  <p className="text-sm text-muted-foreground">Allow reviewing previous questions</p>
                </div>
                <Switch
                  checked={formData.allowReview}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allowReview: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Timer className="h-4 w-4" />
                    Show Progress
                  </Label>
                  <p className="text-sm text-muted-foreground">Display progress indicator</p>
                </div>
                <Switch
                  checked={formData.showProgress}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, showProgress: checked }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Quiz Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Mode:</span>
                <span className="text-sm font-medium">{QUIZ_MODE_CONFIG[formData.mode].label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Questions:</span>
                <span className="text-sm font-medium">{formData.questionCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Difficulty:</span>
                <span className="text-sm font-medium">{QUIZ_DIFFICULTY_CONFIG[formData.difficulty].label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Categories:</span>
                <span className="text-sm font-medium">{formData.selectedCategories.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Question Sets:</span>
                <span className="text-sm font-medium">{formData.selectedQuestionSets.length}</span>
              </div>
              {formData.mode === 'timed' && formData.timeLimit && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Time Limit:</span>
                  <span className="text-sm font-medium">{formData.timeLimit} min</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={handleSubmit}
              className="w-full"
              size="lg"
              disabled={creating}
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
            <Button variant="outline" className="w-full" disabled={creating}>
              Save as Template
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
