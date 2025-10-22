'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table'
import { toast } from 'sonner'
import { createClient } from '@/shared/services/client'
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status'
import { useUserRole } from '@/shared/hooks/use-user-role'
import { SubmitForReviewDialog } from './submit-for-review-dialog'
import { QuestionPreviewDialog } from './question-preview-dialog'
import { BulkSubmitDialog } from './bulk-submit-dialog'
import { STATUS_CONFIG, QuestionWithDetails } from '@/features/questions/types/questions'
import {
  AlertTriangle,
  Clock,
  Edit3,
  Send,
  CheckCircle2,
  RefreshCw,
  FileText,
  MessageSquare,
  Eye,
  ChevronDown,
  ChevronRight,
  CheckCheck
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface WorkflowQuestion {
  id: string
  title: string
  stem: string
  status: string
  created_at: string
  updated_at: string
  reviewer_feedback?: string
  rejected_at?: string
  question_set?: { name: string }
  resubmission_notes?: string | null
  resubmission_date?: string | null
}

interface WorkflowStats {
  drafts: number
  underReview: number
  needsRevision: number
  flagged: number
  published: number
  needsReview?: number
  underRevision?: number
}

export function CreatorWorkflowDashboard() {
  const router = useRouter()
  const supabase = createClient()
  const { user } = useAuthStatus()
  const { role } = useUserRole()

  const [questions, setQuestions] = useState<WorkflowQuestion[]>([])
  const [stats, setStats] = useState<WorkflowStats>({
    drafts: 0,
    underReview: 0,
    needsRevision: 0,
    flagged: 0,
    published: 0,
    needsReview: 0,
    underRevision: 0
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [selectedQuestionForSubmit, setSelectedQuestionForSubmit] = useState<WorkflowQuestion | null>(null)
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<string>('needs-revision')
  const [expandedFeedback, setExpandedFeedback] = useState<Set<string>>(new Set())
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [selectedQuestionForPreview, setSelectedQuestionForPreview] = useState<QuestionWithDetails | null>(null)
  const [bulkSubmitDialogOpen, setBulkSubmitDialogOpen] = useState(false)
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false)

  const isReviewer = role === 'reviewer'
  const isCreator = role === 'creator' || role === 'admin'

  const fetchWorkflowQuestions = useCallback(async (isRefresh = false) => {
    if (!user) return

    try {
      // Only show loading skeleton on initial load, not on refreshes
      if (!hasInitiallyLoaded && !isRefresh) {
        setLoading(true)
      }

      const supabase = createClient()
      let workflowQuestions: WorkflowQuestion[] = []

      if (isReviewer) {
        // Reviewers see: Needs Review (pending_review) → Under Revision (rejected) → Published
        const { data, error } = await supabase
          .from('questions')
          .select(`
            id,
            title,
            stem,
            status,
            created_at,
            updated_at,
            reviewer_feedback,
            question_sets(name),
            question_flags(id, flag_type, description, status, created_at)
          `)
          .in('status', ['pending_review', 'rejected', 'published'])
          .order('updated_at', { ascending: false })

        if (error) {
          console.error('Error fetching reviewer workflow questions:', error)
          toast.error('Failed to load questions')
          return
        }

        workflowQuestions = data || []
      } else {
        // Creators see: Needs Revision (rejected) → Drafts (draft) → Under Review (pending_review) → Published
        const { data, error } = await supabase
          .from('questions')
          .select(`
            id,
            title,
            stem,
            status,
            created_at,
            updated_at,
            reviewer_feedback,
            question_sets(name),
            question_flags(id, flag_type, description, status, created_at)
          `)
          .eq('created_by', user.id)
          .in('status', ['draft', 'pending_review', 'rejected', 'published'])
          .order('updated_at', { ascending: false })

        if (error) {
          console.error('Error fetching creator workflow questions:', error)
          toast.error('Failed to load questions')
          return
        }

        workflowQuestions = data || []
      }

      // Fetch resubmission notes for rejected questions
      const rejectedQuestionIds = workflowQuestions
        .filter(q => q.status === 'rejected')
        .map(q => q.id)

      let questionsWithResubmissionNotes = workflowQuestions

      if (rejectedQuestionIds.length > 0) {
        try {
          const { data: resubmissionData, error: resubmissionError } = await supabase
            .from('question_reviews')
            .select('question_id, changes_made, created_at')
            .in('question_id', rejectedQuestionIds)
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

            questionsWithResubmissionNotes = workflowQuestions.map(question => {
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

      // Calculate stats based on role
      const flaggedCount = workflowQuestions.filter(q =>
        q.question_flags && q.question_flags.some((f: any) => f.status === 'open')
      ).length

      const newStats = {
        drafts: workflowQuestions.filter(q => q.status === 'draft').length,
        underReview: workflowQuestions.filter(q => q.status === 'pending_review').length,
        needsRevision: workflowQuestions.filter(q => q.status === 'rejected').length,
        flagged: flaggedCount,
        published: workflowQuestions.filter(q => q.status === 'published').length,
        needsReview: workflowQuestions.filter(q => q.status === 'pending_review').length,
        underRevision: workflowQuestions.filter(q => q.status === 'rejected').length
      }
      setStats(newStats)

      // Set default active tab based on role and priority
      if (isReviewer) {
        if (newStats.needsReview > 0) {
          setActiveTab('needs-review')
        } else if (newStats.underRevision > 0) {
          setActiveTab('under-revision')
        } else {
          setActiveTab('published')
        }
      } else {
        if (newStats.needsRevision > 0) {
          setActiveTab('needs-revision')
        } else if (newStats.drafts > 0) {
          setActiveTab('drafts')
        } else if (newStats.underReview > 0) {
          setActiveTab('under-review')
        } else {
          setActiveTab('published')
        }
      }

    } catch (error) {
      console.error('Unexpected error fetching questions:', error)
      toast.error('Failed to load questions')
    } finally {
      setLoading(false)
      setRefreshing(false)
      setHasInitiallyLoaded(true)
    }
  }, [user, hasInitiallyLoaded, isReviewer])

  useEffect(() => {
    fetchWorkflowQuestions()
  }, [fetchWorkflowQuestions])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchWorkflowQuestions(true)
  }

  const handleSubmitForReview = (questionId: string) => {
    const question = questions.find(q => q.id === questionId)
    if (question) {
      setSelectedQuestionForSubmit(question)
      setSubmitDialogOpen(true)
    }
  }

  const handleEditAndResubmit = (questionId: string) => {
    // Navigate to edit page
    router.push(`/admin/questions/${questionId}/edit`)
  }

  const handleSubmitSuccess = async (reviewerId?: string) => {
    // Refresh the questions list and close dialog
    fetchWorkflowQuestions(true)
    setSelectedQuestionForSubmit(null)
  }



  const handlePreview = async (questionId: string) => {
    try {
      const supabase = createClient()

      // Fetch complete question data with options and images for preview
      const { data: fullQuestion, error } = await supabase
        .from('questions')
        .select(`
          *,
          question_options(*),
          question_images(*, image:images(*)),
          categories(*),
          question_sets(
            id,
            name,
            source_type,
            short_form
          ),
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
        .eq('id', questionId)
        .single()

      if (error) {
        console.error('Error fetching full question data:', error)
        toast.error('Failed to load question details')
        return
      }

      setSelectedQuestionForPreview(fullQuestion)
      setPreviewDialogOpen(true)
    } catch (error) {
      console.error('Error fetching question for preview:', error)
      toast.error('Failed to load question preview')
    }
  }

  const handleSelectQuestion = (questionId: string, checked: boolean) => {
    const newSelected = new Set(selectedQuestions)
    if (checked) {
      newSelected.add(questionId)
    } else {
      newSelected.delete(questionId)
    }
    setSelectedQuestions(newSelected)
  }

  const handleSelectAll = (questions: WorkflowQuestion[], checked: boolean) => {
    const newSelected = new Set(selectedQuestions)
    questions.forEach(q => {
      if (checked) {
        newSelected.add(q.id)
      } else {
        newSelected.delete(q.id)
      }
    })
    setSelectedQuestions(newSelected)
  }

  const handleBulkSubmitForReview = async () => {
    const selectedInTab = questions.filter(q => selectedQuestions.has(q.id) && q.status === 'draft')

    if (selectedInTab.length === 0) {
      toast.error('No draft questions selected')
      return
    }

    if (selectedInTab.length === 1) {
      // If only one question selected, use the regular submit dialog
      handleSubmitForReview(selectedInTab[0].id)
      return
    }

    // For multiple questions, show the bulk submit dialog
    setBulkSubmitDialogOpen(true)
  }

  const handleBulkSubmitConfirm = async (reviewerId: string) => {
    const selectedInTab = questions.filter(q => selectedQuestions.has(q.id) && q.status === 'draft')

    try {
      // Submit all selected questions in parallel
      const submissions = selectedInTab.map(question =>
        fetch(`/api/questions/${question.id}/submit-for-review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewer_id: reviewerId }),
        })
      )

      const results = await Promise.allSettled(submissions)

      // Check for any failures
      const failures = results.filter(result => result.status === 'rejected')
      if (failures.length > 0) {
        toast.error(`Failed to submit ${failures.length} question(s). Please try again.`)
      } else {
        toast.success(`Successfully submitted ${selectedInTab.length} questions for review`)
      }

      // Clear all selections after bulk submission
      setSelectedQuestions(new Set())

      // Refresh the questions list
      fetchWorkflowQuestions(true)
    } catch (error) {
      console.error('Error in bulk submission:', error)
      toast.error('Some questions failed to submit. Please try again.')
    }
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

  const getStatusBadge = (status: string) => {
    const statusConfig = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
    return (
      <Badge
        variant="outline"
        className={`${statusConfig?.color || 'border-gray-300 bg-gray-50 text-gray-700'} text-xs`}
      >
        {statusConfig?.label || status}
      </Badge>
    )
  }

  // Group questions by status
  const rejectedQuestions = questions.filter(q => q.status === 'rejected')
  const draftQuestions = questions.filter(q => q.status === 'draft')
  const underReviewQuestions = questions.filter(q => q.status === 'pending_review')
  const publishedQuestions = questions.filter(q => q.status === 'published')

  // For reviewers
  const needsReviewQuestions = questions.filter(q => q.status === 'pending_review')
  const underRevisionQuestions = questions.filter(q => q.status === 'rejected')

  const renderQuestionTable = (questions: WorkflowQuestion[], showSelection = true, tabType?: string) => {
    if (questions.length === 0) {
      // Empty state messages based on tab
      const emptyStateConfig = {
        'needs-revision': {
          icon: CheckCircle2,
          title: 'All caught up! 🎉',
          description: 'You have no questions needing revision. Great work!',
          iconColor: 'text-green-500'
        },
        'drafts': {
          icon: FileText,
          title: 'No drafts yet',
          description: 'Create a new question to get started.',
          iconColor: 'text-muted-foreground'
        },
        'under-review': {
          icon: Clock,
          title: 'No questions under review',
          description: 'Submit your draft questions for review.',
          iconColor: 'text-muted-foreground'
        },
        'published': {
          icon: CheckCheck,
          title: 'No published questions yet',
          description: 'Your published questions will appear here.',
          iconColor: 'text-muted-foreground'
        },
        'needs-review': {
          icon: Clock,
          title: 'No questions to review',
          description: 'All pending questions have been reviewed.',
          iconColor: 'text-green-500'
        },
        'under-revision': {
          icon: AlertTriangle,
          title: 'No questions under revision',
          description: 'All rejected questions have been addressed.',
          iconColor: 'text-muted-foreground'
        }
      }

      const config = emptyStateConfig[tabType as keyof typeof emptyStateConfig] || emptyStateConfig['drafts']
      const Icon = config.icon

      return (
        <div className="text-center py-12">
          <Icon className={`h-12 w-12 mx-auto mb-4 ${config.iconColor}`} />
          <h3 className="text-lg font-medium mb-2">{config.title}</h3>
          <p className="text-muted-foreground">{config.description}</p>
        </div>
      )
    }

    const selectedInTab = questions.filter(q => selectedQuestions.has(q.id))
    const allSelected = selectedInTab.length === questions.length && questions.length > 0

    return (
      <div className="space-y-4">
        {/* Bulk Actions */}
        {showSelection && selectedInTab.length > 0 && (
          <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
            <span className="text-sm font-medium">
              {selectedInTab.length} question{selectedInTab.length !== 1 ? 's' : ''} selected
            </span>
            {activeTab === 'drafts' && (
              <Button size="sm" onClick={handleBulkSubmitForReview}>
                <Send className="h-4 w-4 mr-2" />
                Submit Selected for Review
              </Button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                {showSelection && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => handleSelectAll(questions, !!checked)}
                    />
                  </TableHead>
                )}
                <TableHead>Question</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map((question) => {
                const isExpanded = expandedFeedback.has(question.id)
                const columnCount = showSelection ? 5 : 4 // Adjust based on whether selection column is shown

                return (
                  <React.Fragment key={question.id}>
                    <TableRow>
                  {showSelection && (
                    <TableCell>
                      <Checkbox
                        checked={selectedQuestions.has(question.id)}
                        onCheckedChange={(checked) => handleSelectQuestion(question.id, !!checked)}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {question.status === 'rejected' && question.reviewer_feedback && (
                          <span
                            className="h-2 w-2 bg-amber-500 rounded-full flex-shrink-0"
                            title="Needs attention"
                          />
                        )}
                        <div className="font-medium">{question.title}</div>
                      </div>
                      <div className="text-sm text-muted-foreground line-clamp-2">
                        {question.stem}
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        {question.question_set && (
                          <Badge variant="outline" className="text-xs">
                            {question.question_set.name}
                          </Badge>
                        )}
                        {/* Reviewer Feedback Indicator Badge */}
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
                            {expandedFeedback.has(question.id) ? (
                              <ChevronDown className="h-3 w-3 ml-1 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-3 w-3 ml-1 flex-shrink-0" />
                            )}
                          </Badge>
                        )}
                      </div>
                      {question.resubmission_notes && (
                        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md">
                          <div className="flex items-center gap-1 mb-1">
                            <MessageSquare className="h-3 w-3 text-blue-600" />
                            <span className="text-xs font-medium text-blue-900 dark:text-blue-100">
                              Changes Made
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
                      {question.question_flags && question.question_flags.filter((f: any) => f.status === 'open').length > 0 && (
                        <div className="mt-2 p-2 bg-destructive/10 border border-destructive/30 rounded-md">
                          <div className="flex items-center gap-1 mb-1">
                            <AlertTriangle className="h-3 w-3 text-destructive" />
                            <span className="text-xs font-medium text-destructive">
                              {question.question_flags.filter((f: any) => f.status === 'open').length} Flag{question.question_flags.filter((f: any) => f.status === 'open').length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {question.question_flags.filter((f: any) => f.status === 'open').slice(0, 2).map((flag: any, idx: number) => (
                            <p key={idx} className="text-xs text-destructive/80 line-clamp-1">
                              • {flag.flag_type.replace(/_/g, ' ')}: {flag.description || 'No description'}
                            </p>
                          ))}
                          {question.question_flags.filter((f: any) => f.status === 'open').length > 2 && (
                            <p className="text-xs text-destructive/60 mt-1">
                              +{question.question_flags.filter((f: any) => f.status === 'open').length - 2} more
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(question.status)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {/* Preview button for all statuses */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePreview(question.id)}
                        title="Preview question"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      {question.status === 'rejected' && (
                        <Button
                          size="sm"
                          onClick={() => handleEditAndResubmit(question.id)}
                        >
                          <Edit3 className="h-4 w-4 mr-1" />
                          Edit & Resubmit
                        </Button>
                      )}
                      {question.status === 'draft' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditAndResubmit(question.id)}
                          >
                            <Edit3 className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSubmitForReview(question.id)}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Submit
                          </Button>
                        </>
                      )}
                      {question.status === 'pending_review' && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          title="Question is under review"
                        >
                          <Clock className="h-4 w-4 mr-1" />
                          Under Review
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(question.updated_at))} ago
                  </TableCell>
                </TableRow>

                {/* Expandable Feedback Row */}
                {question.reviewer_feedback && isExpanded && (
                  <TableRow key={`${question.id}-feedback`} className="bg-amber-50/50 dark:bg-amber-950/20 border-l-4 border-amber-500 dark:border-amber-600">
                    <TableCell colSpan={columnCount} className="p-0">
                      <div className="p-4 space-y-3">
                        {/* Header */}
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

                        {/* Feedback Content */}
                        <div className="pl-6">
                          <p className={`text-sm text-amber-900 dark:text-amber-200 leading-relaxed ${
                            question.reviewer_feedback.length > 300 && !expandedFeedback.has(`${question.id}-full`)
                              ? 'line-clamp-6'
                              : ''
                          }`}>
                            {question.reviewer_feedback}
                          </p>
                          {question.reviewer_feedback.length > 300 && (
                            <button
                              onClick={() => {
                                const newExpanded = new Set(expandedFeedback)
                                if (newExpanded.has(`${question.id}-full`)) {
                                  newExpanded.delete(`${question.id}-full`)
                                } else {
                                  newExpanded.add(`${question.id}-full`)
                                }
                                setExpandedFeedback(newExpanded)
                              }}
                              className="text-xs text-amber-700 dark:text-amber-400 hover:underline mt-2"
                            >
                              {expandedFeedback.has(`${question.id}-full`) ? 'Show less' : 'Show more'}
                            </button>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-muted rounded w-2/3"></div>
        </div>
        <div className="h-64 bg-muted rounded"></div>
      </div>
    )
  }

  const hasActionableItems = stats.drafts > 0 || stats.needsRevision > 0
  const totalActionable = stats.drafts + stats.needsRevision

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Workflow</h1>
          <p className="text-muted-foreground">
            Manage questions that need your attention
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Flagged Questions Alert */}
      {stats.flagged > 0 && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <h3 className="font-semibold text-destructive">
                {stats.flagged} Question{stats.flagged !== 1 ? 's' : ''} Flagged by Users
              </h3>
              <p className="text-sm text-destructive/80">
                These questions have been removed from circulation and need your attention. Review the flags and make necessary changes before resubmitting.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Stats Cards */}
      {isReviewer ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-white dark:bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground">
                <Clock className="h-4 w-4" />
                Needs Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.needsReview}</div>
              <p className="text-xs text-muted-foreground">
                Pending your review
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground">
                <AlertTriangle className="h-4 w-4" />
                Under Revision
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.underRevision}</div>
              <p className="text-xs text-muted-foreground">
                Being revised by creators
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground">
                <CheckCheck className="h-4 w-4" />
                Published
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.published}</div>
              <p className="text-xs text-muted-foreground">
                Approved by you
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white dark:bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Needs Revision
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.needsRevision}</div>
              <p className="text-xs text-muted-foreground">
                Highest priority
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground">
                <Edit3 className="h-4 w-4" />
                Drafts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.drafts}</div>
              <p className="text-xs text-muted-foreground">
                Ready to submit
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground">
                <Clock className="h-4 w-4" />
                Under Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.underReview}</div>
              <p className="text-xs text-muted-foreground">
                Waiting for reviewer
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground">
                <CheckCheck className="h-4 w-4" />
                Published
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.published}</div>
              <p className="text-xs text-muted-foreground">
                Live on platform
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Workflow Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {isReviewer ? (
          <>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="needs-review" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Needs Review ({stats.needsReview})
              </TabsTrigger>
              <TabsTrigger value="under-revision" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Under Revision ({stats.underRevision})
              </TabsTrigger>
              <TabsTrigger value="published" className="flex items-center gap-2">
                <CheckCheck className="h-4 w-4" />
                Published ({stats.published})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="needs-review" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Questions Needing Review</h3>
                  <p className="text-sm text-muted-foreground">
                    These questions are pending your review. Approve or request changes.
                  </p>
                </div>
              </div>
              {renderQuestionTable(needsReviewQuestions, false, 'needs-review')}
            </TabsContent>

            <TabsContent value="under-revision" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Questions Under Revision</h3>
                  <p className="text-sm text-muted-foreground">
                    These questions were rejected and are being revised by creators.
                  </p>
                </div>
              </div>
              {renderQuestionTable(underRevisionQuestions, false, 'under-revision')}
            </TabsContent>

            <TabsContent value="published" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Published Questions</h3>
                  <p className="text-sm text-muted-foreground">
                    Questions you have approved and published.
                  </p>
                </div>
              </div>
              {renderQuestionTable(publishedQuestions, false, 'published')}
            </TabsContent>
          </>
        ) : (
          <>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="needs-revision" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Needs Revision ({stats.needsRevision})
              </TabsTrigger>
              <TabsTrigger value="drafts" className="flex items-center gap-2">
                <Edit3 className="h-4 w-4" />
                Drafts ({stats.drafts})
              </TabsTrigger>
              <TabsTrigger value="under-review" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Under Review ({stats.underReview})
              </TabsTrigger>
              <TabsTrigger value="published" className="flex items-center gap-2">
                <CheckCheck className="h-4 w-4" />
                Published ({stats.published})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="needs-revision" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Questions Needing Revision</h3>
                  <p className="text-sm text-muted-foreground">
                    These questions were rejected and need your immediate attention. Review the feedback and make necessary changes.
                  </p>
                </div>
              </div>
              {renderQuestionTable(rejectedQuestions, true, 'needs-revision')}
            </TabsContent>

            <TabsContent value="drafts" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Draft Questions</h3>
                  <p className="text-sm text-muted-foreground">
                    These questions are in draft status. Edit and submit them for review when ready.
                  </p>
                </div>
              </div>
              {renderQuestionTable(draftQuestions, true, 'drafts')}
            </TabsContent>

            <TabsContent value="under-review" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Questions Under Review</h3>
                  <p className="text-sm text-muted-foreground">
                    These questions are currently being reviewed. No action needed from you at this time.
                  </p>
                </div>
              </div>
              {renderQuestionTable(underReviewQuestions, false, 'under-review')}
            </TabsContent>

            <TabsContent value="published" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Published Questions</h3>
                  <p className="text-sm text-muted-foreground">
                    Your published questions. You can make patch edits to these questions.
                  </p>
                </div>
              </div>
              {renderQuestionTable(publishedQuestions, false, 'published')}
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* All Jobs Done State - Show when all tabs are empty */}
      {isReviewer ? (
        stats.needsReview === 0 && stats.underRevision === 0 && (
          <Card className="bg-white dark:bg-card">
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-6" />
                <h3 className="text-xl font-semibold mb-3 text-foreground">All caught up! 🎉</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  You don't have any questions that need your attention right now.
                  Check the Published tab to see your approved questions.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" asChild>
                    <a href="/admin/questions">Browse All Questions</a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      ) : (
        stats.needsRevision === 0 && stats.drafts === 0 && stats.underReview === 0 && (
          <Card className="bg-white dark:bg-card">
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-6" />
                <h3 className="text-xl font-semibold mb-3 text-foreground">Excellent work! All jobs done! 🎉</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  You don't have any questions that need your attention right now.
                  Time to create some new content or take a well-deserved break!
                </p>
                <div className="flex gap-3 justify-center">
                  <Button asChild>
                    <a href="/admin/create-question">Create New Question</a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="/admin/questions">Browse All Questions</a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      )}

      {/* Submit for Review Dialog */}
      {selectedQuestionForSubmit && (
        <SubmitForReviewDialog
          open={submitDialogOpen}
          onOpenChange={setSubmitDialogOpen}
          questionId={selectedQuestionForSubmit.id}
          questionTitle={selectedQuestionForSubmit.title}
          questionStatus={selectedQuestionForSubmit.status}
          onSuccess={handleSubmitSuccess}
        />
      )}

      {/* Bulk Submit Dialog */}
      <BulkSubmitDialog
        open={bulkSubmitDialogOpen}
        onOpenChange={setBulkSubmitDialogOpen}
        questionCount={questions.filter(q => selectedQuestions.has(q.id) && q.status === 'draft').length}
        onConfirm={handleBulkSubmitConfirm}
      />

      {/* Preview Dialog */}
      <QuestionPreviewDialog
        question={selectedQuestionForPreview}
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
      />

    </div>
  )
}
