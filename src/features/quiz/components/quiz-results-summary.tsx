"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import { CircularProgress } from "@/shared/components/ui/circular-progress"
import { Clock, Target, TrendingUp, RotateCcw, Eye } from "lucide-react"
import { QuizResult } from "@/features/quiz/types/quiz"
import Link from "next/link"
import { useEffect } from "react"
import confetti from "canvas-confetti"

interface QuizResultsSummaryProps {
  result: QuizResult
  sessionId: string
  onRetakeMissed?: () => void
  onReviewQuestions?: () => void
}

export function QuizResultsSummary({ 
  result, 
  sessionId, 
  onRetakeMissed, 
  onReviewQuestions 
}: QuizResultsSummaryProps) {
  const percentage = Math.round((result.correctAnswers / result.totalQuestions) * 100)
  const incorrectCount = result.totalQuestions - result.correctAnswers
  
  const formatTime = (timeValue: number): string => {
    // Handle legacy data that might be in milliseconds
    // If the value is unreasonably large (> 3600 seconds = 1 hour), assume it's in milliseconds
    let seconds = timeValue
    if (timeValue > 3600) {
      seconds = Math.round(timeValue / 1000)
    }

    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 2-tier performance system
  const getPerformanceTier = (score: number) => {
    return score < 60 ? 'low' : 'good'
  }

  const getPerformanceMessage = (score: number): { message: string; color: string } => {
    if (score < 50) return { message: "Don't give up! Review the material and try again.", color: "text-red-600" }
    if (score < 60) return { message: "Keep practicing! You're making progress.", color: "text-red-600" }
    if (score < 70) return { message: "Good start! Keep building your knowledge.", color: "text-primary" }
    if (score < 80) return { message: "Well done! You're getting the hang of it.", color: "text-primary" }
    if (score < 90) return { message: "Great job! Your understanding is solid.", color: "text-primary" }
    if (score < 95) return { message: "Excellent work! You've mastered this material.", color: "text-primary" }
    return { message: "Outstanding! Perfect performance!", color: "text-primary" }
  }

  const performance = getPerformanceMessage(percentage)
  const tier = getPerformanceTier(percentage)

  // Exponential confetti system
  const triggerConfetti = (score: number) => {
    if (score < 50) return // No confetti for very low scores

    // Exponential scaling: each 10 points significantly increases intensity
    const baseIntensity = Math.max(0, (score - 50) / 10) // 0 at 50%, 1 at 60%, 2 at 70%, etc.
    const exponentialIntensity = Math.pow(baseIntensity, 1.5) // Exponential growth

    const particleCount = Math.round(20 + (exponentialIntensity * 40)) // 20-200+ particles
    const spread = Math.round(40 + (exponentialIntensity * 20)) // 40-80+ spread

    confetti({
      particleCount,
      spread,
      origin: { y: 0.6 },
      colors: ['#16a34a', '#22d3ee', '#f59e0b', '#ec4899']
    })
  }

  // Auto-trigger confetti for scores 50% and above
  useEffect(() => {
    if (percentage >= 50) {
      const timer = setTimeout(() => {
        triggerConfetti(percentage)
      }, 1500) // Delay to let animations start

      return () => clearTimeout(timer)
    }
  }, [percentage])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header with Text Animations */}
      <div className="text-center space-y-2">
        <h1 className={`text-3xl font-bold ${performance.color}`}>
          {tier === 'good' ? (
            // Good Performance (≥60%): Letter drop animation
            <span className="inline-block">
              {"Quiz Complete!".split('').map((letter, index) => (
                <span
                  key={`${percentage}-${index}`}
                  className="inline-block animate-letter-drop"
                  style={{
                    animationDelay: `${index * 80 + 300}ms`,
                    animationFillMode: 'both'
                  }}
                >
                  {letter === ' ' ? '\u00A0' : letter}
                </span>
              ))}
            </span>
          ) : percentage < 50 ? (
            // Very Low Performance (<50%): Tremble animation
            <span
              key={`tremble-${percentage}`}
              className="animate-tremble inline-block"
            >
              Quiz Complete!
            </span>
          ) : (
            // Low Performance (50-59%): Static text
            "Quiz Complete!"
          )}
        </h1>
        <p className={`text-lg ${performance.color}`}>{performance.message}</p>
      </div>

      {/* Main Score Display */}
      <Card className="text-center">
        <CardContent className="pt-8 pb-6">
          <div className="flex justify-center mb-6">
            <CircularProgress
              key={`progress-${percentage}`}
              value={percentage}
              size={160}
              strokeWidth={12}
              animationDuration={2000}
            />
          </div>
          <div className="space-y-2">
            <p className="text-2xl font-bold">
              {result.correctAnswers} out of {result.totalQuestions} correct
            </p>
            <p className="text-muted-foreground">
              You scored {percentage}% on this quiz
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex justify-center mb-2">
              <Target className="h-6 w-6 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-green-600">{result.correctAnswers}</div>
            <div className="text-sm text-muted-foreground">Correct</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex justify-center mb-2">
              <Target className="h-6 w-6 text-red-600" />
            </div>
            <div className="text-2xl font-bold text-red-600">{incorrectCount}</div>
            <div className="text-sm text-muted-foreground">Incorrect</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex justify-center mb-2">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {formatTime(result.totalTimeSpent)}
            </div>
            <div className="text-sm text-muted-foreground">Total Time</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex justify-center mb-2">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {formatTime(result.averageTimePerQuestion)}
            </div>
            <div className="text-sm text-muted-foreground">Average per Question</div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      {result.categoryBreakdown && result.categoryBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {result.categoryBreakdown.map((category) => {
                const categoryPercentage = category.total > 0 
                  ? Math.round((category.correct / category.total) * 100) 
                  : 0
                return (
                  <div key={category.categoryId} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{category.categoryName}</span>
                      <Badge variant="outline">
                        {category.correct}/{category.total}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-1000"
                          style={{ width: `${categoryPercentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">
                        {categoryPercentage}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Question-by-Question Breakdown */}
      {result.questionDetails && result.questionDetails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance by Question</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {result.questionDetails.map((question, index) => (
                <div key={question.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm truncate max-w-md">
                        {question.title || `Question ${index + 1}`}
                      </div>
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
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">
                        {formatTime(question.timeSpent)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {Math.round(question.successRate)}% success rate
                      </div>
                    </div>
                    <Badge variant={question.isCorrect ? "default" : "destructive"} className="ml-2">
                      {question.isCorrect ? (
                        <>
                          <Target className="h-3 w-3 mr-1" />
                          Correct
                        </>
                      ) : (
                        <>
                          <Target className="h-3 w-3 mr-1" />
                          Incorrect
                        </>
                      )}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {incorrectCount > 0 && onRetakeMissed && (
          <Button onClick={onRetakeMissed} className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Retake Missed Questions
          </Button>
        )}
        
        <Button 
          variant="outline" 
          onClick={onReviewQuestions}
          className="flex items-center gap-2"
        >
          <Eye className="h-4 w-4" />
          Review Questions
        </Button>

        <Link href="/dashboard">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  )
}
