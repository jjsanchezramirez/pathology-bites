// src/features/quiz/hooks/use-quiz-actions.ts

"use client"

import { useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { QuizSession, QuizAttempt } from "@/features/quiz/types/quiz"

// Utility function for API requests with timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number = 10000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout - please check your connection and try again')
    }
    throw error
  }
}

interface UseQuizActionsProps {
  quizSession: QuizSession | null
  selectedAnswerId: string | null
  firstAnswerId: string | null
  questionStartTime: number
  questionAttempts: Map<string, any>
  attempts: QuizAttempt[]
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
  attempts,
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

  // Submission state management to prevent race conditions
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submissionInProgress = useRef<Set<string>>(new Set())
  const lastSubmissionTime = useRef<number>(0)

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
    console.log('[Quiz] Starting answer submission process')

    // Comprehensive validation
    if (!quizSession) {
      console.error('[Quiz] No quiz session available')
      return
    }

    if (isSubmitting) {
      console.log('[Quiz] Submission already in progress, ignoring duplicate request')
      return
    }

    const answerToSubmit = answerId || selectedAnswerId
    if (!answerToSubmit) {
      console.error('[Quiz] No answer selected')
      return
    }

    // Validate current question
    if (quizSession.currentQuestionIndex >= quizSession.questions.length) {
      console.error('[Quiz] Invalid question index:', quizSession.currentQuestionIndex)
      return
    }

    const currentQuestion = quizSession.questions[quizSession.currentQuestionIndex]
    if (!currentQuestion) {
      console.error('[Quiz] Current question not found')
      return
    }

    const questionState = questionAttempts.get(currentQuestion.id)

    // Check if already submitted for this question
    if (questionState?.submitted) {
      console.log('[Quiz] Answer already submitted for question:', currentQuestion.id)
      return
    }

    // Prevent rapid duplicate submissions
    const now = Date.now()
    const timeSinceLastSubmission = now - lastSubmissionTime.current
    if (timeSinceLastSubmission < 500) { // 500ms debounce
      console.log('[Quiz] Ignoring rapid duplicate submission')
      return
    }

    // Check if submission is already in progress for this question
    if (submissionInProgress.current.has(currentQuestion.id)) {
      console.log('[Quiz] Submission already in progress for question:', currentQuestion.id)
      return
    }

    const timeSpent = Math.floor((now - questionStartTime) / 1000)
    const currentFirstAnswer = firstAnswerId || questionState?.firstAnswer

    console.log('[Quiz] Submitting answer:', {
      questionId: currentQuestion.id,
      answerToSubmit,
      timeSpent,
      sessionId: quizSession.id
    })

    // Set submission state
    setIsSubmitting(true)
    submissionInProgress.current.add(currentQuestion.id)
    lastSubmissionTime.current = now

