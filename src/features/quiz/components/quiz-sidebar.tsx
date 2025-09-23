'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { CheckCircle, XCircle, Circle, Clock, Target } from "lucide-react"
import { QuizSession } from "@/features/quiz/types/quiz"

interface QuizSidebarProps {
  session: QuizSession
  currentQuestionIndex: number
  attempts: Array<{
    questionId: string
    selectedAnswerId: string | null
    isCorrect: boolean
    timeSpent: number
  }>
  onQuestionSelect?: (index: number) => void
  timeRemaining?: number | null
}

export function QuizSidebar({
  session,
  currentQuestionIndex,
  attempts,
  onQuestionSelect,
  timeRemaining
}: QuizSidebarProps) {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const getQuestionStatus = (questionIndex: number) => {
    const question = session.questions[questionIndex]
    if (!question) return 'unanswered'

    const attempt = attempts.find(a => a.questionId === question.id)
    if (!attempt || !attempt.selectedAnswerId) return 'unanswered'

    return attempt.isCorrect ? 'correct' : 'incorrect'
  }

  const getStatusIcon = (questionIndex: number) => {
    const status = getQuestionStatus(questionIndex)
    const isCurrent = questionIndex === currentQuestionIndex

    if (status === 'correct') {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    } else if (status === 'incorrect') {
      return <XCircle className="h-4 w-4 text-red-500" />
    } else if (isCurrent) {
      return <Circle className="h-4 w-4 text-blue-500 fill-blue-500" />
    } else {
      return <Circle className="h-4 w-4 text-gray-400" />
    }
  }

  const getQuestionButtonClass = (questionIndex: number) => {
    const status = getQuestionStatus(questionIndex)
    const isCurrent = questionIndex === currentQuestionIndex

    let baseClass = "w-full justify-start text-left p-2 h-auto"

    if (isCurrent) {
      baseClass += " bg-blue-50 border-blue-200 text-blue-900"
    } else if (status === 'correct') {
      baseClass += " bg-green-50 border-green-200 text-green-900"
    } else if (status === 'incorrect') {
      baseClass += " bg-red-50 border-red-200 text-red-900"
    } else {
      baseClass += " bg-gray-50 border-gray-200 text-gray-700"
    }

    return baseClass
  }

  const getQuestionSnippet = (question: any) => {
    if (!question.stem) return 'Question content...'

    // Remove HTML tags and get first 40 characters
    const plainText = question.stem.replace(/<[^>]*>/g, '').trim()
    return plainText.length > 40 ? plainText.substring(0, 40) + '...' : plainText
  }

  const progress = ((currentQuestionIndex + 1) / session.totalQuestions) * 100

  return (
    <Card className="w-full lg:w-80 sticky top-4 self-start">
      <CardContent className="p-6 space-y-6">
        {/* Quiz Info */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4" />
            <h3 className="text-base font-semibold">Quiz Progress</h3>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Question {currentQuestionIndex + 1} of {session.totalQuestions}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {timeRemaining !== null && timeRemaining !== undefined && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                <span className={`font-mono ${timeRemaining <= 10 ? 'text-red-500' : ''}`}>
                  {formatTime(timeRemaining)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Question Navigation */}
        <div>
          <h3 className="text-base font-semibold mb-4">Questions</h3>
          <div className="space-y-1">
            {session.questions.map((question, index) => (
              <Button
                key={question.id}
                variant="outline"
                className={getQuestionButtonClass(index)}
                onClick={() => onQuestionSelect?.(index)}
                disabled={index > currentQuestionIndex} // Only allow going back or staying on current
              >
                <div className="flex items-center gap-2 w-full">
                  {getStatusIcon(index)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      Q{index + 1}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {getQuestionSnippet(question)}
                    </div>
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
