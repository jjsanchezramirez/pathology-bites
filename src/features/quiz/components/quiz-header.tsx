// src/features/quiz/components/quiz-header.tsx

"use client"

import { Button } from "@/shared/components/ui/button"
import { Timer, Pause, Play, Flag } from "lucide-react"

interface QuizHeaderProps {
  title: string
  currentQuestionIndex: number
  totalQuestions: number
  globalTimeRemaining: number | null
  timing: 'timed' | 'untimed'
  status: 'not_started' | 'in_progress' | 'paused' | 'completed'
  isPaused: boolean
  onPauseQuiz: () => void
  onResumeQuiz: () => void
  onFlagQuestion: () => void
}

export function QuizHeader({
  title,
  currentQuestionIndex,
  totalQuestions,
  globalTimeRemaining,
  timing,
  status,
  isPaused,
  onPauseQuiz,
  onResumeQuiz,
  onFlagQuestion
}: QuizHeaderProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">
          Question {currentQuestionIndex + 1} of {totalQuestions}
        </p>
      </div>

      <div className="flex items-center gap-4">
        {globalTimeRemaining !== null && timing === 'timed' && (
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4" />
            <span className={`font-mono ${
              globalTimeRemaining <= 60 
                ? 'text-red-500' 
                : globalTimeRemaining <= 300 
                ? 'text-yellow-500' 
                : ''
            }`}>
              {formatTime(globalTimeRemaining)}
            </span>
            <span className="text-sm text-muted-foreground">
              (Total Quiz Time)
            </span>
          </div>
        )}

        {/* Pause/Resume Button - Timed Mode Only */}
        {timing === 'timed' && status === 'in_progress' && !isPaused && (
          <Button variant="outline" size="sm" onClick={onPauseQuiz}>
            <Pause className="h-4 w-4 mr-2" />
            Pause
          </Button>
        )}

        {timing === 'timed' && status === 'paused' && isPaused && (
          <Button variant="outline" size="sm" onClick={onResumeQuiz}>
            <Play className="h-4 w-4 mr-2" />
            Resume
          </Button>
        )}

        {/* Flag Question Button */}
        {status === 'in_progress' && !isPaused && (
          <Button variant="outline" size="sm" onClick={onFlagQuestion}>
            <Flag className="h-4 w-4 mr-2" />
            Flag
          </Button>
        )}
      </div>
    </div>
  )
}
