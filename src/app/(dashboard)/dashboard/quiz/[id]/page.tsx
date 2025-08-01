// src/app/(dashboard)/dashboard/quiz/[id]/page.tsx

"use client"

import { useParams } from "next/navigation"
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
import { toast } from "sonner"

export default function QuizSessionPage() {
  const params = useParams()
  const sessionId = Array.isArray(params?.id) ? params.id[0] : params?.id

  // Use custom hooks for state management
  const quizState = useQuizSession({ sessionId })
  const quizActions = useQuizActions({
    quizSession: quizState.quizSession,
    selectedAnswerId: quizState.selectedAnswerId,
    firstAnswerId: quizState.firstAnswerId,
    questionStartTime: quizState.questionStartTime,
    questionAttempts: quizState.questionAttempts,
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

  // Helper function for time formatting
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Early returns for loading and error states
  if (quizState.loading) {
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

  if (!quizState.quizSession) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-red-600">Quiz Not Found</h1>
          <p className="text-muted-foreground mt-2">
            The quiz session you're looking for doesn't exist or has been deleted.
          </p>
          <Button onClick={() => window.history.back()} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  // Get current session and question data
  const currentSession = quizState.quizSession
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
              <Button onClick={quizActions.handleResumeQuiz} className="w-full">
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
            onPauseQuiz={quizActions.handlePauseQuiz}
            onResumeQuiz={quizActions.handleResumeQuiz}
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
                  <Button onClick={quizActions.handleStartQuiz} className="w-full max-w-xs">
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
              onAnswerSelect={quizActions.handleAnswerSelect}
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
              onPreviousQuestion={quizActions.handlePreviousQuestion}
              onNextQuestion={quizActions.handleNextQuestion}
              onSubmitAnswer={quizActions.handleSubmitAnswer}
              canGoBack={currentSession.currentQuestionIndex > 0}
              isSubmitting={quizActions.isSubmitting}
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
