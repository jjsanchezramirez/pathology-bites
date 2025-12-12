// src/app/(dashboard)/dashboard/quizzes/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useCachedData } from "@/shared/hooks/use-cached-data"
import { Card, CardContent } from "@/shared/components/ui/card"
import { Skeleton } from "@/shared/components/ui/skeleton"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog"
import {
  Play,
  Target,
  Calendar,
  Search,
  Hash,
  Trophy,
  Plus,
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
} from "lucide-react"

import { toast } from "sonner"
import Link from "next/link"
import { FeaturePlaceholder } from "@/features/dashboard/components"
import { isQuizFeaturesEnabled } from "@/shared/config/feature-flags"
import { apiClient } from "@/shared/utils/api-client"

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
  config?: {
    mode: string
    timing: string
    questionType: string
    categorySelection: string
  }
}

export default function QuizzesPage() {
  const featuresEnabled = isQuizFeaturesEnabled()
  const [quizzes, setQuizzes] = useState<QuizSessionListItem[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedFilters, setSelectedFilters] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<string>("date-desc")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedQuiz, setSelectedQuiz] = useState<QuizSessionListItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Optimized quiz fetching with caching (fetch all, filter client-side)
  const { data: quizzesData, isLoading, error, invalidate } = useCachedData(
    'quiz-sessions-all',
    async () => {
      const params = new URLSearchParams()
      params.append("limit", "100") // Increased limit

      const response = await fetch(`/api/quiz/sessions?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch quizzes')
      }

      const result = await response.json()
      return result.data
    },
    {
      ttl: 2 * 60 * 1000, // 2 minutes cache
      staleTime: 1 * 60 * 1000, // 1 minute stale time
      storage: 'memory', // Use memory for session data
      prefix: 'pathology-bites-quizzes'
    }
  )

  // Update quizzes when data changes
  useEffect(() => {
    if (quizzesData) {
      setQuizzes(quizzesData)
    }
    if (error) {
      toast.error('Failed to load quizzes')
    }
  }, [quizzesData, error])

  const handleDeleteClick = (quiz: QuizSessionListItem) => {
    setSelectedQuiz(quiz)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedQuiz) return

    try {
      setIsDeleting(true)

      const response = await apiClient.delete(`/api/quiz/sessions/${selectedQuiz.id}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete quiz')
      }

      toast.success('Quiz deleted successfully')

      // Invalidate cache to force refresh
      invalidate()

      // Also update local state immediately for instant UI feedback
      setQuizzes(prev => prev.filter(quiz => quiz.id !== selectedQuiz.id))
      setShowDeleteDialog(false)
      setSelectedQuiz(null)
    } catch (error) {
      console.error('Delete quiz error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete quiz')
    } finally {
      setIsDeleting(false)
    }
  }

  // Filter quizzes based on search and selected filters
  const filteredQuizzes = quizzes.filter(quiz => {
    // Search filter
    const matchesSearch = quiz.title.toLowerCase().includes(searchTerm.toLowerCase())

    // Multi-select filters
    if (selectedFilters.length === 0) {
      return matchesSearch
    }

    const matchesFilter = selectedFilters.some(filter => {
      // Status filters
      if (filter === quiz.status) return true
      // Mode filters
      if (filter === quiz.mode) return true
      // Timing filters
      if (filter === 'timed' && quiz.isTimedMode) return true
      if (filter === 'untimed' && !quiz.isTimedMode) return true

      return false
    })

    return matchesSearch && matchesFilter
  })

  // Sort quizzes
  const sortedQuizzes = [...filteredQuizzes].sort((a, b) => {
    switch (sortBy) {
      case 'date-desc':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'date-asc':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      case 'score-desc':
        return (b.score || 0) - (a.score || 0)
      case 'score-asc':
        return (a.score || 0) - (b.score || 0)
      case 'progress':
        // Incomplete first (not_started, in_progress), then completed
        const statusOrder = { not_started: 0, in_progress: 1, completed: 2 }
        return (statusOrder[a.status as keyof typeof statusOrder] || 99) -
               (statusOrder[b.status as keyof typeof statusOrder] || 99)
      default:
        return 0
    }
  })

  // Calculate statistics
  const stats = {
    total: quizzes.length,
    completed: quizzes.filter(q => q.status === 'completed').length,
    inProgress: quizzes.filter(q => q.status === 'in_progress').length,
    averageScore: quizzes.filter(q => q.score !== undefined && q.score !== null).length > 0
      ? Math.round(
          quizzes
            .filter(q => q.score !== undefined && q.score !== null)
            .reduce((sum, q) => sum + (q.score || 0), 0) /
          quizzes.filter(q => q.score !== undefined && q.score !== null).length
        )
      : 0,
    totalTimeSpent: quizzes.reduce((sum, q) => sum + (q.totalTimeSpent || 0), 0)
  }

  const formatTimeSpent = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  }

  // Show placeholder if features are disabled
  if (!featuresEnabled) {
    return (
      <FeaturePlaceholder
        title="My Quizzes"
        description="Your complete quiz history and detailed review tools are being finalized. Soon you'll be able to review all your past quizzes, track your performance over time, and revisit questions to reinforce your learning."
        status="almost-ready"
      />
    )
  }

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
    } catch {
      return 'Invalid date'
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Quizzes</h1>
          <p className="text-muted-foreground">Loading your quiz history...</p>
        </div>

        {/* Filters Skeleton */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>

        {/* Quiz Cards Skeleton */}
        <div className="grid gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="space-y-1">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-4 w-12" />
                      </div>
                      <div className="space-y-1">
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-4 w-8" />
                      </div>
                      <div className="space-y-1">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                      <div className="space-y-1">
                        <Skeleton className="h-3 w-14" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-9 w-16" />
                    <Skeleton className="h-9 w-9" />
                  </div>
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

      {/* Statistics Summary */}
      {!isLoading && quizzes.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Total Quizzes</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Completed</div>
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">In Progress</div>
              <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Avg Score</div>
              <div className="text-2xl font-bold">{stats.averageScore}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Total Time</div>
              <div className="text-2xl font-bold">{formatTimeSpent(stats.totalTimeSpent)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
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

            {/* Combined Filters Dropdown */}
            <Select
              value={selectedFilters.length === 0 ? "all" : selectedFilters.join(",")}
              onValueChange={(value) => {
                if (value === "all") {
                  setSelectedFilters([])
                } else {
                  // Toggle filter
                  const filter = value
                  setSelectedFilters(prev =>
                    prev.includes(filter)
                      ? prev.filter(f => f !== filter)
                      : [...prev, filter]
                  )
                }
              }}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder={selectedFilters.length === 0 ? "All Filters" : `${selectedFilters.length} filters`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Filters</SelectItem>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Status</div>
                <SelectItem value="completed">✓ Completed</SelectItem>
                <SelectItem value="in_progress">⟳ In Progress</SelectItem>
                <SelectItem value="not_started">○ Not Started</SelectItem>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Mode</div>
                <SelectItem value="tutor">Tutor</SelectItem>
                <SelectItem value="practice">Practice</SelectItem>
                <SelectItem value="review">Review</SelectItem>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Timing</div>
                <SelectItem value="timed">Timed</SelectItem>
                <SelectItem value="untimed">Untimed</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Dropdown */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Newest First</SelectItem>
                <SelectItem value="date-asc">Oldest First</SelectItem>
                <SelectItem value="score-desc">Highest Score</SelectItem>
                <SelectItem value="score-asc">Lowest Score</SelectItem>
                <SelectItem value="progress">Incomplete First</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Active Filters Display */}
          {selectedFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {selectedFilters.map(filter => (
                <Badge
                  key={filter}
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => setSelectedFilters(prev => prev.filter(f => f !== filter))}
                >
                  {filter} ×
                </Badge>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFilters([])}
                className="h-6 px-2 text-xs"
              >
                Clear all
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quiz List */}
      <div className="space-y-4">
        {sortedQuizzes.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="space-y-4">
                <div className="text-muted-foreground">
                  {searchTerm || selectedFilters.length > 0
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
          sortedQuizzes.map((quiz) => (
            <Card key={quiz.id} className="hover:shadow-md transition-shadow">
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

                      {quiz.difficulty && (
                        <div className="flex items-center gap-1">
                          <Target className="h-4 w-4" />
                          <span className="capitalize">{quiz.difficulty}</span>
                        </div>
                      )}

                      {quiz.totalTimeSpent !== undefined && quiz.totalTimeSpent > 0 && (
                        <div className="flex items-center gap-1">
                          <Timer className="h-4 w-4" />
                          <span>{formatTimeSpent(quiz.totalTimeSpent)}</span>
                        </div>
                      )}

                      {quiz.isTimedMode && quiz.status === 'in_progress' && quiz.timeRemaining !== undefined && quiz.timeRemaining !== null && (
                        <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                          <Timer className="h-4 w-4" />
                          <span className="font-medium">{formatTimeSpent(quiz.timeRemaining)} left</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right side: Buttons vertically centered */}
                  <div className="flex items-center gap-2 ml-6">
                    {quiz.status === 'completed' && (
                      <Link href={`/dashboard/quiz/${quiz.id}/results`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          Results
                        </Button>
                      </Link>
                    )}

                    {quiz.status === 'in_progress' && (
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
                      onClick={() => handleDeleteClick(quiz)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Mobile Layout */}
                <div className="md:hidden space-y-3">
                  {/* First line: Quiz title and status */}
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold truncate flex-1 min-w-0">{quiz.title}</h3>
                    {getStatusBadge(quiz.status)}
                  </div>

                  {/* Second line: Questions and Score (try to fit date here too) */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
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

                    {/* Try to fit date on same line, will wrap if needed */}
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(quiz.createdAt)}</span>
                    </div>
                  </div>

                  {/* Third line: Mode, Timing, Question Type, Difficulty, Time */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
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

                    {quiz.difficulty && (
                      <div className="flex items-center gap-1">
                        <Target className="h-4 w-4" />
                        <span className="capitalize">{quiz.difficulty}</span>
                      </div>
                    )}

                    {quiz.totalTimeSpent !== undefined && quiz.totalTimeSpent > 0 && (
                      <div className="flex items-center gap-1">
                        <Timer className="h-4 w-4" />
                        <span>{formatTimeSpent(quiz.totalTimeSpent)}</span>
                      </div>
                    )}

                    {quiz.isTimedMode && quiz.status === 'in_progress' && quiz.timeRemaining !== undefined && quiz.timeRemaining !== null && (
                      <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                        <Timer className="h-4 w-4" />
                        <span className="font-medium">{formatTimeSpent(quiz.timeRemaining)} left</span>
                      </div>
                    )}
                  </div>

                  {/* Action buttons at bottom */}
                  <div className="pt-2 flex items-center gap-2">
                    {quiz.status === 'completed' && (
                      <Link href={`/dashboard/quiz/${quiz.id}/results`} className="flex-1">
                        <Button variant="outline" className="w-full">
                          <Eye className="h-4 w-4 mr-2" />
                          Results
                        </Button>
                      </Link>
                    )}

                    {quiz.status === 'in_progress' && (
                      <Link href={`/dashboard/quiz/${quiz.id}`} className="flex-1">
                        <Button className="w-full">
                          <Play className="h-4 w-4 mr-2" />
                          Continue
                        </Button>
                      </Link>
                    )}

                    {quiz.status === 'not_started' && (
                      <Link href={`/dashboard/quiz/${quiz.id}`} className="flex-1">
                        <Button className="w-full">
                          <Play className="h-4 w-4 mr-2" />
                          Start
                        </Button>
                      </Link>
                    )}

                    {/* Delete icon to the right of main button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteClick(quiz)}
                      className="text-red-600 hover:text-red-700 flex-shrink-0"
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedQuiz?.title}"?
              <br />
              <br />
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Quiz'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}