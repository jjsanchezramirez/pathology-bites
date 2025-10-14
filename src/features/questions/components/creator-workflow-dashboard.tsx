'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { SubmitForReviewDialog } from './submit-for-review-dialog'
import { QuestionPreviewDialog } from './question-preview-dialog'
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
  ChevronRight
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
}

export function CreatorWorkflowDashboard() {
  const [questions, setQuestions] = useState<WorkflowQuestion[]>([])
  const [stats, setStats] = useState<WorkflowStats>({ drafts: 0, underReview: 0, needsRevision: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [selectedQuestionForSubmit, setSelectedQuestionForSubmit] = useState<WorkflowQuestion | null>(null)
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<string>('needs-revision')
  const [expandedFeedback, setExpandedFeedback] = useState<Set<string>>(new Set())
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [selectedQuestionForPreview, setSelectedQuestionForPreview] = useState<QuestionWithDetails | null>(null)

  const { user } = useAuthStatus()

  const fetchWorkflowQuestions = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)

      const supabase = createClient()

      // Fetch only actionable questions (draft, pending_review, rejected)
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
          rejected_at,
          question_sets(name)
        `)
        .eq('created_by', user.id)
        .in('status', ['draft', 'pending_review', 'rejected'])
        .order('rejected_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching workflow questions:', error)
        toast.error('Failed to load questions')
        return
      }

      const workflowQuestions = data || []

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
            // Create a map of question_id to latest resubmission notes
            const resubmissionMap = new Map()
            resubmissionData.forEach(review => {
              if (!resubmissionMap.has(review.question_id) && review.changes_made?.resubmission_notes) {
                resubmissionMap.set(review.question_id, {
                  notes: review.changes_made.resubmission_notes,
                  date: review.created_at
                })
              }
            })

            // Add resubmission notes to questions
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
          // Continue without resubmission notes if there's an error
        }
      }

      setQuestions(questionsWithResubmissionNotes)

      // Calculate stats
      const newStats = {
        drafts: workflowQuestions.filter(q => q.status === 'draft').length,
        underReview: workflowQuestions.filter(q => q.status === 'pending_review').length,
        needsRevision: workflowQuestions.filter(q => q.status === 'rejected').length
      }
      setStats(newStats)

      // Set default active tab based on priority: Needs Revision → Drafts → Under Review
      if (newStats.needsRevision > 0) {
        setActiveTab('needs-revision')
      } else if (newStats.drafts > 0) {
        setActiveTab('drafts')
      } else if (newStats.underReview > 0) {
        setActiveTab('under-review')
      } else {
        // All tabs are empty, default to needs-revision
        setActiveTab('needs-revision')
      }

    } catch (error) {
      console.error('Unexpected error fetching questions:', error)
      toast.error('Failed to load questions')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user])

  useEffect(() => {
    fetchWorkflowQuestions()
  }, [fetchWorkflowQuestions])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchWorkflowQuestions()
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
    window.open(`/admin/create-question?edit=${questionId}`, '_blank')
  }

  const handleSubmitSuccess = async (reviewerId?: string) => {
    // Check if this was a bulk submission (multiple questions selected)
    const selectedInTab = questions.filter(q => selectedQuestions.has(q.id) && q.status === 'draft')

    if (selectedInTab.length > 1 && reviewerId) {
      // This is a bulk submission - submit all remaining selected questions to the same reviewer
      const remainingQuestions = selectedInTab.filter(q => q.id !== selectedQuestionForSubmit?.id)

      if (remainingQuestions.length > 0) {
        try {
          // Submit all remaining questions in parallel
          const submissions = remainingQuestions.map(question =>
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
        } catch (error) {
          console.error('Error in bulk submission:', error)
          toast.error('Some questions failed to submit. Please try again.')
        }
      }

      // Clear all selections after bulk submission
      setSelectedQuestions(new Set())
    }

    // Refresh the questions list and close dialog
    fetchWorkflowQuestions()
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

    // For multiple questions, show confirmation and then submit all to the same reviewer
    const confirmed = confirm(
      `Submit ${selectedInTab.length} questions for review?\n\n` +
      `All selected questions will be submitted to the same reviewer. ` +
      `You'll choose the reviewer in the next step.`
    )

    if (!confirmed) return

    // Use the first question to open the submit dialog, but modify the success handler
    // to submit all selected questions to the same reviewer
    const firstQuestion = selectedInTab[0]
    setSelectedQuestionForSubmit(firstQuestion)
    setSubmitDialogOpen(true)
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

  const renderQuestionTable = (questions: WorkflowQuestion[], showSelection = true) => {
    if (questions.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No questions in this category</p>
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
                <TableHead>Feedback</TableHead>
                <TableHead>Actions</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map((question) => (
                <TableRow key={question.id}>
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
                      <div className="font-medium">{question.title}</div>
                      <div className="text-sm text-muted-foreground line-clamp-2">
                        {question.stem}
                      </div>
                      {question.question_set && (
                        <Badge variant="outline" className="text-xs">
                          {question.question_set.name}
                        </Badge>
                      )}
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
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(question.status)}
                  </TableCell>
                  <TableCell>
                    {question.reviewer_feedback ? (
                      <div className="space-y-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleFeedbackExpansion(question.id)}
                          className="h-auto p-1 text-xs"
                        >
                          {expandedFeedback.has(question.id) ? (
                            <ChevronDown className="h-3 w-3 mr-1" />
                          ) : (
                            <ChevronRight className="h-3 w-3 mr-1" />
                          )}
                          View Feedback
                        </Button>
                        {expandedFeedback.has(question.id) && (
                          <div className="text-sm p-2 bg-destructive/10 border border-destructive/20 rounded">
                            {question.reviewer_feedback}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
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
                          className="bg-destructive hover:bg-destructive/90"
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
              ))}
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



      {/* Workflow Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      </div>

      {/* Workflow Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
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
          {renderQuestionTable(rejectedQuestions)}
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
          {renderQuestionTable(draftQuestions)}
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
          {renderQuestionTable(underReviewQuestions, false)}
        </TabsContent>
      </Tabs>

      {/* All Jobs Done State - Show when all tabs are empty */}
      {stats.needsRevision === 0 && stats.drafts === 0 && stats.underReview === 0 && (
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

      {/* Preview Dialog */}
      <QuestionPreviewDialog
        question={selectedQuestionForPreview}
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
      />
    </div>
  )
}
