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

  const { user } = useAuthStatus()
  const supabase = createClient()

  const fetchWorkflowQuestions = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)

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
      setQuestions(workflowQuestions)

      // Calculate stats
      const newStats = {
        drafts: workflowQuestions.filter(q => q.status === 'draft').length,
        underReview: workflowQuestions.filter(q => q.status === 'pending_review').length,
        needsRevision: workflowQuestions.filter(q => q.status === 'rejected').length
      }
      setStats(newStats)

      // Set default active tab based on priority
      if (newStats.needsRevision > 0) {
        setActiveTab('needs-revision')
      } else if (newStats.drafts > 0) {
        setActiveTab('ready-to-submit')
      } else {
        setActiveTab('under-review')
      }

    } catch (error) {
      console.error('Unexpected error fetching questions:', error)
      toast.error('Failed to load questions')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user, supabase])

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

  const handleSubmitSuccess = () => {
    fetchWorkflowQuestions()
    setSelectedQuestionForSubmit(null)
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
    switch (status) {
      case 'rejected':
        return <Badge className="bg-destructive text-destructive-foreground">Needs Revision</Badge>
      case 'draft':
        return <Badge className="bg-primary text-primary-foreground">Ready to Submit</Badge>
      case 'pending_review':
        return <Badge className="bg-secondary text-secondary-foreground">Under Review</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
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
            <div className="flex gap-2">
              {activeTab === 'ready-to-submit' && (
                <Button size="sm" onClick={() => toast.info('Bulk submit coming soon')}>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Selected for Review
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => toast.info('Bulk edit coming soon')}>
                <Edit3 className="h-4 w-4 mr-2" />
                Bulk Edit
              </Button>
            </div>
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
                          onClick={() => toast.info('Question is under review')}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
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

      {/* Action Summary */}
      {hasActionableItems && (
        <Alert className="border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Action Required:</strong> You have {totalActionable} question{totalActionable !== 1 ? 's' : ''} that need{totalActionable === 1 ? 's' : ''} your attention.
            {stats.needsRevision > 0 && (
              <span className="ml-2 font-medium">
                {stats.needsRevision} question{stats.needsRevision !== 1 ? 's' : ''} need{stats.needsRevision === 1 ? 's' : ''} revision.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Workflow Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="needs-revision" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Needs Revision ({stats.needsRevision})
          </TabsTrigger>
          <TabsTrigger value="ready-to-submit" className="flex items-center gap-2">
            <Edit3 className="h-4 w-4" />
            Ready to Submit ({stats.drafts})
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

        <TabsContent value="ready-to-submit" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Draft Questions Ready to Submit</h3>
              <p className="text-sm text-muted-foreground">
                These questions are complete and ready for review. Submit them when you're satisfied with the content.
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

      {/* No Action Required State */}
      {!hasActionableItems && stats.underReview === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">All caught up!</h3>
              <p className="text-muted-foreground mb-4">
                You don't have any questions that need your attention right now.
              </p>
              <Button asChild>
                <a href="/admin/create-question">Create New Question</a>
              </Button>
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
    </div>
  )
}
