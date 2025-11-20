// src/app/(dashboard)/dashboard/quiz/[id]/review/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Skeleton } from "@/shared/components/ui/skeleton"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import {
  CheckCircle,
  XCircle,
  ArrowLeft,
  ArrowRight,
  Clock,
  Target
} from "lucide-react"
import { QuizResult } from "@/features/quiz/types/quiz"
import { QuizQuestionDisplay } from "@/features/quiz/components/quiz-question-display"
import { QuizSidebar } from "@/features/quiz/components/quiz-sidebar"
import { UIQuizQuestion } from "@/features/quiz/types/quiz-question"
import { createClient } from "@/shared/services/client"
import { toast } from "sonner"
import Link from "next/link"

export default function QuizReviewPage() {
  const params = useParams()
  const router = useRouter()
  const [result, setResult] = useState<QuizResult | null>(null)
  const [fullQuestions, setFullQuestions] = useState<UIQuizQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)

  const sessionId = Array.isArray(params?.id) ? params.id[0] : params?.id

  // Fetch quiz results and full question data on component mount
  useEffect(() => {
    const fetchResults = async () => {
      try {
        // Fetch quiz results from API
        const response = await fetch(`/api/quiz/sessions/${params?.id}/results`)
        if (!response.ok) {
          throw new Error('Failed to fetch quiz results')
        }
        const data = await response.json()
        setResult(data.data)

        // Fetch full question data with options, images, etc.
        if (data.data?.questionDetails) {
          const supabase = createClient()
          const questionIds = data.data.questionDetails.map((q: any) => q.id)

          const { data: questions, error } = await supabase
            .from('questions')
            .select(`
              id,
              title,
              stem,
              teaching_point,
              question_references,
              question_options(*),
              question_images(*, image:images(*))
            `)
            .in('id', questionIds)

          if (error) {
            console.error('Error fetching full question data:', error)
            toast.error('Failed to load question details')
          } else if (questions) {
            // Order questions to match the quiz order
            const questionMap = new Map(questions?.map((q: any) => [q.id, q]) || [])
            const orderedQuestions = questionIds.map(id => questionMap.get(id)).filter(Boolean) as UIQuizQuestion[]
            setFullQuestions(orderedQuestions)
          }
        }
      } catch {
        toast.error('Failed to load quiz results')
        setResult(null)
      } finally {
        setLoading(false)
      }
    }

    if (params?.id) {
      fetchResults()
    }
  }, [params?.id, sessionId])

  const formatTime = (timeValue: number) => {
    // Handle legacy data that might be in milliseconds
    // If the value is unreasonably large (> 3600 seconds = 1 hour), assume it's in milliseconds
    let seconds = timeValue
    if (timeValue > 3600) {
      seconds = Math.round(timeValue / 1000)
    }

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background/0 relative">
        <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto px-4 py-6">
          {/* Sidebar Skeleton */}
          <div className="lg:flex-shrink-0 order-2 lg:order-1 w-full lg:w-80">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Main Content Skeleton */}
          <div className="flex-1 space-y-6 order-1 lg:order-2">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-10 w-32" />
            </div>

            {/* Question Skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full" />
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Skeleton key={j} className="h-12 w-full" />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-red-600">Quiz Results Not Available</h1>
          <p className="text-muted-foreground mt-2">
            The quiz results you're looking for don't exist or couldn't be loaded.
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

  // Get current question and result
  const currentQuestion = fullQuestions[currentQuestionIndex]
  const currentResult = result.questionDetails?.[currentQuestionIndex]

  // Create session object for sidebar
  const reviewSession = {
    id: sessionId || '',
    questions: fullQuestions,
    settings: {
      showExplanations: true
    },
    status: 'completed' as const
  }

  // Create attempts array for sidebar
  const attempts = result.questionDetails?.map((q: any) => ({
    questionId: q.id,
    selectedAnswerId: q.selectedAnswerId,
    isCorrect: q.isCorrect,
    timeSpent: q.timeSpent || 0
  })) || []

  // Navigation handlers
  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  const handleNext = () => {
    if (currentQuestionIndex < fullQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  return (
    <div className="min-h-screen bg-background/0 relative">
      <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto px-4 py-6">
        {/* Sidebar */}
        <div className="lg:flex-shrink-0 order-2 lg:order-1">
          <QuizSidebar
            session={reviewSession as any}
            currentQuestionIndex={currentQuestionIndex}
            attempts={attempts}
            onQuestionSelect={(index) => setCurrentQuestionIndex(index)}
            timeRemaining={null}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 space-y-6 order-1 lg:order-2">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Quiz Review</h1>
              <p className="text-muted-foreground">
                Question {currentQuestionIndex + 1} of {fullQuestions.length}
              </p>
            </div>
            <Link href={`/dashboard/quiz/${sessionId}/results`}>
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Results
              </Button>
            </Link>
          </div>

          {/* Question Metadata Card */}
          {currentResult && (
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-3">
                    {currentResult.isCorrect ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    {currentResult.title}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {currentResult.category}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {currentResult.difficulty}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Time spent: {formatTime(currentResult.timeSpent)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    {currentResult.totalAttempts && currentResult.totalAttempts >= 30
                      ? `${currentResult.successRate}% success rate`
                      : 'Insufficient data'
                    }
                  </div>
                </div>
              </CardHeader>
            </Card>
          )}

          {/* Question Display */}
          {currentQuestion && currentResult && (
            <QuizQuestionDisplay
              question={currentQuestion}
              selectedAnswerId={currentResult.selectedAnswerId}
              showExplanation={true}
              onAnswerSelect={() => {}} // No-op in review mode
            />
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center pt-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="text-sm text-muted-foreground">
              {currentQuestionIndex + 1} / {fullQuestions.length}
            </div>

            <Button
              variant="outline"
              onClick={handleNext}
              disabled={currentQuestionIndex === fullQuestions.length - 1}
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
