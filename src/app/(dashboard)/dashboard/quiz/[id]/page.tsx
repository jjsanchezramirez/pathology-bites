// src/app/(dashboard)/dashboard/quiz/[id]/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Progress } from "@/shared/components/ui/progress"
import { Badge } from "@/shared/components/ui/badge"
import { 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Flag, 
  CheckCircle,
  XCircle,
  Eye,
  RotateCcw,
  Timer,
  Target
} from "lucide-react"
import { QuizSession, QuizAttempt } from "@/features/quiz/types/quiz"
import { toast } from "sonner"

export default function QuizSessionPage() {
  const params = useParams()
  const router = useRouter()
  const [quizSession, setQuizSession] = useState<QuizSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])

  // Fetch quiz session on component mount
  useEffect(() => {
    const fetchQuizSession = async () => {
      try {
        const response = await fetch(`/api/quiz/sessions/${params.id}`)
        if (!response.ok) {
          throw new Error('Failed to fetch quiz session')
        }
        const result = await response.json()
        setQuizSession(result.data)
      } catch (error) {
        console.error('Error fetching quiz session:', error)
        toast.error('Failed to load quiz session')
        router.push('/dashboard')
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchQuizSession()
    }
  }, [params.id, router])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 bg-gray-200 rounded animate-pulse w-64" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-48 mt-2" />
          </div>
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded animate-pulse w-48" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!quizSession) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-red-600">Quiz Not Found</h1>
          <p className="text-muted-foreground mt-2">
            The quiz session you're looking for doesn't exist or has been deleted.
          </p>
          <Button onClick={() => router.push('/dashboard')} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  // Mock quiz session data for development
  const mockQuizSession: QuizSession = {
  id: "quiz-1",
  userId: "user-1",
  title: "Renal Pathology Quiz",
  config: {
    mode: 'tutor',
    questionCount: 20,
    difficulty: 'medium',
    shuffleQuestions: true,
    shuffleAnswers: true,
    showExplanations: true,
    allowReview: true,
    showProgress: true
  },
  questions: [
    {
      id: "q1",
      title: "Glomerular Disease",
      stem: "A 45-year-old patient presents with proteinuria and hematuria. The kidney biopsy shows the following findings. What is the most likely diagnosis?",
      difficulty: "medium",
      teaching_point: "This case demonstrates the classic features of membranous nephropathy.",
      question_references: "Robbins Pathology, 10th edition, Chapter 20",
      status: "published",
      created_by: "expert-1",
      version: 1,
      question_set_id: "set-1",
      category_id: "cat-1",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      answer_options: [
        {
          id: "a1",
          question_id: "q1",
          text: "Minimal change disease",
          is_correct: false,
          explanation: "Minimal change disease typically shows normal glomeruli on light microscopy.",
          order_index: 1,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z"
        },
        {
          id: "a2",
          question_id: "q1",
          text: "Membranous nephropathy",
          is_correct: true,
          explanation: "Correct! The thickened basement membrane with subepithelial deposits is characteristic of membranous nephropathy.",
          order_index: 2,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z"
        },
        {
          id: "a3",
          question_id: "q1",
          text: "Focal segmental glomerulosclerosis",
          is_correct: false,
          explanation: "FSGS shows segmental sclerosis, not the diffuse basement membrane changes seen here.",
          order_index: 3,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z"
        },
        {
          id: "a4",
          question_id: "q1",
          text: "IgA nephropathy",
          is_correct: false,
          explanation: "IgA nephropathy typically shows mesangial proliferation and IgA deposits.",
          order_index: 4,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z"
        }
      ],
      question_images: []
    }
  ],
  currentQuestionIndex: 0,
  status: 'in_progress',
  startedAt: new Date().toISOString(),
  totalQuestions: 20,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

  // Use the fetched quiz session or fallback to mock for development
  const currentSession = quizSession || mockQuizSession
  const currentQuestion = currentSession.questions[currentSession.currentQuestionIndex]
  const isLastQuestion = currentSession.currentQuestionIndex === currentSession.questions.length - 1
  const progress = ((currentSession.currentQuestionIndex + 1) / currentSession.totalQuestions) * 100

  // Timer effect for timed quizzes
  useEffect(() => {
    if (currentSession.config.mode === 'timed' && currentSession.config.timePerQuestion) {
      setTimeRemaining(currentSession.config.timePerQuestion)

      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev === null || prev <= 1) {
            handleAutoSubmit()
            return null
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [currentSession.currentQuestionIndex])

  const handleAnswerSelect = (answerId: string) => {
    setSelectedAnswerId(answerId)

    if (currentSession.config.mode === 'tutor' && currentSession.config.showExplanations) {
      setShowExplanation(true)
    }
  }

  const handleAutoSubmit = () => {
    if (selectedAnswerId) {
      handleSubmitAnswer()
    } else {
      // Auto-submit with no answer
      handleNextQuestion()
    }
  }

  const handleSubmitAnswer = async () => {
    if (!selectedAnswerId) {
      toast.error("Please select an answer")
      return
    }

    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000)

    try {
      const response = await fetch('/api/quiz/attempts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: currentSession.id,
          questionId: currentQuestion.id,
          selectedAnswerId,
          timeSpent
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit answer')
      }

      const result = await response.json()

      // Add attempt to local state
      const attempt: QuizAttempt = {
        id: result.data.attemptId,
        quizSessionId: currentSession.id,
        questionId: currentQuestion.id,
        selectedAnswerId,
        isCorrect: result.data.isCorrect,
        timeSpent: result.data.timeSpent,
        attemptedAt: new Date().toISOString()
      }

      setAttempts(prev => [...prev, attempt])

      if (currentSession.config.showExplanations) {
        setShowExplanation(true)
      } else {
        handleNextQuestion()
      }
    } catch (error) {
      console.error('Error submitting answer:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to submit answer')
    }
  }

  const handleNextQuestion = async () => {
    if (isLastQuestion) {
      handleCompleteQuiz()
      return
    }

    const newIndex = currentSession.currentQuestionIndex + 1

    try {
      // Update session progress
      await fetch(`/api/quiz/sessions/${currentSession.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentQuestionIndex: newIndex,
          status: 'in_progress'
        }),
      })

      // Update local state
      if (quizSession) {
        setQuizSession(prev => ({
          ...prev!,
          currentQuestionIndex: newIndex
        }))
      }
    } catch (error) {
      console.error('Error updating quiz progress:', error)
      // Continue anyway for better UX
    }

    setSelectedAnswerId(null)
    setShowExplanation(false)
    setQuestionStartTime(Date.now())

    if (currentSession.config.mode === 'timed' && currentSession.config.timePerQuestion) {
      setTimeRemaining(currentSession.config.timePerQuestion)
    }
  }

  const handlePreviousQuestion = async () => {
    if (currentSession.currentQuestionIndex > 0 && currentSession.config.allowReview) {
      const newIndex = currentSession.currentQuestionIndex - 1

      try {
        // Update session progress
        await fetch(`/api/quiz/sessions/${currentSession.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            currentQuestionIndex: newIndex
          }),
        })

        // Update local state
        if (quizSession) {
          setQuizSession(prev => ({
            ...prev!,
            currentQuestionIndex: newIndex
          }))
        }
      } catch (error) {
        console.error('Error updating quiz progress:', error)
      }

      setSelectedAnswerId(null)
      setShowExplanation(false)
      setQuestionStartTime(Date.now())
    }
  }

  const handleCompleteQuiz = async () => {
    try {
      const response = await fetch(`/api/quiz/sessions/${currentSession.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to complete quiz')
      }

      toast.success("Quiz completed!")
      router.push(`/dashboard/quiz/${currentSession.id}/results`)
    } catch (error) {
      console.error('Error completing quiz:', error)
      toast.error('Failed to complete quiz')
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getAnswerIcon = (answerId: string) => {
    if (!showExplanation || !selectedAnswerId) return null
    
    const answer = currentQuestion.answer_options?.find(opt => opt.id === answerId)
    if (!answer) return null

    if (answer.is_correct) {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    } else if (answerId === selectedAnswerId) {
      return <XCircle className="h-4 w-4 text-red-500" />
    }
    return null
  }

  const getAnswerStyle = (answerId: string) => {
    if (!showExplanation) {
      return selectedAnswerId === answerId 
        ? 'border-primary bg-primary/5' 
        : 'border-border hover:border-primary/50'
    }

    const answer = currentQuestion.answer_options?.find(opt => opt.id === answerId)
    if (!answer) return 'border-border'

    if (answer.is_correct) {
      return 'border-green-500 bg-green-50'
    } else if (answerId === selectedAnswerId) {
      return 'border-red-500 bg-red-50'
    }
    return 'border-border'
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{currentSession.title}</h1>
          <p className="text-muted-foreground">
            Question {currentSession.currentQuestionIndex + 1} of {currentSession.totalQuestions}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {timeRemaining !== null && (
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4" />
              <span className={`font-mono ${timeRemaining <= 10 ? 'text-red-500' : ''}`}>
                {formatTime(timeRemaining)}
              </span>
            </div>
          )}

          <Badge variant="outline" className="flex items-center gap-1">
            <Target className="h-3 w-3" />
            {currentSession.config.difficulty}
          </Badge>
        </div>
      </div>

      {/* Progress */}
      {currentSession.config.showProgress && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>
      )}

      {/* Question */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{currentQuestion.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="prose max-w-none">
            <p>{currentQuestion.stem}</p>
          </div>

          {/* Answer Options */}
          <div className="space-y-3">
            {currentQuestion.answer_options?.map((option) => (
              <div
                key={option.id}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${getAnswerStyle(option.id)}`}
                onClick={() => !showExplanation && handleAnswerSelect(option.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{option.text}</p>
                    {showExplanation && option.explanation && (
                      <p className="text-sm text-muted-foreground mt-2">{option.explanation}</p>
                    )}
                  </div>
                  {getAnswerIcon(option.id)}
                </div>
              </div>
            ))}
          </div>

          {/* Teaching Point */}
          {showExplanation && currentQuestion.teaching_point && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Teaching Point</h4>
              <p className="text-blue-800">{currentQuestion.teaching_point}</p>
            </div>
          )}

          {/* References */}
          {showExplanation && currentQuestion.question_references && (
            <div className="text-sm text-muted-foreground">
              <strong>Reference:</strong> {currentQuestion.question_references}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handlePreviousQuestion}
          disabled={currentSession.currentQuestionIndex === 0 || !currentSession.config.allowReview}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        <div className="flex gap-2">
          {!showExplanation && selectedAnswerId && (
            <Button onClick={handleSubmitAnswer}>
              Submit Answer
            </Button>
          )}
          
          {showExplanation && (
            <Button onClick={handleNextQuestion}>
              {isLastQuestion ? 'Complete Quiz' : 'Next Question'}
              {!isLastQuestion && <ChevronRight className="h-4 w-4 ml-2" />}
            </Button>
          )}
          
          {!showExplanation && !selectedAnswerId && currentSession.config.mode !== 'timed' && (
            <Button variant="outline" onClick={handleNextQuestion}>
              Skip Question
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
