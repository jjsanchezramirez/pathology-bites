// src/app/(dashboard)/dashboard/quiz/[id]/page.tsx

"use client"

import { useParams, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Skeleton } from "@/shared/components/ui/skeleton"
import { Button } from "@/shared/components/ui/button"
import { Play, Pause } from "lucide-react"
import { QuizSidebar } from "@/features/quiz/components/quiz-sidebar"
import { QuestionFlagDialog } from "@/features/questions/components/question-flag-dialog"
import { QuizHeader } from "@/features/quiz/components/quiz-header"
import { QuizQuestionDisplay } from "@/features/quiz/components/quiz-question-display"
import { QuizNavigation } from "@/features/quiz/components/quiz-navigation"
import { useQuizSession } from "@/features/quiz/hooks/use-quiz-session"
import { PageErrorBoundary, FeatureErrorBoundary } from "@/shared/components/common"
import { useQuizActions } from "@/features/quiz/hooks/use-quiz-actions"
import { QuizResult } from "@/features/quiz/types/quiz"
import { toast } from "sonner"
import { useState, useEffect, useCallback } from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function QuizSessionPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const sessionId = Array.isArray(params?.id) ? params.id[0] : params?.id
  const isReviewMode = searchParams.get('review') === 'true'
  
  // Review mode state
  const [reviewResult, setReviewResult] = useState<QuizResult | null>(null)
  const [reviewSession, setReviewSession] = useState<any>(null)
  const [reviewLoading, setReviewLoading] = useState(isReviewMode)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0)
  const [showExplanations, setShowExplanations] = useState<{[key: string]: boolean}>({})

  // Use custom hooks for state management (always call hooks, but conditionally use their values)
  const quizState = useQuizSession({ sessionId: isReviewMode ? undefined : sessionId })
  const quizActions = useQuizActions({
    quizSession: quizState.quizSession,
    selectedAnswerId: quizState.selectedAnswerId,
    firstAnswerId: quizState.firstAnswerId,
    questionStartTime: quizState.questionStartTime,
    questionAttempts: quizState.questionAttempts,
    attempts: quizState.attempts,
    setSelectedAnswerId: quizState.setSelectedAnswerId,
    setFirstAnswerId: quizState.setFirstAnswerId,
    setShowExplanation: quizState.setShowExplanation,
    setQuestionStartTime: quizState.setQuestionStartTime,
    setAttempts: quizState.setAttempts,
    setQuizSession: quizState.setQuizSession,
    setQuestionAttempts: quizState.setQuestionAttempts,
    setIsPaused: quizState.setIsPaused,
    setGlobalTimeRemaining: quizState.setGlobalTimeRemaining,
    loadQuestionState: quizState.loadQuestionState
  })

  // Fetch review data if in review mode
  const fetchReviewData = useCallback(async () => {
    if (!isReviewMode || !sessionId) return
    
    try {
      setReviewLoading(true)
      setReviewError(null)
      
      // Create AbortController for timeout handling
      const abortController = new AbortController()
      const timeoutId = setTimeout(() => abortController.abort(), 30000) // 30 second timeout
      
      const [sessionResponse, resultsResponse] = await Promise.all([
        fetch(`/api/quiz/sessions/${sessionId}`, {
          signal: abortController.signal
        }),
        fetch(`/api/quiz/sessions/${sessionId}/results`, {
          signal: abortController.signal
        })
      ])
      
      clearTimeout(timeoutId)
      
      if (!sessionResponse.ok || !resultsResponse.ok) {
        const sessionError = !sessionResponse.ok ? await sessionResponse.text() : null
        const resultsError = !resultsResponse.ok ? await resultsResponse.text() : null
        throw new Error(`Failed to fetch quiz data: ${sessionError || resultsError}`)
      }
      
      const [sessionData, resultsData] = await Promise.all([
        sessionResponse.json(),
        resultsResponse.json()
      ])
      
      // Validate session and results data
      if (!sessionData?.success || !sessionData?.data) {
        throw new Error('Quiz session not found or invalid')
      }
      
      if (!resultsData?.success || !resultsData?.data) {
        throw new Error('Quiz results not found - quiz may not be completed')
      }
      
      // Additional validation
      if (!resultsData.data.questionDetails || resultsData.data.questionDetails.length === 0) {
        throw new Error('No question data available for review')
      }
      
      setReviewSession(sessionData.data)
      setReviewResult(resultsData.data)
      
      // Initialize all explanations to be visible
      const initialExplanations: {[key: string]: boolean} = {}
      resultsData.data.questionDetails?.forEach((q: any) => {
        initialExplanations[q.id] = true
      })
      setShowExplanations(initialExplanations)
    } catch (error) {
      console.error('Error fetching review data:', error)
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          const timeoutMessage = 'Request timed out. The server may be overloaded.'
          setReviewError(timeoutMessage)
          toast.error(timeoutMessage)
        } else {
          setReviewError(error.message)
          toast.error(`Failed to load quiz review: ${error.message}`)
        }
      } else {
        const genericError = 'Failed to load quiz review'
        setReviewError(genericError)
        toast.error(genericError)
      }
    } finally {
      setReviewLoading(false)
    }
  }, [isReviewMode, sessionId])

  useEffect(() => {
    fetchReviewData()
  }, [fetchReviewData])

  // Helper function for time formatting
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Helper functions for review mode
  const toggleExplanation = (questionId: string) => {
    setShowExplanations(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }))
  }

  const handlePreviousReview = () => {
    if (currentReviewIndex > 0) {
      setCurrentReviewIndex(currentReviewIndex - 1)
    }
  }

  const handleNextReview = () => {
    if (reviewResult && currentReviewIndex < reviewResult.questionDetails.length - 1) {
      setCurrentReviewIndex(currentReviewIndex + 1)
    }
  }

  // Early returns for loading and error states
  if (reviewLoading || (!isReviewMode && quizState.loading)) {
    return (
      <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto px-4 py-6">
        {/* Sidebar Skeleton */}
        <div className="lg:flex-shrink-0 order-2 lg:order-1">
          <Card className="w-full lg:w-80">
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-8" />
                ))}
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-16" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Skeleton */}
        <div className="flex-1 order-1 lg:order-2">
          <div className="space-y-6">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-8 w-64 mb-2" />
                <Skeleton className="h-4 w-48" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-10 w-20" />
                <Skeleton className="h-10 w-16" />
              </div>
            </div>

            {/* Question Card Skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-10 w-20" />
                  <Skeleton className="h-10 w-16" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // Consistent error handling for all modes
  if (!isReviewMode && !quizState.quizSession) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-red-600">Quiz Session Not Found</h1>
          <p className="text-muted-foreground mt-2">
            The quiz session you're looking for doesn't exist or has been deleted.
          </p>
          <div className="flex justify-center gap-2 mt-4">
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
            <Link href="/dashboard">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Handle review mode rendering  
  if (isReviewMode) {
    if (reviewLoading) {
      return (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold">Loading Quiz Review...</h1>
          </div>
        </div>
      )
    }
    
    if (!reviewResult || !reviewSession) {
      return (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-red-600">Quiz Review Not Available</h1>
            <p className="text-muted-foreground mt-2">
              {reviewError || 'Could not load quiz session or results data for review.'}
            </p>
            <div className="flex justify-center gap-2 mt-4">
              <Button onClick={() => fetchReviewData()}>
                Try Again
              </Button>
              <Link href="/dashboard">
                <Button variant="outline">Back to Dashboard</Button>
              </Link>
            </div>
          </div>
        </div>
      )
    }

    const currentReviewQuestion = reviewSession.questions?.[currentReviewIndex]
    const currentReviewResult = reviewResult.questionDetails?.[currentReviewIndex]
    
    // Temporary debug - remove after fixing
    if (!currentReviewQuestion) {
      console.log('Missing currentReviewQuestion:', { currentReviewIndex, questionsLength: reviewSession.questions?.length })
    }
    if (!currentReviewResult) {
      console.log('Missing currentReviewResult:', { currentReviewIndex, resultsLength: reviewResult.questionDetails?.length })
    }
    
    if (!currentReviewQuestion || !currentReviewResult) {
      return (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-red-600">No questions to review</h1>
            <Link href={`/dashboard/quiz/${sessionId}/results`}>
              <Button className="mt-4">Back to Results</Button>
            </Link>
          </div>
        </div>
      )
    }

    // Use the actual session data with review mode modifications
    const reviewModeSession = {
      ...reviewSession,
      title: "Quiz Review",
      currentQuestionIndex: currentReviewIndex,
      config: {
        ...reviewSession.config,
        mode: 'tutor' as const,
        showExplanations: true
      },
      status: 'in_progress' as const
    }
    
    // Create attempts array for sidebar from results
    const reviewAttempts = reviewResult.questionDetails.map((q: any) => ({
      questionId: q.id,
      selectedAnswerId: q.selectedAnswerId,
      isCorrect: q.isCorrect,
      timeSpent: q.timeSpent || 0
    }))

    return (
      <PageErrorBoundary pageName="Quiz Review" showHomeButton={true} showBackButton={true}>
        <div className="min-h-screen bg-background/0 relative">
          <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto px-4 py-6">
            {/* Sidebar */}
            <div className="lg:flex-shrink-0 order-2 lg:order-1">
              <FeatureErrorBoundary featureName="Quiz Review Sidebar">
                <QuizSidebar
                  session={reviewModeSession as any}
                  currentQuestionIndex={currentReviewIndex}
                  attempts={reviewAttempts}
                  onQuestionSelect={(index) => setCurrentReviewIndex(index)}
                  timeRemaining={null}
                />
              </FeatureErrorBoundary>
            </div>

            {/* Main Content */}
            <div className="flex-1 space-y-6 order-1 lg:order-2">
              {/* Header */}
              <FeatureErrorBoundary featureName="Quiz Review Header">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold">Quiz Review</h1>
                    <p className="text-muted-foreground">
                      Question {currentReviewIndex + 1} of {reviewResult.questionDetails.length}
                    </p>
                  </div>
                  <Link href={`/dashboard/quiz/${sessionId}/results`}>
                    <Button variant="outline">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Results
                    </Button>
                  </Link>
                </div>
              </FeatureErrorBoundary>

              {/* Question Display */}
              <FeatureErrorBoundary featureName="Quiz Review Question Display">
                <QuizQuestionDisplay
                  question={currentReviewQuestion as any}
                  selectedAnswerId={currentReviewResult.selectedAnswerId}
                  showExplanation={true}
                  onAnswerSelect={() => {}} // No-op in review mode
                />
              </FeatureErrorBoundary>

              {/* Navigation */}
              <FeatureErrorBoundary featureName="Quiz Review Navigation">
                <div className="flex justify-between items-center pt-4">
                  <Button
                    variant="outline"
                    onClick={handlePreviousReview}
                    disabled={currentReviewIndex === 0}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>
                  
                  <div className="text-sm text-muted-foreground">
                    {currentReviewIndex + 1} / {reviewResult.questionDetails.length}
                  </div>
                  
                  <Button
                    variant="outline"
                    onClick={handleNextReview}
                    disabled={currentReviewIndex === reviewResult.questionDetails.length - 1}
                  >
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </FeatureErrorBoundary>
            </div>
          </div>
        </div>
      </PageErrorBoundary>
    )
  }

  // Get current session and question data
  const currentSession = quizState.quizSession
  if (!currentSession) {
    return (
      <PageErrorBoundary pageName="Quiz Session" showHomeButton={true} showBackButton={true}>
        <div className="min-h-screen bg-background/0 relative flex items-center justify-center">
          <Card className="w-96 p-6 text-center">
            <CardHeader>
              <CardTitle>Session Not Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p>The quiz session could not be loaded.</p>
            </CardContent>
          </Card>
        </div>
      </PageErrorBoundary>
    )
  }
  const currentQuestion = currentSession.questions[currentSession.currentQuestionIndex]

  return (
    <PageErrorBoundary pageName="Quiz Session" showHomeButton={true} showBackButton={true}>
      <div className="min-h-screen bg-background/0 relative">
      {/* Pause Overlay */}
      {quizState.isPaused && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="w-96 p-6 text-center">
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2">
                <Pause className="h-5 w-5" />
                Quiz Paused
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Your quiz is paused. Time remaining: {quizState.globalTimeRemaining ? formatTime(quizState.globalTimeRemaining) : 'N/A'}
              </p>
              <Button onClick={!isReviewMode ? quizActions.handleResumeQuiz : () => {}} className="w-full">
                <Play className="h-4 w-4 mr-2" />
                Resume Quiz
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto px-4 py-6">
        {/* Sidebar */}
        <div className="lg:flex-shrink-0 order-2 lg:order-1">
          <FeatureErrorBoundary featureName="Quiz Sidebar">
            <QuizSidebar
            session={currentSession}
            currentQuestionIndex={currentSession.currentQuestionIndex}
            attempts={quizState.attempts.map(attempt => ({
              questionId: attempt.questionId,
              selectedAnswerId: attempt.selectedAnswerId ?? null,
              isCorrect: attempt.isCorrect ?? false,
              timeSpent: attempt.timeSpent ?? 0
            }))}
            onQuestionSelect={(index) => {
              // Handle question navigation
              console.log('Navigate to question:', index)
            }}
            timeRemaining={quizState.globalTimeRemaining}
          />
          </FeatureErrorBoundary>
        </div>

        {/* Main Content */}
        <div className="flex-1 space-y-6 order-1 lg:order-2">
          {/* Header */}
          <FeatureErrorBoundary featureName="Quiz Header">
            <QuizHeader
            title={currentSession.title}
            currentQuestionIndex={currentSession.currentQuestionIndex}
            totalQuestions={currentSession.totalQuestions}
            globalTimeRemaining={quizState.globalTimeRemaining}
            timing={currentSession.config.timing}
            status={currentSession.status as any}
            isPaused={quizState.isPaused}
            onPauseQuiz={!isReviewMode ? quizActions.handlePauseQuiz : () => {}}
            onResumeQuiz={!isReviewMode ? quizActions.handleResumeQuiz : () => {}}
            onFlagQuestion={() => quizState.setFlagDialogOpen(true)}
          />
          </FeatureErrorBoundary>

          {/* Start Quiz Overlay */}
          {currentSession.status === 'not_started' && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-blue-800">Ready to Start?</h3>
                    <p className="text-blue-700">
                      {currentSession.config.timing === 'timed'
                        ? `You have ${Math.floor((currentSession.totalTimeLimit || 0) / 60)} minutes to complete ${currentSession.totalQuestions} questions.`
                        : `Take your time to complete ${currentSession.totalQuestions} questions.`
                      }
                    </p>
                  </div>
                  <Button onClick={!isReviewMode ? quizActions.handleStartQuiz : () => {}} className="w-full max-w-xs">
                    Start Quiz
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Question Display */}
          {!quizState.isPaused && currentSession.status !== 'not_started' && (
            <FeatureErrorBoundary featureName="Quiz Question Display">
              <QuizQuestionDisplay
              question={currentQuestion as any}
              selectedAnswerId={quizState.selectedAnswerId}
              showExplanation={quizState.showExplanation}
              onAnswerSelect={!isReviewMode ? quizActions.handleAnswerSelect : () => {}}
            />
            </FeatureErrorBoundary>
          )}

          {/* Navigation */}
          {!quizState.isPaused && currentSession.status !== 'not_started' && (
            <FeatureErrorBoundary featureName="Quiz Navigation">
              <QuizNavigation
              currentQuestionIndex={currentSession.currentQuestionIndex}
              totalQuestions={currentSession.totalQuestions}
              selectedAnswerId={quizState.selectedAnswerId}
              showExplanation={quizState.showExplanation}
              timing={currentSession.config.timing}
              onPreviousQuestion={!isReviewMode ? quizActions.handlePreviousQuestion : () => {}}
              onNextQuestion={!isReviewMode ? quizActions.handleNextQuestion : () => {}}
              onSubmitAnswer={!isReviewMode ? quizActions.handleSubmitAnswer : () => {}}
              canGoBack={currentSession.currentQuestionIndex > 0}
              isSubmitting={!isReviewMode ? quizActions.isSubmitting : false}
            />
            </FeatureErrorBoundary>
          )}
        </div>
      </div>

      {/* Question Flag Dialog */}
      <QuestionFlagDialog
        question={currentQuestion as any}
        open={quizState.flagDialogOpen}
        onOpenChange={quizState.setFlagDialogOpen}
        onFlagComplete={() => {
          toast.success('Question flagged successfully')
        }}
      />
      </div>
    </PageErrorBoundary>
  )
}
