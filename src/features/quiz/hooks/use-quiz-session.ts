// src/features/quiz/hooks/use-quiz-session.ts

"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { QuizSession, QuizAttempt } from "@/features/quiz/types/quiz"

interface UseQuizSessionProps {
  sessionId: string | undefined
}

export function useQuizSession({ sessionId }: UseQuizSessionProps) {
  const router = useRouter()
  const [quizSession, setQuizSession] = useState<QuizSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null)
  const [firstAnswerId, setFirstAnswerId] = useState<string | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [globalTimeRemaining, setGlobalTimeRemaining] = useState<number | null>(null)
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [isPaused, setIsPaused] = useState(false)
  const [flagDialogOpen, setFlagDialogOpen] = useState(false)

  // Question state management
  const [questionAttempts, setQuestionAttempts] = useState<Map<string, {
    firstAnswer: string | null,
    finalAnswer: string | null,
    submitted: boolean,
    showingExplanation: boolean
  }>>(new Map())

  // Load quiz session
  useEffect(() => {
    const fetchQuizSession = async () => {
      try {
        if (!sessionId) {
          setLoading(false)
          return
        }

        const response = await fetch(`/api/quiz/sessions/${sessionId}`)
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

    if (sessionId) {
      fetchQuizSession()
    } else {
      // If no sessionId, immediately set loading to false
      setLoading(false)
    }
  }, [sessionId, router])

  // Global timer effect for timed quizzes
  useEffect(() => {
    if (quizSession?.config.timing === 'timed' && quizSession?.status === 'in_progress' && !isPaused) {
      if (globalTimeRemaining === null) {
        setGlobalTimeRemaining(quizSession.timeRemaining || quizSession.totalTimeLimit || 0)
      }

      const timer = setInterval(() => {
        setGlobalTimeRemaining(prev => {
          if (prev === null || prev <= 0) {
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [quizSession?.config.timing, quizSession?.totalTimeLimit, quizSession?.status, isPaused, globalTimeRemaining])

  // Initialize global timer when session loads
  useEffect(() => {
    if (quizSession?.config.timing === 'timed' && quizSession?.totalTimeLimit && globalTimeRemaining === null) {
      setGlobalTimeRemaining(quizSession.timeRemaining || quizSession.totalTimeLimit || 0)
    }
  }, [quizSession?.config.timing, quizSession?.totalTimeLimit, quizSession?.timeRemaining, globalTimeRemaining])

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
  useEffect(() => {
    if (quizSession && selectedAnswerId !== null) {
      const questionId = quizSession.questions[quizSession.currentQuestionIndex]?.id
      if (questionId) {
        setQuestionAttempts(prev => {
          const newMap = new Map(prev)
          const currentState = newMap.get(questionId) || {
            firstAnswer: null,
            finalAnswer: null,
            submitted: false,
            showingExplanation: false
          }

          newMap.set(questionId, {
            firstAnswer: firstAnswerId,
            finalAnswer: selectedAnswerId,
            submitted: false,
            showingExplanation: showExplanation
          })
          return newMap
        })
      }
    }
  }, [firstAnswerId, selectedAnswerId, showExplanation, quizSession])

  return {
    // State
    quizSession,
    loading,
    selectedAnswerId,
    firstAnswerId,
    showExplanation,
    globalTimeRemaining,
    questionStartTime,
    attempts,
    isPaused,
    flagDialogOpen,
    questionAttempts,

    // Setters
    setQuizSession,
    setSelectedAnswerId,
    setFirstAnswerId,
    setShowExplanation,
    setGlobalTimeRemaining,
    setQuestionStartTime,
    setAttempts,
    setIsPaused,
    setFlagDialogOpen,
    setQuestionAttempts,

    // Utilities
    loadQuestionState
  }
}
