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
    // Handle invalid input (but allow 0)
    if (timeValue == null || isNaN(timeValue) || timeValue < 0) {
      return '0:00'
    }

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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-sm text-muted-foreground">
                    <th className="text-left py-3 px-3 font-medium">Category</th>
                    <th className="text-center py-3 px-3 font-medium">Correct</th>
                    <th className="text-center py-3 px-3 font-medium">Incorrect</th>
                    <th className="text-center py-3 px-3 font-medium">Total</th>
                    <th className="text-center py-3 px-3 font-medium">Avg Time</th>
                    <th className="text-right py-3 px-3 font-medium hidden md:table-cell">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {result.categoryBreakdown.map((category) => {
                    const incorrect = category.total - category.correct
                    const categoryPercentage = category.total > 0
                      ? Math.round((category.correct / category.total) * 100)
                      : 0

                    // Use exact admin category badge styling
                    const getCategoryBadgeClass = (cat: typeof category) => {
                      if (cat.categoryColor) {
                        return ''
                      }

                      const shortForm = cat.categoryShortForm || cat.parentShortForm

                      // Main categories
                      if (shortForm === 'AP') return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
                      if (shortForm === 'CP') return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'

                      // AP subspecialties
                      if (cat.parentShortForm === 'AP') {
                        const colors = [
                          'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800',
                          'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800',
                          'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
                          'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-800',
                          'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800',
                          'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800',
                          'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-800',
                          'bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-900/20 dark:text-lime-300 dark:border-lime-800'
                        ]
                        const hash = shortForm ? shortForm.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 0
                        return colors[hash % colors.length]
                      }

                      // CP subspecialties
                      if (cat.parentShortForm === 'CP') {
                        const colors = [
                          'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800',
                          'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800',
                          'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800',
                          'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
                          'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
                        ]
                        const hash = shortForm ? shortForm.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 0
                        return colors[hash % colors.length]
                      }

                      return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800'
                    }

                    const getCustomColorStyle = (color: string) => {
                      const hslMatch = color.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/)
                      if (hslMatch) {
                        const [, h, s] = hslMatch
                        return {
                          backgroundColor: `hsl(${h} ${Math.min(parseInt(s), 50)}% 90%)`,
                          color: `hsl(${h} ${s}% 20%)`,
                          borderColor: `hsl(${h} ${Math.min(parseInt(s), 60)}% 70%)`
                        }
                      }
                      return {
                        backgroundColor: color + '20',
                        color: color,
                        borderColor: color + '40'
                      }
                    }

                    return (
                      <tr key={category.categoryId}>
                        <td className="py-4 px-3">
                          {/* Desktop: Full name */}
                          <Badge
                            variant="outline"
                            className={`hidden md:inline-flex ${getCategoryBadgeClass(category)}`}
                            style={category.categoryColor ? getCustomColorStyle(category.categoryColor) : undefined}
                          >
                            {category.categoryName}
                          </Badge>
                          {/* Mobile: Short form */}
                          <Badge
                            variant="outline"
                            className={`md:hidden ${getCategoryBadgeClass(category)}`}
                            style={category.categoryColor ? getCustomColorStyle(category.categoryColor) : undefined}
                          >
                            {category.categoryShortForm || category.categoryName}
                          </Badge>
                        </td>
                        <td className="py-4 px-3 text-center">
                          <span className={`font-semibold text-base ${category.correct > 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                            {category.correct}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-center">
                          <span className={`font-semibold text-base ${incorrect > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                            {incorrect}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-center font-semibold text-base">
                          {category.total}
                        </td>
                        <td className="py-4 px-3 text-center text-sm text-muted-foreground">
                          {formatTime(category.averageTime)}
                        </td>
                        <td className="py-4 px-3 text-right hidden md:table-cell">
                          <div className="flex items-center justify-end gap-3">
                            <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all duration-1000 ${
                                  categoryPercentage >= 70 ? 'bg-green-500' : categoryPercentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${categoryPercentage}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold w-12">
                              {categoryPercentage}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
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
              {result.questionDetails.map((question, index) => {
                // Get category badge styling
                const getCategoryBadgeClass = (categoryName: string) => {
                  if (categoryName.includes('Hematopathology')) return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
                  if (categoryName.includes('Clinical')) return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
                  if (categoryName.includes('Dermatopathology')) return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800'
                  return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800'
                }

                const successRatePercentage = Math.round(question.successRate)

                return (
                  <div key={question.id} className="flex flex-col md:flex-row md:items-center md:justify-between p-4 rounded-lg border gap-3">
                    <div className="flex items-start md:items-center gap-3 flex-1 min-w-0">
                      <div className="flex items-center justify-center w-10 h-10 flex-shrink-0 rounded-full bg-muted text-sm font-semibold">
                        Q{index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm line-clamp-2 md:line-clamp-1 mb-2">
                          {question.title || `Question ${index + 1}`}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Badge variant="outline" className={`text-xs w-fit ${getCategoryBadgeClass(question.category)}`}>
                            {question.category}
                          </Badge>
                          <div className="text-xs text-muted-foreground">
                            {successRatePercentage}% of users answered correctly
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between md:justify-end gap-3 md:flex-shrink-0">
                      <div className="text-sm text-muted-foreground">
                        {formatTime(question.timeSpent)}
                      </div>
                      <Badge variant={question.isCorrect ? "default" : "destructive"} className="flex-shrink-0">
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
                )
              })}
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
