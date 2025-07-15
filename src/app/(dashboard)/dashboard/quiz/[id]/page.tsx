// src/app/(dashboard)/dashboard/quiz/[id]/page.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Progress } from "@/shared/components/ui/progress"
import { Badge } from "@/shared/components/ui/badge"
import {
  ChevronLeft,
  ChevronRight,
  Timer,
  Target,
  Pause,
  Play,
  Check,
  X
} from "lucide-react"
import { QuizSession, QuizAttempt } from "@/features/quiz/types/quiz"
import { ImageCarousel } from "@/features/images/components/image-carousel"
import { toast } from "sonner"
import { QuizSidebar } from "@/features/quiz/components/quiz-sidebar"

export default function QuizSessionPage() {
  const params = useParams()
  const router = useRouter()
  const [quizSession, setQuizSession] = useState<QuizSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null)
  const [firstAnswerId, setFirstAnswerId] = useState<string | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [isPaused, setIsPaused] = useState(false)
  const [questionAttempts, setQuestionAttempts] = useState<Map<string, {
    firstAnswer: string | null,
    finalAnswer: string | null,
    submitted: boolean,
    showingExplanation: boolean
  }>>(new Map())

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
        setIsPaused(result.data.status === 'paused')
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

  // Define handleAutoSubmit before it's used in useEffect
  const handleAutoSubmit = useCallback(() => {
    if (selectedAnswerId) {
      // handleSubmitAnswer() will be defined later
      console.log('Auto-submitting with answer:', selectedAnswerId)
    } else {
      // handleNextQuestion() will be defined later
      console.log('Auto-submitting with no answer')
    }
  }, [selectedAnswerId])

  // Timer effect for timed quizzes - must be before early returns
  useEffect(() => {
    if (quizSession?.config.timing === 'timed' && quizSession?.config.timePerQuestion) {
      setTimeRemaining(quizSession.config.timePerQuestion)

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
  }, [quizSession?.currentQuestionIndex, quizSession?.config.timing, quizSession?.config.timePerQuestion, handleAutoSubmit])

  // Load question state when navigating to a question
  const loadQuestionState = useCallback((questionId: string) => {
    const questionState = questionAttempts.get(questionId)
    if (questionState) {
      setSelectedAnswerId(questionState.finalAnswer)
      setFirstAnswerId(questionState.firstAnswer)
      setShowExplanation(questionState.showingExplanation)
    } else {
      setSelectedAnswerId(null)
      setFirstAnswerId(null)
      setShowExplanation(false)
    }
  }, [questionAttempts])

  // Save question state when leaving a question
  const saveQuestionState = useCallback((questionId: string) => {
    setQuestionAttempts(prev => {
      const newMap = new Map(prev)
      const currentState = newMap.get(questionId) || {
        firstAnswer: firstAnswerId,
        finalAnswer: selectedAnswerId,
        submitted: false,
        showingExplanation: showExplanation
      }

      newMap.set(questionId, {
        ...currentState,
        finalAnswer: selectedAnswerId,
        showingExplanation: showExplanation
      })
      return newMap
    })
  }, [firstAnswerId, selectedAnswerId, showExplanation])

  // Check if this is a mock session (for development)
  const sessionId = Array.isArray(params.id) ? params.id[0] : params.id
  const isMockSession = sessionId ? (sessionId.startsWith('mock-') || sessionId === 'demo' || sessionId === 'quiz-1') : false

  // Mock quiz session data for development
  const mockQuizSession: QuizSession = {
    id: sessionId || 'mock-session',
    userId: "user-1",
    title: "Renal Pathology Quiz",
    config: {
      mode: 'tutor',
      timing: 'untimed',
      questionCount: 20,
      questionType: 'all',
      categorySelection: 'all',
      selectedCategories: [],
      shuffleQuestions: false,
      shuffleAnswers: false,
      showProgress: true,
      showExplanations: true,
      timePerQuestion: 120
    },
    questions: [
      {
        id: "q1",
        title: "Glomerular Disease Classification",
        stem: "A 45-year-old patient presents with proteinuria and hematuria. The kidney biopsy shows the following findings. What is the most likely diagnosis?",
        difficulty: "medium",
        teaching_point: "Focal segmental glomerulosclerosis (FSGS) is characterized by sclerosis affecting some but not all glomeruli, and involving only part of the glomerular tuft.",
        question_references: "Kidney Disease: Improving Global Outcomes (KDIGO) Guidelines",
        status: "published",
        created_by: "user-1",
        updated_by: "user-1",
        version: 1,
        question_set_id: null,
        category_id: "cat-1",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        question_options: [
          {
            id: "opt1",
            question_id: "q1",
            text: "Minimal change disease",
            is_correct: false,
            explanation: "Minimal change disease typically shows normal glomeruli on light microscopy.",
            order_index: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: "opt2",
            question_id: "q1",
            text: "Focal segmental glomerulosclerosis",
            is_correct: true,
            explanation: "Correct! The segmental sclerosis in some glomeruli is pathognomonic for FSGS.",
            order_index: 2,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: "opt3",
            question_id: "q1",
            text: "Membranous nephropathy",
            is_correct: false,
            explanation: "Membranous nephropathy shows thickened basement membranes with spikes.",
            order_index: 3,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: "opt4",
            question_id: "q1",
            text: "IgA nephropathy",
            is_correct: false,
            explanation: "IgA nephropathy shows mesangial proliferation and IgA deposits.",
            order_index: 4,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: "opt5",
            question_id: "q1",
            text: "Acute tubular necrosis",
            is_correct: false,
            explanation: "ATN affects tubules, not glomeruli.",
            order_index: 5,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ],
        question_images: [],
        tags: [
          { id: "tag1", name: "glomerular", created_at: new Date().toISOString() },
          { id: "tag2", name: "proteinuria", created_at: new Date().toISOString() },
          { id: "tag3", name: "FSGS", created_at: new Date().toISOString() }
        ]
      }
    ],
    currentQuestionIndex: 0,
    totalQuestions: 1,
    startedAt: new Date().toISOString(),
    status: 'in_progress',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  // Use the fetched quiz session or fallback to mock for development
  const currentSession = quizSession || mockQuizSession
  const currentQuestion = currentSession.questions[currentSession.currentQuestionIndex]
  const isLastQuestion = currentSession.currentQuestionIndex === currentSession.questions.length - 1
  const progress = ((currentSession.currentQuestionIndex + 1) / currentSession.totalQuestions) * 100

  // Calculate mock quiz results
  const calculateMockResults = useCallback(() => {
    const totalQuestions = currentSession.questions.length
    const correctAnswers = attempts.filter(attempt => attempt.isCorrect).length
    const score = Math.round((correctAnswers / totalQuestions) * 100)
    const totalTimeSpent = attempts.reduce((sum, attempt) => sum + (attempt.timeSpent || 0), 0)
    const averageTimePerQuestion = Math.round(totalTimeSpent / totalQuestions)

    // Calculate difficulty breakdown
    const difficultyBreakdown = {
      easy: { correct: 0, total: 0 },
      medium: { correct: 0, total: 0 },
      hard: { correct: 0, total: 0 }
    }

    currentSession.questions.forEach(question => {
      const difficulty = question.difficulty as 'easy' | 'medium' | 'hard'
      const attempt = attempts.find(a => a.questionId === question.id)

      difficultyBreakdown[difficulty].total++
      if (attempt?.isCorrect) {
        difficultyBreakdown[difficulty].correct++
      }
    })

    return {
      sessionId: currentSession.id,
      score,
      correctAnswers,
      totalQuestions,
      totalTimeSpent,
      averageTimePerQuestion,
      difficultyBreakdown,
      categoryBreakdown: [], // Simplified for mock
      attempts,
      completedAt: new Date().toISOString()
    }
  }, [attempts, currentSession.id, currentSession.questions])

  // Load question state when current question changes
  useEffect(() => {
    if (currentQuestion) {
      loadQuestionState(currentQuestion.id)
    }
  }, [currentQuestion?.id, loadQuestionState])

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









  const handleAnswerSelect = async (answerId: string) => {
    const questionId = currentQuestion.id
    const questionState = questionAttempts.get(questionId)

    // Track first answer if this is the first selection for this question
    if (!questionState?.firstAnswer && !firstAnswerId) {
      setFirstAnswerId(answerId)
    }

    setSelectedAnswerId(answerId)

    // In practice mode, just select the answer (no immediate explanation)
    // In tutor mode, show explanation immediately after selection
    if (currentSession.config.mode === 'tutor' && currentSession.config.showExplanations) {
      await handleSubmitAnswerInternal(answerId)
      setShowExplanation(true)
    }
    // In practice mode, user needs to click submit button or will auto-submit on next question
  }



  const handleSubmitAnswerInternal = async (answerId?: string) => {
    const answerToSubmit = answerId || selectedAnswerId
    const questionId = currentQuestion.id

    if (!answerToSubmit) {
      toast.error("Please select an answer")
      return
    }

    // Check if already submitted for this question
    const questionState = questionAttempts.get(questionId)
    if (questionState?.submitted) {
      console.log("Answer already submitted for this question")
      return
    }

    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000)
    const currentFirstAnswer = firstAnswerId || questionState?.firstAnswer || null

    try {
      let result: { isCorrect: boolean; correctAnswerId?: string; data?: any }

      if (isMockSession) {
        // Handle mock session locally without API call
        const correctOption = currentQuestion.question_options?.find(opt => opt.is_correct)
        const isCorrect = answerToSubmit === correctOption?.id

        result = {
          isCorrect,
          data: {
            attemptId: `mock-attempt-${Date.now()}`,
            isCorrect,
            timeSpent
          }
        }
      } else {
        // Make API call for real sessions
        const response = await fetch('/api/quiz/attempts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: currentSession.id,
            questionId: currentQuestion.id,
            selectedAnswerId: answerToSubmit,
            firstAnswerId: currentFirstAnswer, // Track first answer
            timeSpent
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to submit answer')
        }

        result = await response.json()
      }

      // Add attempt to local state
      const attempt: QuizAttempt = {
        id: result.data.attemptId,
        quizSessionId: currentSession.id,
        questionId: currentQuestion.id,
        selectedAnswerId: answerToSubmit,
        isCorrect: result.data.isCorrect,
        timeSpent: result.data.timeSpent,
        attemptedAt: new Date().toISOString(),
        reviewedAt: undefined
      }

      setAttempts(prev => [...prev, attempt])

      // Mark as submitted in question state
      setQuestionAttempts(prev => {
        const newMap = new Map(prev)
        newMap.set(questionId, {
          firstAnswer: currentFirstAnswer,
          finalAnswer: answerToSubmit,
          submitted: true,
          showingExplanation: false
        })
        return newMap
      })

      // Only show toast in non-practice modes
      if (currentSession.config.mode !== 'practice') {
        toast.success(result.data.isCorrect ? "Correct!" : "Incorrect")
      }
    } catch (error) {
      console.error('Error submitting answer:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to submit answer')
    }
  }

  const handleSubmitAnswer = async () => {
    await handleSubmitAnswerInternal()

    // Only show explanations in tutor mode
    if (currentSession.config.mode === 'tutor' && currentSession.config.showExplanations) {
      setShowExplanation(true)
    } else {
      // In practice mode, just move to next question after submitting
      handleNextQuestion()
    }
  }

  const handleNextQuestion = async () => {
    // Save current question state before moving
    saveQuestionState(currentQuestion.id)

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

    // Load state for the new question
    const nextQuestion = currentSession.questions[newIndex]
    if (nextQuestion) {
      loadQuestionState(nextQuestion.id)
    }

    setQuestionStartTime(Date.now())

    if (currentSession.config.timing === 'timed' && currentSession.config.timePerQuestion) {
      setTimeRemaining(currentSession.config.timePerQuestion)
    }
  }

  const handlePreviousQuestion = async () => {
    if (currentSession.currentQuestionIndex > 0) {
      // Save current question state before moving
      saveQuestionState(currentQuestion.id)

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

      // Load state for the previous question
      const prevQuestion = currentSession.questions[newIndex]
      if (prevQuestion) {
        loadQuestionState(prevQuestion.id)
      }

      setQuestionStartTime(Date.now())
    }
  }

  const handlePauseQuiz = async () => {
    try {
      const response = await fetch(`/api/quiz/sessions/${currentSession.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'pause'
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to pause quiz')
      }

      setIsPaused(true)
      toast.success("Quiz paused")
    } catch (error) {
      console.error('Error pausing quiz:', error)
      toast.error('Failed to pause quiz')
    }
  }

  const handleResumeQuiz = async () => {
    try {
      const response = await fetch(`/api/quiz/sessions/${currentSession.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'resume'
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to resume quiz')
      }

      setIsPaused(false)
      setQuestionStartTime(Date.now()) // Reset question timer
      toast.success("Quiz resumed")
    } catch (error) {
      console.error('Error resuming quiz:', error)
      toast.error('Failed to resume quiz')
    }
  }

  const handleCompleteQuiz = async () => {
    try {
      if (isMockSession) {
        // Handle mock session completion locally
        const mockResults = calculateMockResults()

        // Store results in localStorage for the results page
        localStorage.setItem(`quiz-results-${currentSession.id}`, JSON.stringify(mockResults))

        toast.success("Quiz completed!")
        router.push(`/dashboard/quiz/${currentSession.id}/results`)
      } else {
        // Handle real session completion via API
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
      }
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

  const handleQuestionNavigation = (questionIndex: number) => {
    // Only allow navigation to previous questions or current question
    if (questionIndex <= currentSession.currentQuestionIndex) {
      if (quizSession) {
        setQuizSession(prev => ({
          ...prev!,
          currentQuestionIndex: questionIndex
        }))
      }

      // Reset answer selection for the new question
      setSelectedAnswerId(null)
      setFirstAnswerId(null)
      setShowExplanation(false)

      // Reset timer for the new question
      if (currentSession.config.timing === 'timed') {
        setQuestionStartTime(Date.now())
        setTimeRemaining(currentSession.config.timePerQuestion || 90)
      }
    }
  }

  // Helper to get a letter label for an option ID (like in demo question)
  const getOptionLabel = (optionId: string, index: number) => {
    // For UUIDs or long IDs, use alphabetical labels based on index
    if (optionId.length > 10) {
      return String.fromCharCode(65 + index); // A, B, C, D, etc.
    }
    // Otherwise just use the first character
    return optionId.toString().charAt(0).toUpperCase();
  }



  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto">
      {/* Sidebar */}
      <div className="lg:flex-shrink-0 order-2 lg:order-1">
        <QuizSidebar
          session={currentSession}
          currentQuestionIndex={currentSession.currentQuestionIndex}
          attempts={attempts.map(attempt => ({
            questionId: attempt.questionId,
            selectedAnswerId: attempt.selectedAnswerId ?? null,
            isCorrect: attempt.isCorrect ?? false,
            timeSpent: attempt.timeSpent ?? 0
          }))}
          onQuestionSelect={handleQuestionNavigation}
          timeRemaining={timeRemaining}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-6 order-1 lg:order-2">
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
            {currentSession.config.questionType}
          </Badge>

          {/* Pause/Resume Button */}
          {currentSession.status === 'in_progress' && !isPaused && (
            <Button variant="outline" size="sm" onClick={handlePauseQuiz}>
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
          )}
        </div>
      </div>

      {/* Paused Overlay */}
      {isPaused && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <Pause className="h-12 w-12 text-yellow-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-yellow-800">Quiz Paused</h3>
                <p className="text-yellow-700">Your progress has been saved. Click resume to continue.</p>
              </div>
              <Button onClick={handleResumeQuiz} className="bg-yellow-600 hover:bg-yellow-700">
                <Play className="h-4 w-4 mr-2" />
                Resume Quiz
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Question */}
      {!isPaused && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{currentQuestion.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
          <div className="prose max-w-none">
            <p>{currentQuestion.stem}</p>
          </div>

          {/* Question Body Images */}
          {currentQuestion.question_images && currentQuestion.question_images.length > 0 && (
            <div>
              <ImageCarousel
                images={currentQuestion.question_images
                  .filter(qi => qi.question_section === 'stem')
                  .sort((a, b) => a.order_index - b.order_index)
                  .map(qi => ({
                    url: qi.image?.url || '',
                    alt: qi.image?.alt_text || qi.image?.description || 'Question image',
                    caption: qi.image?.description || undefined
                  }))}
                className="border rounded-lg"
              />
            </div>
          )}

          {/* Answer Options - Demo Question Style */}
          <div className="grid gap-2" role="listbox" aria-label="Answer options">
            {currentQuestion.answer_options?.map((option, index) => {
              const isSelected = selectedAnswerId === option.id;
              const showCorrect = showExplanation && option.is_correct;
              const showIncorrect = showExplanation && isSelected && !option.is_correct;
              const optionLabel = getOptionLabel(option.id, index);

              return (
                <button
                  key={option.id}
                  onClick={() => !showExplanation && handleAnswerSelect(option.id)}
                  className={`
                    p-3 rounded-md text-left border text-sm transition-all
                    ${!showExplanation ? 'hover:border-primary/50 hover:bg-primary/5' : ''}
                    ${isSelected ? 'border-primary' : 'border'}
                    ${showCorrect ? 'bg-green-50 border-green-500 dark:bg-green-950/30' : ''}
                    ${showIncorrect ? 'bg-red-50 border-red-500 dark:bg-red-950/30' : ''}
                  `}
                  disabled={showExplanation}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="flex items-center gap-3">
                    <span className={`
                      flex items-center justify-center w-6 h-6 rounded-full border text-xs font-medium
                      ${isSelected ? 'border-primary' : 'border-muted-foreground/30'}
                      ${showCorrect ? 'border-green-500 bg-green-100 text-green-700' : ''}
                      ${showIncorrect ? 'border-red-500 bg-red-100 text-red-700' : ''}
                    `}>
                      {optionLabel}
                    </span>
                    <span className="flex-1">{option.text}</span>
                    {showCorrect && <Check className="w-4 h-4 text-green-500" />}
                    {showIncorrect && <X className="w-4 h-4 text-red-500" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Explanation Section - Demo Question Style */}
          {showExplanation && (
            <div className="p-4 rounded-lg bg-muted/50 text-sm space-y-4">
              {/* Teaching Point */}
              {currentQuestion.teaching_point && (
                <div>
                  <h4 className="font-medium text-xs uppercase mb-2">Teaching Point</h4>
                  <div className="text-muted-foreground">
                    {currentQuestion.teaching_point}
                  </div>
                </div>
              )}

              {/* Individual Option Explanations */}
              {currentQuestion.answer_options?.some(opt => opt.explanation) && (
                <div>
                  <h4 className="font-medium text-xs uppercase mb-2">Answer Explanations</h4>
                  <div className="space-y-2 text-muted-foreground">
                    {currentQuestion.answer_options
                      ?.filter(opt => opt.explanation)
                      .map((option, index) => (
                        <div key={option.id} className="flex gap-2">
                          <span className="font-medium">
                            {getOptionLabel(option.id, currentQuestion.answer_options?.findIndex(opt => opt.id === option.id) || index)}.
                          </span>
                          <span>{option.explanation}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Explanation Images */}
              {currentQuestion.question_images && currentQuestion.question_images.some(qi => qi.question_section === 'explanation') && (
                <div>
                  <h4 className="font-medium text-xs uppercase mb-2">Reference Images</h4>
                  <ImageCarousel
                    images={currentQuestion.question_images
                      .filter(qi => qi.question_section === 'explanation')
                      .sort((a, b) => a.order_index - b.order_index)
                      .map(qi => ({
                        url: qi.image?.url || '',
                        alt: qi.image?.alt_text || qi.image?.description || 'Reference image',
                        caption: qi.image?.description || undefined
                      }))}
                    className="bg-white border rounded-lg"
                  />
                </div>
              )}

              {/* References */}
              {currentQuestion.question_references && (
                <div className="text-xs text-muted-foreground">
                  <h4 className="font-medium uppercase mb-1">References</h4>
                  <div className="break-words">
                    {currentQuestion.question_references}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Navigation */}
      {!isPaused && (
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handlePreviousQuestion}
          disabled={currentSession.currentQuestionIndex === 0}
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
              {isLastQuestion ? 'Complete Quiz' : 'Next'}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}

          {!showExplanation && !selectedAnswerId && currentSession.config.timing !== 'timed' && (
            <Button variant="outline" onClick={handleNextQuestion}>
              Skip Question
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
      )}
      </div>
    </div>
  )
}
