// src/features/quiz/hooks/use-quiz-actions.ts

"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { QuizSession, QuizAttempt } from "@/features/quiz/types/quiz"

interface UseQuizActionsProps {
  quizSession: QuizSession | null
  selectedAnswerId: string | null
  firstAnswerId: string | null
  questionStartTime: number
  questionAttempts: Map<string, any>
  setSelectedAnswerId: (id: string | null) => void
  setFirstAnswerId: (id: string | null) => void
  setShowExplanation: (show: boolean) => void
  setQuestionStartTime: (time: number) => void
  setAttempts: (attempts: QuizAttempt[] | ((prev: QuizAttempt[]) => QuizAttempt[])) => void
  setQuizSession: (session: QuizSession | null | ((prev: QuizSession | null) => QuizSession | null)) => void
  setQuestionAttempts: (attempts: Map<string, any> | ((prev: Map<string, any>) => Map<string, any>)) => void
  setIsPaused: (paused: boolean) => void
  setGlobalTimeRemaining: (time: number | null) => void
  loadQuestionState: (questionId: string) => void
}

export function useQuizActions({
  quizSession,
  selectedAnswerId,
  firstAnswerId,
  questionStartTime,
  questionAttempts,
  setSelectedAnswerId,
  setFirstAnswerId,
  setShowExplanation,
  setQuestionStartTime,
  setAttempts,
  setQuizSession,
  setQuestionAttempts,
  setIsPaused,
  setGlobalTimeRemaining,
  loadQuestionState
}: UseQuizActionsProps) {
  const router = useRouter()

  const handleAnswerSelect = useCallback(async (answerId: string) => {
    if (!quizSession) return

    const currentQuestion = quizSession.questions[quizSession.currentQuestionIndex]
    const questionState = questionAttempts.get(currentQuestion.id)

    // Track first answer if not already set
    if (!questionState?.firstAnswer && !firstAnswerId) {
      setFirstAnswerId(answerId)
    }

    setSelectedAnswerId(answerId)

    // Auto-submit in tutor mode
    if (quizSession.config.mode === 'tutor' && quizSession.config.showExplanations) {
      await handleSubmitAnswerInternal(answerId)
      setShowExplanation(true)
    }
  }, [quizSession, questionAttempts, firstAnswerId, setFirstAnswerId, setSelectedAnswerId, setShowExplanation])

  const handleSubmitAnswerInternal = useCallback(async (answerId?: string) => {
    if (!quizSession) return

    const answerToSubmit = answerId || selectedAnswerId
    if (!answerToSubmit) {
      toast.error("Please select an answer")
      return
    }

    const currentQuestion = quizSession.questions[quizSession.currentQuestionIndex]
    const questionState = questionAttempts.get(currentQuestion.id)

    // Check if already submitted for this question
    if (questionState?.submitted) {
      console.log("Answer already submitted for this question")
      return
    }

    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000)
    const currentFirstAnswer = firstAnswerId || questionState?.firstAnswer

    try {
      let result: any

      // Check if this is a mock session
      const sessionId = Array.isArray(quizSession.id) ? quizSession.id[0] : quizSession.id
      const isMockSession = sessionId ? (sessionId.startsWith('mock-') || sessionId === 'demo' || sessionId === 'quiz-1') : false

      if (isMockSession) {
        // Handle mock session locally without API call
        const correctOption = currentQuestion.answer_options?.find(opt => opt.is_correct)
        const isCorrect = answerToSubmit === correctOption?.id

        result = {
          data: {
            id: `attempt-${Date.now()}`,
            questionId: currentQuestion.id,
            selectedAnswerId: answerToSubmit,
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
            sessionId: quizSession.id,
            questionId: currentQuestion.id,
            selectedAnswerId: answerToSubmit,
            firstAnswerId: currentFirstAnswer,
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
        id: result.data.id,
        quizSessionId: quizSession.id,
        questionId: currentQuestion.id,
        selectedAnswerId: answerToSubmit,
        isCorrect: result.data.isCorrect,
        timeSpent: result.data.timeSpent,
        attemptedAt: new Date().toISOString(),
        reviewedAt: undefined
      }

      setAttempts(prev => [...prev, attempt])

      // Mark question as submitted
      setQuestionAttempts(prev => {
        const newMap = new Map(prev)
        newMap.set(currentQuestion.id, {
          ...questionState,
          submitted: true,
          showingExplanation: false
        })
        return newMap
      })

      // Only show toast in non-practice modes
      if (quizSession.config.mode !== 'practice') {
        toast.success(result.data.isCorrect ? "Correct!" : "Incorrect")
      }
    } catch (error) {
      console.error('Error submitting answer:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to submit answer')
    }
  }, [quizSession, selectedAnswerId, questionAttempts, questionStartTime, firstAnswerId, setAttempts, setQuestionAttempts])

  const handleSubmitAnswer = useCallback(async () => {
    await handleSubmitAnswerInternal()

    if (quizSession?.config.mode === 'tutor' && quizSession.config.showExplanations) {
      setShowExplanation(true)
    } else {
      handleNextQuestion()
    }
  }, [handleSubmitAnswerInternal, quizSession, setShowExplanation])

  const handleNextQuestion = useCallback(async () => {
    if (!quizSession) return

    const isLastQuestion = quizSession.currentQuestionIndex === quizSession.questions.length - 1
    if (isLastQuestion) {
      handleCompleteQuiz()
      return
    }

    const newIndex = quizSession.currentQuestionIndex + 1

    try {
      // Update server state for real sessions
      if (!quizSession.id.startsWith('mock-')) {
        await fetch(`/api/quiz/sessions/${quizSession.id}`, {
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
        setQuizSession(prev => prev ? ({
          ...prev,
          currentQuestionIndex: newIndex
        }) : null)
      }
    } catch (error) {
      console.error('Error updating quiz progress:', error)
    }

    // Load state for the new question
    const nextQuestion = quizSession.questions[newIndex]
    if (nextQuestion) {
      loadQuestionState(nextQuestion.id)
    }

    setQuestionStartTime(Date.now())
  }, [quizSession, setQuizSession, loadQuestionState, setQuestionStartTime])

  const handlePreviousQuestion = useCallback(async () => {
    if (!quizSession || quizSession.currentQuestionIndex === 0) return

    const newIndex = quizSession.currentQuestionIndex - 1

    try {
      if (!quizSession.id.startsWith('mock-')) {
        await fetch(`/api/quiz/sessions/${quizSession.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            currentQuestionIndex: newIndex
          }),
        })

        setQuizSession(prev => prev ? ({
          ...prev,
          currentQuestionIndex: newIndex
        }) : null)
      }
    } catch (error) {
      console.error('Error updating quiz progress:', error)
    }

    const prevQuestion = quizSession.questions[newIndex]
    if (prevQuestion) {
      loadQuestionState(prevQuestion.id)
    }

    setQuestionStartTime(Date.now())
  }, [quizSession, setQuizSession, loadQuestionState, setQuestionStartTime])

  const handleCompleteQuiz = useCallback(async () => {
    if (!quizSession) return

    try {
      const sessionId = Array.isArray(quizSession.id) ? quizSession.id[0] : quizSession.id
      const isMockSession = sessionId ? (sessionId.startsWith('mock-') || sessionId === 'demo' || sessionId === 'quiz-1') : false

      if (isMockSession) {
        toast.success("Quiz completed!")
        router.push(`/dashboard/quiz/${quizSession.id}/results`)
      } else {
        const response = await fetch(`/api/quiz/sessions/${quizSession.id}/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error('Failed to complete quiz')
        }

        toast.success("Quiz completed!")
        router.push(`/dashboard/quiz/${quizSession.id}/results`)
      }
    } catch (error) {
      console.error('Error completing quiz:', error)
      toast.error('Failed to complete quiz')
    }
  }, [quizSession, router])

  const handlePauseQuiz = useCallback(async () => {
    if (!quizSession) return

    try {
      const response = await fetch(`/api/quiz/sessions/${quizSession.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'pause',
          timeRemaining: null // Will be handled by the hook
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
  }, [quizSession, setIsPaused])

  const handleResumeQuiz = useCallback(async () => {
    if (!quizSession) return

    try {
      const response = await fetch(`/api/quiz/sessions/${quizSession.id}`, {
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
      toast.success("Quiz resumed")
    } catch (error) {
      console.error('Error resuming quiz:', error)
      toast.error('Failed to resume quiz')
    }
  }, [quizSession, setIsPaused])

  const handleStartQuiz = useCallback(async () => {
    if (!quizSession) return

    try {
      const sessionId = Array.isArray(quizSession.id) ? quizSession.id[0] : quizSession.id
      const isMockSession = sessionId ? (sessionId.startsWith('mock-') || sessionId === 'demo' || sessionId === 'quiz-1') : false

      if (isMockSession) {
        setQuizSession(prev => prev ? { ...prev, status: 'in_progress' } : null)
        toast.success("Quiz started!")
      } else {
        const response = await fetch(`/api/quiz/sessions/${quizSession.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'start'
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to start quiz')
        }

        setQuizSession(prev => prev ? { ...prev, status: 'in_progress' } : null)
        toast.success("Quiz started!")
      }
    } catch (error) {
      console.error('Error starting quiz:', error)
      toast.error('Failed to start quiz')
    }
  }, [quizSession, setQuizSession])

  return {
    handleAnswerSelect,
    handleSubmitAnswer,
    handleNextQuestion,
    handlePreviousQuestion,
    handleCompleteQuiz,
    handlePauseQuiz,
    handleResumeQuiz,
    handleStartQuiz
  }
}
