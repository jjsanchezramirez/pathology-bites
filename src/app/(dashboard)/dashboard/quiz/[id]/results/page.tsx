// src/app/(dashboard)/dashboard/quiz/[id]/results/page.tsx
"use client"

import { useParams } from "next/navigation"
import { Button } from "@/shared/components/ui/button"
import { QuizResultsSummary } from "@/features/quiz/components/quiz-results-summary"
import { QuizResultsSkeleton } from "@/features/quiz/components/quiz-results-skeleton"
import { PageErrorBoundary } from "@/shared/components/common"
import { QuizResult } from "@/features/quiz/types/quiz"
import { toast } from '@/shared/utils/toast'
import Link from "next/link"
import { useCachedData } from "@/shared/hooks/use-cached-data"

export default function QuizResultsPage() {
  const params = useParams()
  const sessionId = Array.isArray(params?.id) ? params.id[0] : params?.id

  console.log('[Results Page] sessionId:', sessionId)

  // Fetch results with caching and deduplication
  const { data: result, isLoading: loading, error: fetchError } = useCachedData<QuizResult>(
    `quiz-results-${sessionId}`,
    async () => {
      const resultsResponse = await fetch(`/api/quiz/sessions/${sessionId}/results`);

      if (!resultsResponse.ok) {
        const resultsError = await resultsResponse.text()
        throw new Error(`Failed to fetch results: ${resultsError}`)
      }

      const resultsData = await resultsResponse.json();

      if (!resultsData?.success || !resultsData?.data) {
        throw new Error('Quiz results not found - quiz may not be completed')
      }

      return resultsData.data;
    },
    {
      enabled: !!sessionId,
      ttl: 7 * 24 * 60 * 60 * 1000, // 7 days cache (results immutable, needed for review)
      staleTime: 7 * 24 * 60 * 60 * 1000, // 7 days stale time
      storage: 'localStorage', // Use localStorage for persistence - results are cached from completion
      prefix: 'pathology-bites-quiz',
      onError: (error) => {
        console.error('Error fetching results:', error)
        toast.error(error.message)
      }
    }
  )

  const error = fetchError?.message || null

  console.log('[Results Page] State:', {
    loading,
    hasResult: !!result,
    error,
    resultScore: result?.score,
    resultCorrect: result?.correctAnswers,
    resultTotal: result?.totalQuestions,
    newAchievements: result?.newAchievements?.length,
    hasQuestionDetails: !!result?.questionDetails,
    questionDetailsLength: result?.questionDetails?.length,
    hasCategoryBreakdown: !!result?.categoryBreakdown,
    categoryBreakdownLength: result?.categoryBreakdown?.length
  })

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <QuizResultsSkeleton />
      </div>
    )
  }

  // Error state - keep within dashboard layout
  if (error || !result) {
    return (
      <div className="container mx-auto py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-destructive">Quiz Results Not Available</h1>
            <p className="text-muted-foreground mt-2">
              {error || "The quiz results you're looking for don't exist or couldn't be loaded."}
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
      </div>
    )
  }

  // Results display
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <QuizResultsSummary
          result={result}
          sessionId={sessionId || ''}
          onReviewQuestions={() => {
            window.location.href = `/dashboard/quiz/${sessionId}/review`
          }}
          onRetakeMissed={() => {
            // TODO: Implement retake missed questions functionality
            toast.info("Retake missed questions feature coming soon!")
          }}
        />
      </div>
    </div>
  )
}