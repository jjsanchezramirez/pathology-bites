// src/app/(dashboard)/dashboard/quiz/[id]/results/page.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Skeleton } from "@/shared/components/ui/skeleton"
import { Button } from "@/shared/components/ui/button"
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import { QuizSidebar } from "@/features/quiz/components/quiz-sidebar"
import { QuizHeader } from "@/features/quiz/components/quiz-header"
import { QuizQuestionDisplay } from "@/features/quiz/components/quiz-question-display"
import { PageErrorBoundary, FeatureErrorBoundary } from "@/shared/components/common"
import { QuizResult } from "@/features/quiz/types/quiz"
import { toast } from "sonner"
import Link from "next/link"

export default function QuizResultsPage() {
  const params = useParams()
  const sessionId = Array.isArray(params?.id) ? params.id[0] : params?.id
  
  // State for results review
  const [reviewResult, setReviewResult] = useState<QuizResult | null>(null)
  const [reviewSession, setReviewSession] = useState<any>(null)
  const [reviewLoading, setReviewLoading] = useState(true)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0)

  // Fetch review data on component mount
  const fetchReviewData = useCallback(async () => {
    if (!sessionId) return;
    
    setReviewLoading(true);
    setReviewError(null);
    
    try {
      // Fetch both session and results data in parallel
      const [sessionResponse, resultsResponse] = await Promise.all([
        fetch(`/api/quiz/sessions/${sessionId}`),
        fetch(`/api/quiz/sessions/${sessionId}/results`)
      ]);
      
      if (!sessionResponse.ok || !resultsResponse.ok) {
        const sessionError = !sessionResponse.ok ? await sessionResponse.text() : null
        const resultsError = !resultsResponse.ok ? await resultsResponse.text() : null
        throw new Error(`Failed to fetch review data: ${sessionError || resultsError}`)
      }
      
      const [sessionData, resultsData] = await Promise.all([
        sessionResponse.json(),
        resultsResponse.json()
      ]);
      
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
      
      setReviewSession(sessionData.data);
      setReviewResult(resultsData.data);
      
    } catch (error) {
      console.error('Error fetching review data:', error);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          const timeoutMessage = 'Request timed out. The server may be overloaded.'
          setReviewError(timeoutMessage);
          toast.error(timeoutMessage);
        } else {
          setReviewError(error.message);
          toast.error(`Failed to load quiz review: ${error.message}`);
        }
      } else {
        const genericError = 'Failed to load quiz review'
        setReviewError(genericError);
        toast.error(genericError);
      }
    } finally {
      setReviewLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchReviewData()
  }, [fetchReviewData])

  // Helper function for time formatting
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Helper functions for review mode navigation
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
  if (reviewLoading) {
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
            </CardContent>
          </Card>
        </div>

        {/* Main Content Skeleton */}
        <div className="flex-1 space-y-6 order-1 lg:order-2">
          <Skeleton className="h-8 w-64" />
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (reviewError || !reviewResult) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-destructive">Quiz Results Not Available</h1>
          <p className="text-muted-foreground mt-2">
            {reviewError || "The quiz results you're looking for don't exist or couldn't be loaded."}
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

  // Prepare data for quiz-like display
  const currentReviewQuestion = reviewResult.questionDetails[currentReviewIndex]
  const currentReviewResult = reviewResult.questionDetails[currentReviewIndex]
  
  // Create quiz session structure for sidebar
  const reviewModeSession = {
    id: sessionId || '',
    title: 'Quiz Results Review',
    questions: reviewResult.questionDetails.map(q => ({
      id: q.id,
      stem: q.question?.stem || q.title || '',
    })),
    currentQuestionIndex: currentReviewIndex,
    totalQuestions: reviewResult.questionDetails.length,
    status: 'completed' as const,
    userId: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    config: {
      mode: 'review' as const,
      timing: 'untimed' as const,
      showExplanations: true,
      questionCount: reviewResult.questionDetails.length,
      questionType: 'all' as const,
      categorySelection: 'all' as const,
      selectedCategories: [],
      shuffleQuestions: false,
      shuffleAnswers: false,
      showProgress: true
    }
  }
  
  // Create attempts array for sidebar
  const reviewAttempts = reviewResult.questionDetails.map(q => ({
    questionId: q.id,
    selectedAnswerId: q.selectedAnswerId,
    isCorrect: q.isCorrect,
    timeSpent: q.timeSpent || 0
  }))

  return (
    <PageErrorBoundary pageName="Quiz Results Review" showHomeButton={true} showBackButton={true}>
      <div className="min-h-screen bg-background/0 relative">
        <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto px-4 py-6">
          {/* Sidebar */}
          <div className="lg:flex-shrink-0 order-2 lg:order-1">
            <FeatureErrorBoundary featureName="Quiz Results Sidebar">
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
            <FeatureErrorBoundary featureName="Quiz Results Header">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Quiz Results Review</h1>
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
            <FeatureErrorBoundary featureName="Quiz Results Question Display">
              <QuizQuestionDisplay
                question={currentReviewQuestion as any}
                selectedAnswerId={currentReviewResult.selectedAnswerId}
                showExplanation={true}
                onAnswerSelect={() => {}} // No-op in results mode
              />
            </FeatureErrorBoundary>

            {/* Navigation */}
            <FeatureErrorBoundary featureName="Quiz Results Navigation">
              <div className="flex justify-between items-center pt-4">
                <Button
                  variant="outline"
                  onClick={handlePreviousReview}
                  disabled={currentReviewIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleNextReview}
                    disabled={currentReviewIndex >= reviewResult.questionDetails.length - 1}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </FeatureErrorBoundary>
          </div>
        </div>
      </div>
    </PageErrorBoundary>
  )
}