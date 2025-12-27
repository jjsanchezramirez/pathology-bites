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
import { toast } from '@/shared/utils/toast'
import { cn } from "@/shared/utils"
import Link from "next/link"
import { PanelLeftOpen } from "lucide-react"

export default function QuizReviewPage() {
  const params = useParams()
  const router = useRouter()
  const [result, setResult] = useState<QuizResult | null>(null)
  const [fullQuestions, setFullQuestions] = useState<UIQuizQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

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
    const seconds = timeValue

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
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold">Loading Quiz Review...</h2>
        </div>
      </div>
    )
  }

  if (false) {
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
      <div className="h-full flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="text-red-600">Quiz Results Not Available</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              The quiz results you're looking for don't exist or couldn't be loaded.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()} className="flex-1">
                Try Again
              </Button>
              <Link href="/dashboard" className="flex-1">
                <Button variant="outline" className="w-full">Back to Dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
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
    <div className="h-full flex overflow-hidden">
      {/* Mobile Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "h-full shrink-0 bg-secondary border-r border-border overflow-hidden z-50 w-[280px]",
          // Desktop: relative positioning, always visible
          "md:relative md:translate-x-0",
          // Mobile: fixed positioning, slide animation
          "fixed left-0 top-0 transition-transform duration-300 ease-in-out",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <QuizSidebar
          session={reviewSession as any}
          currentQuestionIndex={currentQuestionIndex}
          attempts={attempts}
          onQuestionSelect={(index) => {
            setCurrentQuestionIndex(index)
            setMobileSidebarOpen(false)
          }}
          timeRemaining={null}
        />
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Header - Fixed at top */}
        <header className="shrink-0 border-b border-border bg-background p-3 md:p-5">
          <div className="flex items-center justify-between gap-2 md:gap-4">
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
              {/* Mobile Menu Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
                className="md:hidden"
              >
                <PanelLeftOpen className="h-4 w-4 mr-2" />
                Quiz Navigation
              </Button>

              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground mb-1">
                  QUIZ REVIEW
                </div>
                <div className="text-[13px] md:text-[14px] font-medium text-foreground truncate">
                  Question {currentQuestionIndex + 1} of {fullQuestions.length}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/dashboard/quiz/${sessionId}/results`}>
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2 hidden sm:block" />
                  <span className="hidden sm:inline">Back to Results</span>
                  <ArrowLeft className="h-4 w-4 sm:hidden" />
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Card Content Area - Scrollable */}
        <div className="flex-1 overflow-auto">
          <div className="flex justify-center p-2 md:p-3">
            <div className="w-full max-w-2xl space-y-3">

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
      </main>
    </div>
  )
}
