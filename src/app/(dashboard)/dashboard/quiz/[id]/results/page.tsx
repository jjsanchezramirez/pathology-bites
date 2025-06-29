// src/app/(dashboard)/dashboard/quiz/[id]/results/page.tsx
"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import { Progress } from "@/shared/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"
import { 
  Trophy, 
  Clock, 
  Target, 
  TrendingUp,
  CheckCircle,
  XCircle,
  RotateCcw,
  Share2,
  Download,
  Eye,
  BarChart3
} from "lucide-react"
import { QuizResult } from "@/features/quiz/types/quiz"
import Link from "next/link"

// Mock quiz result data
const mockQuizResult: QuizResult = {
  sessionId: "quiz-1",
  score: 85,
  correctAnswers: 17,
  totalQuestions: 20,
  totalTimeSpent: 1800, // 30 minutes
  averageTimePerQuestion: 90,
  difficultyBreakdown: {
    easy: { correct: 6, total: 7 },
    medium: { correct: 8, total: 10 },
    hard: { correct: 3, total: 3 }
  },
  categoryBreakdown: [
    { categoryId: "1", categoryName: "Glomerular Diseases", correct: 8, total: 10 },
    { categoryId: "2", categoryName: "Tubular Diseases", correct: 5, total: 6 },
    { categoryId: "3", categoryName: "Vascular Diseases", correct: 4, total: 4 }
  ],
  attempts: [
    {
      id: "attempt-1",
      quizSessionId: "quiz-1",
      questionId: "q1",
      selectedAnswerId: "a2",
      isCorrect: true,
      timeSpent: 120,
      attemptedAt: "2024-01-01T10:00:00Z"
    },
    {
      id: "attempt-2",
      quizSessionId: "quiz-1",
      questionId: "q2",
      selectedAnswerId: "a1",
      isCorrect: false,
      timeSpent: 90,
      attemptedAt: "2024-01-01T10:02:00Z"
    }
    // ... more attempts
  ],
  completedAt: "2024-01-01T10:30:00Z"
}

export default function QuizResultsPage() {
  const params = useParams()
  const router = useRouter()
  const [result] = useState<QuizResult>(mockQuizResult)

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
    if (score >= 90) return { label: "Excellent", variant: "default" as const, color: "bg-green-100 text-green-800" }
    if (score >= 80) return { label: "Good", variant: "secondary" as const, color: "bg-blue-100 text-blue-800" }
    if (score >= 70) return { label: "Fair", variant: "outline" as const, color: "bg-yellow-100 text-yellow-800" }
    return { label: "Needs Improvement", variant: "destructive" as const, color: "bg-red-100 text-red-800" }
  }

  const scoreBadge = getScoreBadge(result.score)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <Trophy className={`h-16 w-16 ${getScoreColor(result.score)}`} />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Quiz Complete!</h1>
          <p className="text-muted-foreground">Here's how you performed</p>
        </div>
      </div>

      {/* Score Overview */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div>
              <div className={`text-6xl font-bold ${getScoreColor(result.score)}`}>
                {result.score}%
              </div>
              <Badge className={scoreBadge.color}>
                {scoreBadge.label}
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{result.correctAnswers}</div>
                <div className="text-sm text-muted-foreground">Correct</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{result.totalQuestions - result.correctAnswers}</div>
                <div className="text-sm text-muted-foreground">Incorrect</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{formatTime(result.totalTimeSpent)}</div>
                <div className="text-sm text-muted-foreground">Total Time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{formatTime(result.averageTimePerQuestion)}</div>
                <div className="text-sm text-muted-foreground">Avg per Question</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analysis */}
      <Tabs defaultValue="breakdown" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="breakdown">Performance Breakdown</TabsTrigger>
          <TabsTrigger value="questions">Question Review</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="breakdown" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Difficulty Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  By Difficulty
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(result.difficultyBreakdown).map(([difficulty, stats]) => {
                  const percentage = Math.round((stats.correct / stats.total) * 100)
                  return (
                    <div key={difficulty} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="capitalize font-medium">{difficulty}</span>
                        <span className="text-sm text-muted-foreground">
                          {stats.correct}/{stats.total} ({percentage}%)
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Category Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  By Category
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.categoryBreakdown.map((category) => {
                  const percentage = Math.round((category.correct / category.total) * 100)
                  return (
                    <div key={category.categoryId} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm">{category.categoryName}</span>
                        <span className="text-sm text-muted-foreground">
                          {category.correct}/{category.total} ({percentage}%)
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="questions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Question-by-Question Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {result.attempts.map((attempt, index) => (
                  <div key={attempt.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {attempt.isCorrect ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <span className="font-medium">Question {index + 1}</span>
                        <div className="text-sm text-muted-foreground">
                          Time: {formatTime(attempt.timeSpent || 0)}
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      Review
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Excellent performance on Vascular Diseases (100%)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Strong grasp of hard difficulty questions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Consistent timing across questions</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Areas for Improvement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm">Review Glomerular Diseases concepts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm">Focus on easy difficulty questions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm">Practice time management</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle>Recommended Next Steps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Button variant="outline" className="justify-start">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Retake Quiz
                </Button>
                <Button variant="outline" className="justify-start">
                  <Target className="h-4 w-4 mr-2" />
                  Practice Weak Areas
                </Button>
                <Button variant="outline" className="justify-start">
                  <Eye className="h-4 w-4 mr-2" />
                  Review Explanations
                </Button>
                <Button variant="outline" className="justify-start">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  View Progress
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 justify-center">
        <Link href="/dashboard/quiz/new">
          <Button>
            Start New Quiz
          </Button>
        </Link>
        <Button variant="outline">
          <Share2 className="h-4 w-4 mr-2" />
          Share Results
        </Button>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Download Report
        </Button>
        <Link href="/dashboard">
          <Button variant="outline">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  )
}
