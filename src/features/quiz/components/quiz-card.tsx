'use client'

import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import {
  Play,
  Target,
  Calendar,
  Hash,
  Trophy,
  Trash2,
  Eye,
  Timer,
  TimerOff,
  BookOpen,
  GraduationCap,
  HelpCircle,
  Star,
  CheckCircle2,
  Circle,
} from 'lucide-react'
import Link from 'next/link'

export interface QuizSessionListItem {
  id: string
  title: string
  status: string
  mode: string
  difficulty?: string
  totalQuestions: number
  score?: number
  correctAnswers?: number
  createdAt: string
  completedAt?: string
  totalTimeSpent?: number
  currentQuestionIndex?: number
  timeLimit?: number
  timeRemaining?: number
  isTimedMode?: boolean
  config?: {
    mode: string
    timing: string
    questionType: string
    categorySelection: string
  }
}

interface QuizCardProps {
  quiz: QuizSessionListItem
  onDelete: (quiz: QuizSessionListItem) => void
  formatDate: (dateString: string) => string
}

export function QuizCard({ quiz, onDelete, formatDate }: QuizCardProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>
      case 'in_progress':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">In Progress</Badge>
      case 'not_started':
        return <Badge variant="destructive">Not Started</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getModeDisplayText = (mode: string | undefined) => {
    if (!mode) return 'Unknown'

    switch (mode.toLowerCase()) {
      case 'practice':
        return 'Practice'
      case 'tutor':
        return 'Tutor'
      case 'timed':
        return 'Timed'
      case 'untimed':
        return 'Untimed'
      default:
        return mode.charAt(0).toUpperCase() + mode.slice(1)
    }
  }

  const getQuestionTypeDisplay = (quiz: QuizSessionListItem) => {
    const questionType = quiz.config?.questionType || 'all'
    const questionTypeMap = {
      'all': 'All Qs',
      'unused': 'Unused Qs',
      'needsReview': 'Qs for Review',
      'marked': 'Marked Qs',
      'mastered': 'Mastered Qs'
    }
    return questionTypeMap[questionType as keyof typeof questionTypeMap] || 'All Qs'
  }

  const getTimingIcon = (quiz: QuizSessionListItem) => {
    return quiz.isTimedMode ? <Timer className="h-4 w-4" /> : <TimerOff className="h-4 w-4" />
  }

  const getModeIcon = (quiz: QuizSessionListItem) => {
    return quiz.mode === 'tutor' ? <GraduationCap className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />
  }

  const getQuestionTypeIcon = (quiz: QuizSessionListItem) => {
    const questionType = quiz.config?.questionType || 'all'
    const iconMap = {
      'all': <HelpCircle className="h-4 w-4" />,
      'unused': <Circle className="h-4 w-4" />,
      'needsReview': <Target className="h-4 w-4" />,
      'marked': <Star className="h-4 w-4" />,
      'mastered': <CheckCircle2 className="h-4 w-4" />
    }
    return iconMap[questionType as keyof typeof iconMap] || <HelpCircle className="h-4 w-4" />
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        {/* Desktop Layout */}
        <div className="hidden md:flex items-center justify-between">
          {/* Left side content */}
          <div className="flex-1 space-y-3">
            {/* Top left: Quiz title and status */}
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold">{quiz.title}</h3>
              {getStatusBadge(quiz.status)}
            </div>

            {/* Bottom left: All metadata in one row */}
            <div className="flex items-center gap-6 text-sm text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1">
                <Hash className="h-4 w-4" />
                <span>
                  {quiz.status === 'in_progress'
                    ? `${(quiz.currentQuestionIndex || 0) + 1} of ${quiz.totalQuestions} (${Math.round(((quiz.currentQuestionIndex || 0) + 1) / quiz.totalQuestions * 100)}%)`
                    : `${quiz.totalQuestions} questions`
                  }
                </span>
              </div>

              {quiz.score !== undefined && quiz.score !== null && (
                <div className="flex items-center gap-1">
                  <Trophy className="h-4 w-4" />
                  <span>Score {Math.round(quiz.score)}%</span>
                </div>
              )}

              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(quiz.createdAt)}</span>
              </div>

              <div className="flex items-center gap-1">
                {getModeIcon(quiz)}
                <span>{getModeDisplayText(quiz.mode)}</span>
              </div>

              <div className="flex items-center gap-1">
                {getTimingIcon(quiz)}
                <span>{quiz.isTimedMode ? 'Timed' : 'Untimed'}</span>
              </div>

              <div className="flex items-center gap-1">
                {getQuestionTypeIcon(quiz)}
                <span>{getQuestionTypeDisplay(quiz)}</span>
              </div>
            </div>
          </div>

          {/* Right side: Action buttons */}
          <div className="flex items-center gap-2 ml-4">
            {quiz.status === 'in_progress' && (
              <Link href={`/dashboard/quiz/${quiz.id}`}>
                <Button size="sm">
                  <Play className="h-4 w-4 mr-2" />
                  Continue
                </Button>
              </Link>
            )}
            {quiz.status === 'completed' && (
              <Link href={`/dashboard/quiz/${quiz.id}/review`}>
                <Button size="sm" variant="outline">
                  <Eye className="h-4 w-4 mr-2" />
                  Review
                </Button>
              </Link>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(quiz)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">{quiz.title}</h3>
              {getStatusBadge(quiz.status)}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(quiz)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Hash className="h-4 w-4" />
              <span>{quiz.totalQuestions} Qs</span>
            </div>
            {quiz.score !== undefined && quiz.score !== null && (
              <div className="flex items-center gap-1">
                <Trophy className="h-4 w-4" />
                <span>{Math.round(quiz.score)}%</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              {getModeIcon(quiz)}
              <span>{getModeDisplayText(quiz.mode)}</span>
            </div>
            <div className="flex items-center gap-1">
              {getTimingIcon(quiz)}
              <span>{quiz.isTimedMode ? 'Timed' : 'Untimed'}</span>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            <Calendar className="h-3 w-3 inline mr-1" />
            {formatDate(quiz.createdAt)}
          </div>

          {quiz.status === 'in_progress' && (
            <Link href={`/dashboard/quiz/${quiz.id}`}>
              <Button size="sm" className="w-full">
                <Play className="h-4 w-4 mr-2" />
                Continue Quiz
              </Button>
            </Link>
          )}
          {quiz.status === 'completed' && (
            <Link href={`/dashboard/quiz/${quiz.id}/review`}>
              <Button size="sm" variant="outline" className="w-full">
                <Eye className="h-4 w-4 mr-2" />
                Review Answers
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

