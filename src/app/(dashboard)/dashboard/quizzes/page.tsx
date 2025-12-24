// src/app/(dashboard)/dashboard/quizzes/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useCachedData } from "@/shared/hooks/use-cached-data"
import { Button } from "@/shared/components/ui/button"
import { Plus } from "lucide-react"
import { toast } from '@/shared/utils/toast'
import Link from "next/link"
import { FeaturePlaceholder } from "@/features/dashboard/components"
import { isQuizFeaturesEnabled } from "@/shared/config/feature-flags"
import { apiClient } from "@/shared/utils/api-client"
import {
  QuizStatsCards,
  QuizFilters,
  QuizCard,
  QuizEmptyState,
  QuizDeleteDialog,
  QuizzesLoading,
  type QuizSessionListItem
} from "@/features/quiz/components"

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
      refetchOnMount: true, // Always fetch on mount if no valid cache
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

  if (isLoading) {
    return <QuizzesLoading />
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
        <QuizStatsCards stats={stats} formatTimeSpent={formatTimeSpent} />
      )}

      {/* Search and Filters */}
      <QuizFilters
        searchTerm={searchTerm}
        selectedFilters={selectedFilters}
        sortBy={sortBy}
        onSearchChange={setSearchTerm}
        onFiltersChange={setSelectedFilters}
        onSortChange={setSortBy}
      />

      {/* Quiz List */}
      <div className="space-y-4">
        {sortedQuizzes.length === 0 ? (
          <QuizEmptyState hasFilters={searchTerm !== '' || selectedFilters.length > 0} />
        ) : (
          sortedQuizzes.map((quiz) => (
            <QuizCard
              key={quiz.id}
              quiz={quiz}
              onDelete={handleDeleteClick}
              formatDate={formatDate}
            />
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <QuizDeleteDialog
        open={showDeleteDialog}
        quiz={selectedQuiz}
        isDeleting={isDeleting}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}