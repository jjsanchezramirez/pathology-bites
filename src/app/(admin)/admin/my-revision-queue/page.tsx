// src/app/(admin)/admin/my-revision-queue/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUserRole } from '@/shared/hooks/use-user-role'
import { useMyRevisionQueue } from '@/features/questions/hooks'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import { Input } from "@/shared/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import {
  Eye,
  Search,
  Edit3,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { QuestionPreviewDialog } from '@/features/questions/components/question-preview-dialog'
import { formatDistanceToNow } from 'date-fns'
import { AccessDenied, AccessDeniedPresets } from '@/shared/components/common/access-denied'

export default function MyRevisionQueuePage() {
  const router = useRouter()
  const { canAccess } = useUserRole()

  // Use SWR hook for data fetching
  const { questions, isLoading, refresh } = useMyRevisionQueue()

  const [filteredQuestions, setFilteredQuestions] = useState(questions)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedQuestion, setSelectedQuestion] = useState<typeof questions[0] | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [collapsedFeedback, setCollapsedFeedback] = useState<Set<string>>(new Set())

  // Update filtered questions when questions or searchTerm changes
  useEffect(() => {
    if (searchTerm) {
      const filtered = questions.filter(q =>
        q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.stem.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredQuestions(filtered)
    } else {
      setFilteredQuestions(questions)
    }
  }, [searchTerm, questions])

  // Refresh data when page becomes visible (e.g., returning from edit page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refresh])

  const handlePreview = (question: typeof questions[0]) => {
    setSelectedQuestion(question)
    setPreviewOpen(true)
  }

  const handleEditAndResubmit = (questionId: string) => {
    router.push(`/admin/questions/${questionId}/edit?returnUrl=/admin/my-revision-queue`)
  }

  const toggleFeedback = (questionId: string) => {
    const newCollapsed = new Set(collapsedFeedback)
    if (newCollapsed.has(questionId)) {
      newCollapsed.delete(questionId)
    } else {
      newCollapsed.add(questionId)
    }
    setCollapsedFeedback(newCollapsed)
  }

  // Get age indicator badge based on time since rejection
  const getAgeIndicator = (updatedAt: string) => {
    const daysOld = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24))
    if (daysOld > 7) {
      return <Badge variant="destructive" className="ml-2">Urgent</Badge>
    } else if (daysOld > 3) {
      return <Badge variant="secondary" className="ml-2">Aging</Badge>
    }
    return null
  }

  // Access control - only creators and admins can access
  if (!canAccess('questions.create')) {
    return <AccessDenied {...AccessDeniedPresets.creatorOnly} />
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Page Header Skeleton */}
        <div>
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>

        {/* Stats Card Skeleton */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-64" />
          </CardContent>
        </Card>

        {/* Search and Refresh Skeleton */}
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-9 w-24" />
        </div>

        {/* Table Skeleton */}
        <div className="rounded-md border bg-card">
          <div className="p-4 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-32" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Revision Queue</h1>
        <p className="text-muted-foreground mt-2">
          Questions that need revision based on reviewer feedback
        </p>
      </div>

      {/* Stats Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Questions Needing Revision</CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">{questions.length}</div>
          <p className="text-xs text-muted-foreground">
            Highest priority - review feedback and make necessary changes
          </p>
        </CardContent>
      </Card>

      {/* Search and Refresh */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search questions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refresh()}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Questions Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Question</TableHead>
              <TableHead>Rejected</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredQuestions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  <div className="text-center py-6">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No results</h3>
                    <p className="text-muted-foreground">
                      {searchTerm ? 'No questions found matching your search' : 'You have no questions needing revision. Great work!'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredQuestions.map((question) => {
                const isCollapsed = collapsedFeedback.has(question.id)

                return (
                  <React.Fragment key={question.id}>
                    <TableRow>
                      <TableCell>
                        <div className="space-y-3">
                          {/* Question Title with Chevron and Age Tag */}
                          <div className="flex items-start gap-2">
                            {question.reviewer_feedback ? (
                              <button
                                onClick={() => toggleFeedback(question.id)}
                                className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-0.5"
                                aria-label={isCollapsed ? "Expand feedback" : "Collapse feedback"}
                              >
                                {isCollapsed ? (
                                  <ChevronRight className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </button>
                            ) : (
                              <div className="w-6 flex-shrink-0" />
                            )}
                            <div className="font-medium flex items-center flex-1">
                              {question.title}
                              {getAgeIndicator(question.updated_at)}
                            </div>
                          </div>

                          {/* Question Stem */}
                          <div className="flex gap-2">
                            <div className="w-6 flex-shrink-0" />
                            <div className="text-sm text-muted-foreground line-clamp-2 flex-1">
                              {question.stem}
                            </div>
                          </div>

                          {/* Resubmission Notes */}
                          {question.resubmission_notes && (
                            <div className="flex gap-2">
                              <div className="w-6 flex-shrink-0" />
                              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-500 dark:border-blue-600 rounded-md flex-1">
                                <div className="flex items-start gap-2">
                                  <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-xs font-medium text-blue-900 dark:text-blue-100 block mb-1">
                                      Previous Changes Made
                                    </span>
                                    <p className="text-xs text-blue-800 dark:text-blue-300">
                                      {question.resubmission_notes}
                                    </p>
                                    {question.resubmission_date && (
                                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                        {formatDistanceToNow(new Date(question.resubmission_date))} ago
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {question.updated_at ? formatDistanceToNow(new Date(question.updated_at), { addSuffix: true }) : 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreview(question)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleEditAndResubmit(question.id)}
                          >
                            <Edit3 className="h-4 w-4 mr-1" />
                            Edit & Resubmit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Reviewer Feedback Row - Expanded by Default */}
                    {question.reviewer_feedback && !isCollapsed && (
                      <TableRow className="bg-muted/50 border-t">
                        <TableCell colSpan={3} className="py-6 pl-6 pr-6">
                          <div className="flex items-start gap-2">
                            <div className="w-6 flex-shrink-0 flex justify-center">
                              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                            </div>
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold mb-2">
                                Reviewer Feedback
                              </h4>
                              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                {question.reviewer_feedback}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Preview Dialog */}
      {selectedQuestion && (
        <QuestionPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          question={selectedQuestion}
        />
      )}
    </div>
  )
}
