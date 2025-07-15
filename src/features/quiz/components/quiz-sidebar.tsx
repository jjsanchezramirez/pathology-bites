'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Badge } from "@/shared/components/ui/badge"
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
    if (!attempt) return 'unanswered'
    
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
    
    let baseClass = "w-full justify-start text-left p-3 h-auto"
    
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

  const progress = ((currentQuestionIndex + 1) / session.totalQuestions) * 100

  return (
    <div className="w-full lg:w-80 space-y-4">
      {/* Quiz Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Quiz Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {session.config.mode}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {session.config.timing}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Question Navigation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {session.questions.map((question, index) => (
              <Button
                key={question.id}
                variant="outline"
                className={getQuestionButtonClass(index)}
                onClick={() => onQuestionSelect?.(index)}
                disabled={index > currentQuestionIndex} // Only allow going back or staying on current
              >
                <div className="flex items-center gap-3 w-full">
                  {getStatusIcon(index)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      Q{index + 1}
                    </div>
                    <div className="text-xs text-muted-foreground truncate lg:block hidden">
                      {question.title}
                    </div>
                    {question.difficulty && (
                      <div className="lg:block hidden">
                        <Badge
                          variant="outline"
                          className={`text-xs mt-1 ${
                            question.difficulty.toLowerCase() === 'easy' ? 'border-green-300 text-green-700' :
                            question.difficulty.toLowerCase() === 'medium' ? 'border-yellow-300 text-yellow-700' :
                            'border-red-300 text-red-700'
                          }`}
                        >
                          {question.difficulty}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Circle className="h-4 w-4 text-blue-500 fill-blue-500" />
              <span>Current question</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Answered correctly</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span>Answered incorrectly</span>
            </div>
            <div className="flex items-center gap-2">
              <Circle className="h-4 w-4 text-gray-400" />
              <span>Not answered</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
