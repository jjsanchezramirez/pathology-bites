// src/app/(dashboard)/dashboard/quiz/[id]/results/page.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/shared/components/ui/button"
import { QuizResultsSummary } from "@/features/quiz/components/quiz-results-summary"
import { QuizResultsSkeleton } from "@/features/quiz/components/quiz-results-skeleton"
import { PageErrorBoundary } from "@/shared/components/common"
import { QuizResult } from "@/features/quiz/types/quiz"
import { toast } from "sonner"
import Link from "next/link"

export default function QuizResultsPage() {
  const params = useParams()
  const sessionId = Array.isArray(params?.id) ? params.id[0] : params?.id

  // State for results
  const [result, setResult] = useState<QuizResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch results data
  const fetchResultsData = useCallback(async () => {
    if (!sessionId) return;

    setLoading(true);
    setError(null);

    try {
      const resultsResponse = await fetch(`/api/quiz/sessions/${sessionId}/results`);

      if (!resultsResponse.ok) {
        const resultsError = await resultsResponse.text()
        throw new Error(`Failed to fetch results: ${resultsError}`)
      }

      const resultsData = await resultsResponse.json();

      if (!resultsData?.success || !resultsData?.data) {
        throw new Error('Quiz results not found - quiz may not be completed')
      }

      setResult(resultsData.data);
    } catch (error) {
      console.error('Error fetching results:', error)

      if (error instanceof Error) {
        setError(error.message);
        toast.error(error.message);
      } else {
        const genericError = 'Failed to load quiz results'
        setError(genericError);
        toast.error(genericError);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchResultsData()
  }, [fetchResultsData])

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