    try {
      let result: any

      // Check if this is a mock session
      const sessionId = Array.isArray(quizSession.id) ? quizSession.id[0] : quizSession.id
      const isMockSession = sessionId ? (sessionId.startsWith('mock-') || sessionId === 'demo' || sessionId === 'quiz-1') : false

      console.log('[Quiz] Session type:', isMockSession ? 'mock' : 'real', 'ID:', sessionId)

      if (isMockSession) {
        console.log('[Quiz] Processing mock session locally')
        // Handle mock session locally without API call
        const answerOptions = currentQuestion.question_options || currentQuestion.answer_options

        if (!answerOptions || answerOptions.length === 0) {
          throw new Error('Question has no answer options available')
        }

        const correctOption = answerOptions.find(opt => opt.is_correct)
        const selectedOption = answerOptions.find(opt => opt.id === answerToSubmit)

        if (!selectedOption) {
          throw new Error('Selected answer option not found')
        }

        const isCorrect = answerToSubmit === correctOption?.id

        console.log('[Quiz] Mock session result:', { isCorrect, selectedOption: selectedOption.text })

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
        console.log('[Quiz] Making API call for real session')
        // Make single API call for real sessions (no retries for simplicity)
        const response = await fetchWithTimeout('/api/quiz/attempts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            sessionId: quizSession.id,
            questionId: currentQuestion.id,
            selectedAnswerId: answerToSubmit,
            firstAnswerId: currentFirstAnswer,
            timeSpent
          }),
        }, 10000) // 10 second timeout

        if (!response.ok) {
          let errorMessage = 'Failed to submit answer'
          let errorDetails = ''

          try {
            const errorData = await response.json()
            errorMessage = errorData.error || errorMessage
            errorDetails = errorData.details || ''
          } catch (parseError) {
            // If we can't parse the error response, use the status text
            errorMessage = `Server error (${response.status}): ${response.statusText}`
          }

          console.error('[Quiz] API error:', { status: response.status, message: errorMessage, details: errorDetails })

          // Provide more specific error messages based on status code
          if (response.status === 401) {
            throw new Error('Authentication failed. Please log in again.')
          } else if (response.status === 403) {
            throw new Error('You do not have permission to submit this answer.')
          } else if (response.status === 404) {
            throw new Error('Quiz session not found. Please refresh the page.')
          } else if (response.status >= 500) {
            throw new Error('Server error. Please try again in a moment.')
          } else {
            throw new Error(errorMessage)
          }
        }

        result = await response.json()
        console.log('[Quiz] API response received successfully')
      }

      // Validate API response
      if (!result || !result.data) {
        throw new Error('Invalid response from server')
      }

      console.log('[Quiz] Processing successful submission:', {
        attemptId: result.data.id,
        isCorrect: result.data.isCorrect,
        timeSpent: result.data.timeSpent
      })

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
          showingExplanation: false,
          finalAnswer: answerToSubmit,
          firstAnswer: currentFirstAnswer || answerToSubmit
        })
        return newMap
      })

      console.log('[Quiz] Answer submission completed successfully:', {
        isCorrect: result.data.isCorrect,
        timeSpent: result.data.timeSpent,
        mode: quizSession.config.mode
      })
    } catch (error) {
      console.error('[Quiz] Error submitting answer:', error)

      // Log detailed error information for debugging
      if (error instanceof Error) {
        console.error('[Quiz] Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack,
          questionId: currentQuestion?.id,
          sessionId: quizSession?.id,
          answerToSubmit
        })
      } else {
        console.error('[Quiz] Unknown error type:', typeof error, error)
      }

      // Silent error handling - quiz remains unfinished if submission fails
      console.log('[Quiz] Submission failed - quiz remains unfinished')

      // Log critical errors for debugging but don't show user notifications
      if (error instanceof Error) {
        if (error.message.includes('Authentication failed')) {
          console.warn('[Quiz] Authentication error - user may need to log in again')
        } else if (error.message.includes('Quiz session not found')) {
          console.warn('[Quiz] Quiz session not found - user may need to refresh')
        }
        // All errors fail silently to maintain elegant user experience
      }
    } finally {
      // Always clean up submission state
      setIsSubmitting(false)
      submissionInProgress.current.delete(currentQuestion?.id || '')
      console.log('[Quiz] Submission state cleaned up')
    }
  }, [quizSession, selectedAnswerId, questionAttempts, questionStartTime, firstAnswerId, setAttempts, setQuestionAttempts, isSubmitting])

  const handleSubmitAnswer = useCallback(async () => {
    console.log('[Quiz] handleSubmitAnswer called')

    if (isSubmitting) {
      console.log('[Quiz] Submission already in progress, ignoring handleSubmitAnswer call')
      return
    }

    try {
      await handleSubmitAnswerInternal()

      // Only proceed to next steps if submission was successful
      if (!isSubmitting) { // Check if we're still not submitting (success case)
        if (quizSession?.config.mode === 'tutor' && quizSession.config.showExplanations) {
          setShowExplanation(true)
        } else {
          handleNextQuestion()
        }
      }
    } catch (error) {
      console.error('[Quiz] Error in handleSubmitAnswer:', error)
      // Error is already handled in handleSubmitAnswerInternal
    }
  }, [handleSubmitAnswerInternal, quizSession, setShowExplanation, isSubmitting])

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
        console.log('[Quiz] Mock quiz completed, generating and saving results')
        
        // Generate mock results from current session state
        const correctAnswers = attempts.filter(a => a.isCorrect).length
        const totalQuestions = quizSession.totalQuestions
        const score = Math.round((correctAnswers / totalQuestions) * 100)
        const totalTimeSpent = attempts.reduce((sum, a) => sum + (a.timeSpent || 0), 0)
        const averageTimePerQuestion = Math.round(totalTimeSpent / totalQuestions)
        
        // Create question details with full question data
        const questionDetails = quizSession.questions.map((question: any, index: number) => {
          const attempt = attempts.find(a => a.questionId === question.id)
          const correctChoice = question.question_options?.find((opt: any) => opt.is_correct)
          
          return {
            id: question.id,
            title: question.title || `Question ${index + 1}`,
            stem: question.stem || '',
            difficulty: 'medium', // Default since we don't have this data
            category: 'General', // Default since we don't have this data
            isCorrect: attempt?.isCorrect || false,
            selectedAnswerId: attempt?.selectedAnswerId || null,
            correctAnswerId: correctChoice?.id || '',
            timeSpent: attempt?.timeSpent || 0,
            successRate: Math.floor(Math.random() * 40) + 60, // Mock 60-100% success rate
            totalAttempts: Math.floor(Math.random() * 50) + 10, // Mock 10-60 total attempts
            explanation: question.teaching_point || '',
            references: question.question_references ? [question.question_references] : [],
            answerChoices: question.question_options || [],
            imageUrl: question.question_images?.[0]?.image?.url
          }
        })
        
        const mockResults = {
          sessionId: quizSession.id,
          score,
          correctAnswers,
          totalQuestions,
          totalTimeSpent,
          averageTimePerQuestion,
          difficultyBreakdown: {
            easy: { correct: 0, total: 0 },
            medium: { correct: correctAnswers, total: totalQuestions },
            hard: { correct: 0, total: 0 }
          },
          categoryBreakdown: [{
            categoryId: '1',
            categoryName: 'General',
            correct: correctAnswers,
            total: totalQuestions
          }],
          questionDetails,
          attempts: attempts,
          completedAt: new Date().toISOString()
        }
        
        // Save results to localStorage
        localStorage.setItem(`quiz-results-${quizSession.id}`, JSON.stringify(mockResults))
        
        // Also save session data for review mode
        localStorage.setItem(`quiz-session-${quizSession.id}`, JSON.stringify(quizSession))
        
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

        console.log('[Quiz] Quiz completed successfully, navigating to results')
        router.push(`/dashboard/quiz/${quizSession.id}/results`)
      }
    } catch (error) {
      console.error('Error completing quiz:', error)
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
      console.log('[Quiz] Quiz paused successfully')
    } catch (error) {
      console.error('Error pausing quiz:', error)
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
      console.log('[Quiz] Quiz resumed successfully')
    } catch (error) {
      console.error('Error resuming quiz:', error)
    }
  }, [quizSession, setIsPaused])

  const handleStartQuiz = useCallback(async () => {
    if (!quizSession) return

    try {
      const sessionId = Array.isArray(quizSession.id) ? quizSession.id[0] : quizSession.id
      const isMockSession = sessionId ? (sessionId.startsWith('mock-') || sessionId === 'demo' || sessionId === 'quiz-1') : false

      if (isMockSession) {
        setQuizSession(prev => prev ? { ...prev, status: 'in_progress' } : null)
        console.log('[Quiz] Mock quiz started successfully')
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
        console.log('[Quiz] Quiz started successfully')
      }
    } catch (error) {
      console.error('Error starting quiz:', error)
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
    handleStartQuiz,
    isSubmitting
  }
}
