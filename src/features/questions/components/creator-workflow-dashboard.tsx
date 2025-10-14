'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Separator } from '@/shared/components/ui/separator'
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
  MessageSquare
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

  // Group questions by status
  const rejectedQuestions = questions.filter(q => q.status === 'rejected')
  const draftQuestions = questions.filter(q => q.status === 'draft')
  const underReviewQuestions = questions.filter(q => q.status === 'pending_review')

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-muted rounded w-2/3"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-24 bg-muted rounded"></div>
            </div>
          ))}
        </div>
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
        <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800 dark:text-orange-200">
            <strong>Action Required:</strong> You have {totalActionable} question{totalActionable !== 1 ? 's' : ''} that need{totalActionable === 1 ? 's' : ''} your attention.
            {stats.needsRevision > 0 && (
              <span className="ml-2 font-medium">
                {stats.needsRevision} question{stats.needsRevision !== 1 ? 's' : ''} need{stats.needsRevision === 1 ? 's' : ''} revision.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Workflow Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={stats.needsRevision > 0 ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Needs Revision
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.needsRevision}</div>
            <p className="text-xs text-muted-foreground">
              Highest priority
            </p>
          </CardContent>
        </Card>

        <Card className={stats.drafts > 0 ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-blue-600" />
              Ready to Submit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.drafts}</div>
            <p className="text-xs text-muted-foreground">
              Complete and submit
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              Under Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.underReview}</div>
            <p className="text-xs text-muted-foreground">
              Waiting for reviewer
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Section 1: Rejected Questions - HIGHEST PRIORITY */}
      {rejectedQuestions.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-5 w-5" />
              Questions Needing Revision ({rejectedQuestions.length})
            </CardTitle>
            <CardDescription className="text-red-600 dark:text-red-400">
              These questions were rejected and need your immediate attention. Review the feedback and make necessary changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {rejectedQuestions.map((question) => (
              <div key={question.id} className="bg-white dark:bg-gray-900 rounded-lg border border-red-200 dark:border-red-800 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {question.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                      {question.stem}
                    </p>
                    {question.question_set && (
                      <Badge variant="outline" className="text-xs mb-2">
                        {question.question_set.name}
                      </Badge>
                    )}
                    {question.reviewer_feedback && (
                      <div className="bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded p-3 mt-2">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                              Reviewer Feedback:
                            </p>
                            <p className="text-sm text-red-700 dark:text-red-300">
                              {question.reviewer_feedback}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Rejected {formatDistanceToNow(new Date(question.rejected_at || question.updated_at))} ago
                    </p>
                  </div>
                  <Button
                    onClick={() => handleEditAndResubmit(question.id)}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit & Resubmit
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Section 2: Draft Questions - Ready to Submit */}
      {draftQuestions.length > 0 && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <Edit3 className="h-5 w-5" />
              Draft Questions Ready to Submit ({draftQuestions.length})
            </CardTitle>
            <CardDescription className="text-blue-600 dark:text-blue-400">
              These questions are complete and ready for review. Submit them when you're satisfied with the content.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {draftQuestions.map((question) => (
              <div key={question.id} className="bg-white dark:bg-gray-900 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {question.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                      {question.stem}
                    </p>
                    {question.question_set && (
                      <Badge variant="outline" className="text-xs mb-2">
                        {question.question_set.name}
                      </Badge>
                    )}
                    <p className="text-xs text-gray-500">
                      Created {formatDistanceToNow(new Date(question.created_at))} ago
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/admin/questions/${question.id}/edit`, '_blank')}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleSubmitForReview(question.id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Submit for Review
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Section 3: Under Review - Informational */}
      {underReviewQuestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <Clock className="h-5 w-5" />
              Questions Under Review ({underReviewQuestions.length})
            </CardTitle>
            <CardDescription>
              These questions are currently being reviewed. No action needed from you at this time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {underReviewQuestions.map((question) => (
              <div key={question.id} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/50 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                    {question.title}
                  </h4>
                  {question.question_set && (
                    <Badge variant="outline" className="text-xs">
                      {question.question_set.name}
                    </Badge>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Submitted {formatDistanceToNow(new Date(question.updated_at))} ago
                  </p>
                </div>
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  Under Review
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
