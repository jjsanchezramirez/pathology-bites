// src/app/(dashboard)/dashboard/quiz/[id]/results/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Skeleton } from "@/shared/components/ui/skeleton"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import { Progress } from "@/shared/components/ui/progress"
import { CircularProgress } from "@/shared/components/ui/circular-progress"
import {
  Target,
  CheckCircle,
  XCircle,
  RotateCcw,
  Eye,
  BarChart3,
  Clock,
  Plus,
  FileText
} from "lucide-react"
import { QuizResult } from "@/features/quiz/types/quiz"
import { toast } from "sonner"
import Link from "next/link"
import confetti from "canvas-confetti"
import { QuizQuestionReviewDialog } from "@/features/quiz/components/quiz-question-review-dialog"

export default function QuizResultsPage() {
  const params = useParams()
  const router = useRouter()
  const [result, setResult] = useState<QuizResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [reviewQuestionId, setReviewQuestionId] = useState<string | null>(null)
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)

  // Check if this is a mock session (for development)
  const sessionId = Array.isArray(params?.id) ? params.id[0] : params?.id
  const isMockSession = sessionId ? (sessionId.startsWith('mock-') || sessionId === 'demo' || sessionId === 'quiz-1') : false

  // Fetch quiz results on component mount
  useEffect(() => {
    const fetchResults = async () => {
      try {
        if (isMockSession) {
          // Try to get results from localStorage for mock sessions
          const storedResults = localStorage.getItem(`quiz-results-${sessionId}`)
          if (storedResults) {
            const mockResults = JSON.parse(storedResults)
            setResult(mockResults)

            // Trigger confetti for high scores (80% or above)
            if (mockResults.score >= 80) {
              setTimeout(() => {
                confetti({
                  particleCount: 100,
                  spread: 70,
                  origin: { y: 0.6 }
                })
              }, 500)
            }
          } else {
            throw new Error('Mock quiz results not found')
          }
        } else {
          // Fetch from API for real sessions
          const response = await fetch(`/api/quiz/sessions/${params?.id}/results`)
          if (!response.ok) {
            throw new Error('Failed to fetch quiz results')
          }
          const data = await response.json()
          setResult(data.data)

          // Trigger confetti for high scores (80% or above)
          if (data.data.score >= 80) {
            setTimeout(() => {
              confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
              })
            }, 500)
          }
        }
      } catch (error) {
        console.error('Error fetching quiz results:', error)
        toast.error('Failed to load quiz results')
        // Keep consistent with other pages - don't auto-redirect
        setResult(null)
      } finally {
        setLoading(false)
      }
    }

    if (params?.id) {
      fetchResults()
    }
  }, [params?.id, router, isMockSession, sessionId])

  const handleReviewQuestion = (questionId: string) => {
    setReviewQuestionId(questionId)
    setReviewDialogOpen(true)
  }

  const handleRetakeQuiz = () => {
    if (isMockSession) {
      // For mock sessions, redirect to new quiz page
      router.push('/dashboard/quiz/new')
    } else {
      // For real sessions, we'd need to create a new session with same parameters
      toast.info('Retake functionality coming soon!')
      router.push('/dashboard/quiz/new')
    }
  }

  const handleReviewQuiz = () => {
    // Navigate to review mode - we'll implement this as a query parameter
    if (isMockSession) {
      router.push(`/dashboard/quiz/${sessionId}?review=true`)
    } else {
      router.push(`/dashboard/quiz/${sessionId}?review=true`)
    }
  }

  const formatTime = (seconds: number) => {
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

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600"
    if (score >= 80) return "text-blue-600"
    if (score >= 70) return "text-yellow-600"
    return "text-red-600"
  }

  const getScoreBadge = (score: number) => {
    if (score >= 90) return { label: "Excellent", color: "bg-green-100 text-green-800 border-green-200" }
    if (score >= 80) return { label: "Good", color: "bg-blue-100 text-blue-800 border-blue-200" }
    if (score >= 70) return { label: "Fair", color: "bg-yellow-100 text-yellow-800 border-yellow-200" }
    return { label: "Needs improvement", color: "bg-red-100 text-red-800 border-red-200" }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Skeleton */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
          <div>
            <Skeleton className="h-8 w-64 mx-auto mb-2" />
            <Skeleton className="h-4 w-48 mx-auto" />
          </div>
        </div>

        {/* Score Overview Skeleton */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-6">
              <div className="space-y-2">
                <Skeleton className="h-16 w-24 mx-auto" />
                <Skeleton className="h-6 w-20 mx-auto" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="text-center space-y-2">
                    <Skeleton className="h-8 w-12 mx-auto" />
                    <Skeleton className="h-4 w-16 mx-auto" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Question Review Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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

  const scoreBadge = getScoreBadge(result.score)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Quiz Complete</h1>
          <p className="text-muted-foreground text-sm">Here's how you performed</p>
        </div>
      </div>

      {/* Score Overview with Circular Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <CircularProgress value={result.score} size={140} strokeWidth={10} />
            </div>
            <Badge variant="outline" className={scoreBadge.color}>
              {scoreBadge.label}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="space-y-2">
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
              <div className="text-2xl font-bold text-green-600">{result.correctAnswers}</div>
              <div className="text-sm text-muted-foreground">Correct</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className="space-y-2">
              <XCircle className="h-8 w-8 text-red-500 mx-auto" />
              <div className="text-2xl font-bold text-red-600">{result.totalQuestions - result.correctAnswers}</div>
              <div className="text-sm text-muted-foreground">Incorrect</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className="space-y-2">
              <Clock className="h-8 w-8 text-blue-500 mx-auto" />
              <div className="text-2xl font-bold text-blue-600">{formatTime(result.totalTimeSpent)}</div>
              <div className="text-sm text-muted-foreground">Total Time</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className="space-y-2">
              <Target className="h-8 w-8 text-purple-500 mx-auto" />
              <div className="text-2xl font-bold text-purple-600">{formatTime(result.averageTimePerQuestion)}</div>
              <div className="text-sm text-muted-foreground">Avg per Question</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Difficulty Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4" />
              By difficulty
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(result.difficultyBreakdown).map(([difficulty, stats]) => {
              const percentage = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
              return (
                <div key={difficulty} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="capitalize font-medium text-sm">{difficulty}</span>
                    <span className="text-xs text-muted-foreground">
                      {stats.correct}/{stats.total} ({percentage}%)
                    </span>
                  </div>
                  <Progress value={percentage} className="h-1.5" />
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              By category
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.categoryBreakdown.length > 0 ? (
              result.categoryBreakdown.map((category) => {
                const percentage = category.total > 0 ? Math.round((category.correct / category.total) * 100) : 0
                return (
                  <div key={category.categoryId} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm">{category.categoryName}</span>
                      <span className="text-xs text-muted-foreground">
                        {category.correct}/{category.total} ({percentage}%)
                      </span>
                    </div>
                    <Progress value={percentage} className="h-1.5" />
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-muted-foreground">No category data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Question Review */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Question Review</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {result.questionDetails?.map((question, index) => (
              <div key={question.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {question.isCorrect ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <span className="font-medium">Question {index + 1}: {question.title}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {question.category}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {question.difficulty}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3"
                    onClick={() => handleReviewQuestion(question.id)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Review
                  </Button>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span>Time spent: {formatTime(question.timeSpent)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>
                      {question.totalAttempts && question.totalAttempts >= 30 
                        ? `${question.successRate}% of people got this correct`
                        : 'Still collecting data...'
                      }
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 justify-center pt-4">
        <Link href="/dashboard/quiz/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Quiz
          </Button>
        </Link>
        <Button variant="outline" onClick={handleRetakeQuiz}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Retake Quiz
        </Button>
        <Button variant="outline" onClick={handleReviewQuiz}>
          <FileText className="h-4 w-4 mr-2" />
          Review Quiz
        </Button>
      </div>

      {/* Question Review Dialog */}
      <QuizQuestionReviewDialog
        questionDetail={result.questionDetails?.find(q => q.id === reviewQuestionId) || null}
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
      />

    </div>
  )
}
