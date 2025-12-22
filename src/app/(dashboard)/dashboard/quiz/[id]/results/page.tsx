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
      ttl: 5 * 60 * 1000, // 5 minutes cache
      staleTime: 2 * 60 * 1000, // 2 minutes stale time
      storage: 'memory', // Use memory for quiz results
      prefix: 'pathology-bites-quiz',
      onError: (error) => {
        console.error('Error fetching results:', error)
        toast.error(error.message)
      }
    }
  )

  const error = fetchError?.message || null

  // Loading state
  if (loading) {
    return (
      <PageErrorBoundary pageName="Quiz Results" showHomeButton={true} showBackButton={true}>
        <div className="min-h-screen bg-background/0 relative py-6">
          <QuizResultsSkeleton />
        </div>
      </PageErrorBoundary>
    )
  }

  // Error state
  if (error || !result) {
    return (
      <PageErrorBoundary pageName="Quiz Results" showHomeButton={true} showBackButton={true}>
        <div className="max-w-4xl mx-auto space-y-6 py-6">
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
      </PageErrorBoundary>
    )
  }

  // Results display
  return (
    <PageErrorBoundary pageName="Quiz Results" showHomeButton={true} showBackButton={true}>
      <div className="min-h-screen bg-background/0 relative py-6">
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
    </PageErrorBoundary>
  )
}