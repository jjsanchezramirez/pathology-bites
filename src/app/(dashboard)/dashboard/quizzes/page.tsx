// src/app/(dashboard)/dashboard/quizzes/page.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import { Input } from "@/shared/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/shared/components/ui/select"
import {
  Play,
  Clock,
  Target,
  Calendar,
  Search,

  Plus,
  Trash2,
  Eye,

} from "lucide-react"

import { toast } from "sonner"
import Link from "next/link"

interface QuizSessionListItem {
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
}

export default function QuizzesPage() {
  const [quizzes, setQuizzes] = useState<QuizSessionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [modeFilter, setModeFilter] = useState<string>("all")

  // Fetch quizzes on component mount
  const fetchQuizzes = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== "all") {
        params.append("status", statusFilter)
      }
      params.append("limit", "50")

      const response = await fetch(`/api/quiz/sessions?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch quizzes')
      }

      const result = await response.json()
      setQuizzes(result.data)
    } catch (error) {
      console.error('Error fetching quizzes:', error)
      toast.error('Failed to load quizzes')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchQuizzes()
  }, [fetchQuizzes])

  const handleDeleteQuiz = async (quizId: string) => {
    if (!confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/quiz/sessions/${quizId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete quiz')
      }

      toast.success('Quiz deleted successfully')
      fetchQuizzes() // Refresh the list
    } catch (error) {
      console.error('Error deleting quiz:', error)
      toast.error('Failed to delete quiz')
    }
  }

  const filteredQuizzes = quizzes.filter(quiz => {
    const matchesSearch = quiz.title.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesMode = modeFilter === "all" || quiz.mode === modeFilter
    return matchesSearch && matchesMode
  })

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        return 'Invalid date'
      }
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (error) {
      return 'Invalid date'
    }
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const formatTimeRemaining = (seconds?: number) => {
    if (!seconds) return 'N/A'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s remaining`
    }
    return `${secs}s remaining`
  }

  const getProgressText = (quiz: QuizSessionListItem) => {
    if (quiz.status === 'completed') {
      return `${quiz.totalQuestions} questions`
    }

    const currentIndex = quiz.currentQuestionIndex ?? 0
    const completed = currentIndex
    const total = quiz.totalQuestions
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

    return `${completed} of ${total} (${percentage}%)`
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>
      case 'in_progress':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">In Progress</Badge>
      case 'not_started':
        return <Badge variant="outline">Not Started</Badge>
      case 'paused':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Paused</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getModeBadge = (quiz: QuizSessionListItem) => {
    const modeConfig = {
      tutor: { label: 'Tutor', color: 'bg-purple-100 text-purple-800' },
      timed: { label: 'Timed', color: 'bg-red-100 text-red-800' },
      untimed: { label: 'Untimed', color: 'bg-blue-100 text-blue-800' },
      practice: { label: 'Practice', color: 'bg-green-100 text-green-800' },
      review: { label: 'Review', color: 'bg-gray-100 text-gray-800' }
    }

    // Determine the display text based on mode and timing
    let displayText = getModeDisplayText(quiz.mode)
    if (quiz.isTimedMode) {
      displayText += ' (Timed)'
    } else if (quiz.mode && quiz.mode !== 'timed') {
      displayText += ' (Untimed)'
    }

    const colorKey = quiz.isTimedMode ? 'timed' : (quiz.mode?.toLowerCase() || 'unknown')
    const config = modeConfig[colorKey as keyof typeof modeConfig] || { label: displayText, color: 'bg-gray-100 text-gray-800' }

    return <Badge className={config.color}>{displayText}</Badge>
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Quizzes</h1>
          <p className="text-muted-foreground">Loading your quiz history...</p>
        </div>
        <div className="grid gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-6 bg-gray-200 rounded animate-pulse w-1/3" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-1/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Quizzes</h1>
          <p className="text-muted-foreground">
            Track your quiz history and continue where you left off
          </p>
        </div>
        <Link href="/dashboard/quiz/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Quiz
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search quizzes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
            <Select value={modeFilter} onValueChange={setModeFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                <SelectItem value="tutor">Tutor</SelectItem>
                <SelectItem value="timed">Timed</SelectItem>
                <SelectItem value="untimed">Untimed</SelectItem>
                <SelectItem value="practice">Practice</SelectItem>
                <SelectItem value="review">Review</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Quiz List */}
      <div className="space-y-4">
        {filteredQuizzes.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="space-y-4">
                <div className="text-muted-foreground">
                  {searchTerm || statusFilter !== "all" || modeFilter !== "all"
                    ? "No quizzes match your current filters"
                    : "You haven't taken any quizzes yet"
                  }
                </div>
                <Link href="/dashboard/quiz/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Quiz
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredQuizzes.map((quiz) => (
            <Card key={quiz.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">{quiz.title}</h3>
                      {getStatusBadge(quiz.status)}
                      {getModeBadge(quiz)}
                      {quiz.difficulty && (
                        <Badge variant="outline" className="capitalize">
                          {quiz.difficulty}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Target className="h-4 w-4" />
                        {getProgressText(quiz)}
                      </div>

                      {quiz.score !== undefined && quiz.score !== null && (
                        <div className="flex items-center gap-1">
                          <span>Score: {Math.round(quiz.score)}%</span>
                        </div>
                      )}

                      {quiz.isTimedMode && quiz.timeRemaining && quiz.status !== 'completed' && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatTimeRemaining(quiz.timeRemaining)}
                        </div>
                      )}

                      {quiz.totalTimeSpent && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatDuration(quiz.totalTimeSpent)}
                        </div>
                      )}

                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(quiz.createdAt)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {quiz.status === 'completed' && (
                      <Link href={`/dashboard/quiz/${quiz.id}/results`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          Results
                        </Button>
                      </Link>
                    )}

                    {(quiz.status === 'in_progress' || quiz.status === 'paused') && (
                      <Link href={`/dashboard/quiz/${quiz.id}`}>
                        <Button size="sm">
                          <Play className="h-4 w-4 mr-2" />
                          Continue
                        </Button>
                      </Link>
                    )}

                    {quiz.status === 'not_started' && (
                      <Link href={`/dashboard/quiz/${quiz.id}`}>
                        <Button size="sm">
                          <Play className="h-4 w-4 mr-2" />
                          Start
                        </Button>
                      </Link>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteQuiz(quiz.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}