// src/features/quiz/components/quiz-header.tsx

"use client"

import { Button } from "@/shared/components/ui/button"
import { Timer, Pause, Play, Flag, Save, Check, Loader2, WifiOff, AlertCircle } from "lucide-react"
import type { SyncStatus } from "@/features/quiz/config/auto-save-config"

interface QuizHeaderProps {
  title: string
  currentQuestionIndex: number
  totalQuestions: number
  globalTimeRemaining: number | null
  timing: 'timed' | 'untimed'
  status: 'not_started' | 'in_progress' | 'completed'
  isPaused: boolean
  onPauseQuiz: () => void
  onResumeQuiz: () => void
  onSaveAndExit?: () => void
  onFlagQuestion: () => void
  syncStatus?: SyncStatus
  lastSyncTime?: number | null
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
  onSaveAndExit,
  onFlagQuestion,
  syncStatus,
  lastSyncTime
}: QuizHeaderProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatRelativeTime = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    return `${Math.floor(seconds / 3600)}h ago`
  }

  const getSyncIcon = () => {
    if (!syncStatus) return null

    switch (syncStatus.state) {
      case 'saved':
      case 'synced':
        return <Check className="h-4 w-4 text-green-500" />
      case 'syncing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'offline':
      case 'queued':
        return <WifiOff className="h-4 w-4 text-yellow-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  return (
    <div className="space-y-3">
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

          {/* Pause/Resume Button - Timed Mode */}
          {timing === 'timed' && status === 'in_progress' && (
            <Button variant="outline" size="sm" onClick={isPaused ? onResumeQuiz : onPauseQuiz}>
              {isPaused ? (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </>
              )}
            </Button>
          )}

          {/* Save & Exit Button - Untimed Mode */}
          {timing === 'untimed' && status === 'in_progress' && !isPaused && onSaveAndExit && (
            <Button variant="outline" size="sm" onClick={onSaveAndExit}>
              <Save className="h-4 w-4 mr-2" />
              Save & Exit
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

      {/* Sync Status Indicator */}
      {syncStatus && syncStatus.state !== 'idle' && (
        <div className="flex items-center gap-2 text-sm">
          {getSyncIcon()}
          <span className="text-muted-foreground">{syncStatus.message}</span>
          {lastSyncTime && syncStatus.state === 'synced' && (
            <span className="text-xs text-muted-foreground">
              • {formatRelativeTime(lastSyncTime)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
