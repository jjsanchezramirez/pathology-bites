// src/app/(admin)/admin/my-revision-queue/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/shared/services/client'
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status'
import { useUserRole } from '@/shared/hooks/use-user-role'
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
  Loader2,
  RefreshCw,
  MessageSquare,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { QuestionPreviewDialog } from '@/features/questions/components/question-preview-dialog'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { QuestionWithDetails } from '@/features/questions/types/questions'

interface RejectedQuestion extends QuestionWithDetails {
  creator_name?: string
  resubmission_notes?: string | null
  resubmission_date?: string | null
}

export default function MyRevisionQueuePage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<RejectedQuestion[]>([])
  const [filteredQuestions, setFilteredQuestions] = useState<RejectedQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedQuestion, setSelectedQuestion] = useState<RejectedQuestion | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [expandedFeedback, setExpandedFeedback] = useState<Set<string>>(new Set())

  const { user } = useAuthStatus()
  const { role, canAccess } = useUserRole()
  const supabase = createClient()

  // Access control - only creators and admins can access
  if (!canAccess('questions.create')) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Access denied. Creator privileges required.</p>
        </div>
      </div>
    )
  }

  const fetchRejectedQuestions = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)

      // Fetch rejected questions created by current user
      const { data, error } = await supabase
        .from('questions')
        .select(`
          id,
          title,
          stem,
          difficulty,
          teaching_point,
          question_references,
          status,
          question_set_id,
          category_id,
          created_by,
          reviewer_id,
          reviewer_feedback,
          rejected_at,
          created_at,
          updated_at,
          question_sets(id, name),
          question_options(id, text, is_correct, explanation, order_index),
          question_images(
            question_section,
            order_index,
            images(id, url, alt_text, description)
          ),
          categories(*),
          created_by_user:users!questions_created_by_fkey(
            first_name,
            last_name
          ),
          updated_by_user:users!questions_updated_by_fkey(
            first_name,
            last_name
          ),
          reviewer_user:users!questions_reviewer_id_fkey(
            first_name,
            last_name
          )
        `)
        .eq('created_by', user.id)
        .eq('status', 'rejected')
        .order('rejected_at', { ascending: false }) // Most recently rejected first

      if (error) {
        console.error('Error fetching rejected questions:', error)
        toast.error(`Failed to load revision queue: ${error.message}`)
        return
      }

      // Fetch resubmission notes
      const questionIds = (data || []).map(q => q.id)
      let questionsWithResubmissionNotes = data || []

      if (questionIds.length > 0) {
        try {
          const { data: resubmissionData, error: resubmissionError } = await supabase
            .from('question_reviews')
            .select('question_id, changes_made, created_at')
            .in('question_id', questionIds)
            .eq('action', 'resubmitted')
            .order('created_at', { ascending: false })

          if (!resubmissionError && resubmissionData) {
            const resubmissionMap = new Map()
            resubmissionData.forEach(review => {
              if (!resubmissionMap.has(review.question_id) && review.changes_made?.resubmission_notes) {
                resubmissionMap.set(review.question_id, {
                  notes: review.changes_made.resubmission_notes,
                  date: review.created_at
                })
              }
            })

            questionsWithResubmissionNotes = (data || []).map(question => {
              const resubmissionInfo = resubmissionMap.get(question.id)
              return {
                ...question,
                resubmission_notes: resubmissionInfo?.notes || null,
                resubmission_date: resubmissionInfo?.date || null
              }
            })
          }
        } catch (error) {
          console.error('Error fetching resubmission notes:', error)
        }
      }

      setQuestions(questionsWithResubmissionNotes)
      setFilteredQuestions(questionsWithResubmissionNotes)
    } catch (error) {
      console.error('Unexpected error fetching rejected questions:', error)
      toast.error('Failed to load revision queue')
    } finally {
      setLoading(false)
    }
  }, [user, supabase])

  useEffect(() => {
    fetchRejectedQuestions()
  }, [fetchRejectedQuestions])

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

  const handlePreview = (question: RejectedQuestion) => {
    setSelectedQuestion(question)
    setPreviewOpen(true)
  }

  const handleEditAndResubmit = (questionId: string) => {
    router.push(`/admin/questions/${questionId}/edit`)
  }

  const toggleFeedbackExpansion = (questionId: string) => {
    const newExpanded = new Set(expandedFeedback)
    if (newExpanded.has(questionId)) {
      newExpanded.delete(questionId)
    } else {
      newExpanded.add(questionId)
    }
    setExpandedFeedback(newExpanded)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground mt-2">Loading revision queue...</p>
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
          onClick={fetchRejectedQuestions}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
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
              <TableHead>Difficulty</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredQuestions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <div className="text-center py-6">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <h3 className="text-lg font-medium mb-2">All caught up! 🎉</h3>
                    <p className="text-muted-foreground">
                      {searchTerm ? 'No questions found matching your search' : 'You have no questions needing revision. Great work!'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredQuestions.map((question) => {
                const isExpanded = expandedFeedback.has(question.id)

                return (
                  <>
                    <TableRow key={question.id}>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 bg-amber-500 rounded-full flex-shrink-0" title="Needs attention" />
                            <div className="font-medium">{question.title}</div>
                          </div>
                          <div className="text-sm text-muted-foreground line-clamp-2">
                            {question.stem}
                          </div>
                          <div className="flex flex-wrap gap-2 items-center">
                            {question.question_sets && (
                              <Badge variant="outline" className="text-xs">
                                {question.question_sets.name}
                              </Badge>
                            )}
                            {/* Reviewer Feedback Badge */}
                            {question.reviewer_feedback && (
                              <Badge
                                variant="outline"
                                className="text-xs bg-amber-100 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-400 cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-950/50 transition-colors max-w-xs"
                                onClick={() => toggleFeedbackExpansion(question.id)}
                              >
                                <MessageSquare className="h-3 w-3 mr-1 flex-shrink-0" />
                                <span className="truncate">
                                  {question.reviewer_feedback.length > 50
                                    ? `${question.reviewer_feedback.substring(0, 50)}...`
                                    : question.reviewer_feedback}
                                </span>
                                {isExpanded ? (
                                  <ChevronDown className="h-3 w-3 ml-1 flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="h-3 w-3 ml-1 flex-shrink-0" />
                                )}
                              </Badge>
                            )}
                          </div>
                          {/* Resubmission Notes */}
                          {question.resubmission_notes && (
                            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md">
                              <div className="flex items-center gap-1 mb-1">
                                <MessageSquare className="h-3 w-3 text-blue-600" />
                                <span className="text-xs font-medium text-blue-900 dark:text-blue-100">
                                  Previous Changes Made
                                </span>
                              </div>
                              <p className="text-xs text-blue-800 dark:text-blue-300 line-clamp-2">
                                {question.resubmission_notes}
                              </p>
                              {question.resubmission_date && (
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                  {formatDistanceToNow(new Date(question.resubmission_date))} ago
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {question.rejected_at ? formatDistanceToNow(new Date(question.rejected_at), { addSuffix: true }) : 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{question.difficulty}</Badge>
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

                    {/* Expandable Feedback Row */}
                    {question.reviewer_feedback && isExpanded && (
                      <TableRow key={`${question.id}-feedback`} className="bg-amber-50/50 dark:bg-amber-950/20 border-l-4 border-amber-500 dark:border-amber-600">
                        <TableCell colSpan={4} className="p-0">
                          <div className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                                <span className="font-medium text-amber-900 dark:text-amber-200">
                                  Reviewer Feedback
                                </span>
                              </div>
                              <button
                                onClick={() => toggleFeedbackExpansion(question.id)}
                                className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 flex items-center gap-1"
                              >
                                <ChevronDown className="h-3 w-3" />
                                Collapse
                              </button>
                            </div>
                            <div className="pl-6">
                              <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
                                {question.reviewer_feedback}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
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
