'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/shared/services/client'
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import {
  Eye,
  Search,
  Clock,
  FileQuestion,
  Edit,
  Send,
  CheckCircle,
  XCircle,
  MoreVertical,
  RefreshCw,
  Loader2
} from 'lucide-react'
import { QuestionPreviewDialog } from './question-preview-dialog'
import { EditQuestionDialog } from './edit-question-dialog'
import { SubmitForReviewDialog } from './submit-for-review-dialog'
import { ReassignReviewerDialog } from './reassign-reviewer-dialog'
import { QUESTION_STATUSES, getQuestionStatusLabel } from '@/shared/constants/database-types'
import { toast } from 'sonner'
import { STATUS_CONFIG, QuestionWithDetails } from '@/features/questions/types/questions'

interface CreatorQuestion extends QuestionWithDetails {
  question_set_name?: string
  reviewer_id?: string | null
  reviewer_feedback?: string | null
  rejected_at?: string | null
  rejected_by?: string | null
  published_at?: string | null
  review_count: number
}

export function CreatorQuestionsDashboard() {
  const [questions, setQuestions] = useState<CreatorQuestion[]>([])
  const [filteredQuestions, setFilteredQuestions] = useState<CreatorQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedQuestion, setSelectedQuestion] = useState<CreatorQuestion | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [submitForReviewOpen, setSubmitForReviewOpen] = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('all')

  const { user } = useAuthStatus()
  const supabase = createClient()

  const fetchMyQuestions = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)

      // Query questions table directly with related data
      const { data, error } = await supabase
        .from('questions')
        .select(`
          *,
          question_sets(id, name),
          question_options(id, text, is_correct, explanation, order_index),
          question_images(
            question_section,
            order_index,
            images(id, url, alt_text, description)
          )
        `)
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Supabase error fetching questions:', error)
        toast.error(`Failed to load questions: ${error.message}`)
        return
      }

      setQuestions(data || [])
    } catch (error) {
      console.error('Unexpected error fetching questions:', error)
      toast.error('Failed to load questions')
    } finally {
      setLoading(false)
    }
  }, [user, supabase])

  useEffect(() => {
    fetchMyQuestions()
  }, [fetchMyQuestions])

  useEffect(() => {
    let filtered = questions

    // Apply tab filter
    if (activeTab !== 'all') {
      filtered = filtered.filter(q => q.status === activeTab)
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(q => 
        q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.stem.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredQuestions(filtered)
  }, [questions, activeTab, searchTerm])

  const handlePreview = async (question: CreatorQuestion) => {
    try {
      // Use the same API endpoint as other pages for consistency
      const response = await fetch(`/api/admin/questions/${question.id}`)

      if (!response.ok) {
        console.error('Failed to fetch question details')
        toast.error('Failed to load question details')
        return
      }

      const { question: fullQuestion } = await response.json()

      setSelectedQuestion(fullQuestion)
      setPreviewOpen(true)
    } catch (error) {
      console.error('Error fetching question details:', error)
      toast.error('Failed to load question details')
    }
  }

  const handleEdit = async (question: CreatorQuestion) => {
    try {
      // Use the same API endpoint as the All Questions page for consistency
      const response = await fetch(`/api/admin/questions/${question.id}`)

      if (!response.ok) {
        console.error('Failed to fetch question details')
        toast.error('Failed to load question details')
        return
      }

      const { question: fullQuestion } = await response.json()

      setSelectedQuestion(fullQuestion)
      setEditOpen(true)
    } catch (error) {
      console.error('Error fetching question details:', error)
      toast.error('Failed to load question details')
    }
  }

  const handleSubmitForReview = (question: CreatorQuestion) => {
    setSelectedQuestion(question)
    setSubmitForReviewOpen(true)
  }

  const handleReassign = (question: CreatorQuestion) => {
    setSelectedQuestion(question)
    setReassignOpen(true)
  }

  const handleSubmitSuccess = () => {
    fetchMyQuestions()
  }

  const handleReassignSuccess = () => {
    fetchMyQuestions()
  }



  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <Edit className="h-4 w-4 text-gray-500" />
      case 'pending_review':
        return <Clock className="h-4 w-4 text-blue-500" />
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'published':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'flagged':
        return <XCircle className="h-4 w-4 text-orange-500" />
      default:
        return <FileQuestion className="h-4 w-4 text-gray-500" />
    }
  }

  const getTabCounts = () => {
    const drafts = questions.filter(q => q.status === 'draft').length
    const pending = questions.filter(q => q.status === 'pending_review').length
    const rejected = questions.filter(q => q.status === 'rejected').length
    const published = questions.filter(q => q.status === 'published').length

    return { drafts, pending, rejected, published, total: questions.length }
  }

  const counts = getTabCounts()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground mt-2">Loading your questions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold">My Questions</h1>
        <p className="text-muted-foreground">
          Manage your questions and track their review status.
        </p>
      </div>

      {/* Header with search and refresh button */}
      <div className="flex items-center gap-4">
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
          onClick={fetchMyQuestions}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card
          className={`cursor-pointer hover:bg-muted/50 transition-colors ${
            activeTab === 'all' ? 'ring-2 ring-primary bg-primary/5' : ''
          }`}
          onClick={() => setActiveTab('all')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">All Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.total}</div>
            <p className="text-xs text-muted-foreground">
              Total questions
            </p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer hover:bg-muted/50 transition-colors ${
            activeTab === 'draft' ? 'ring-2 ring-primary bg-primary/5' : ''
          }`}
          onClick={() => setActiveTab('draft')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Draft</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.drafts}</div>
            <p className="text-xs text-muted-foreground">
              Not submitted
            </p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer hover:bg-muted/50 transition-colors ${
            activeTab === 'pending_review' ? 'ring-2 ring-primary bg-primary/5' : ''
          }`}
          onClick={() => setActiveTab('pending_review')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.pending}</div>
            <p className="text-xs text-muted-foreground">
              In review
            </p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer hover:bg-muted/50 transition-colors ${
            activeTab === 'rejected' ? 'ring-2 ring-primary bg-primary/5' : ''
          }`}
          onClick={() => setActiveTab('rejected')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.rejected}</div>
            <p className="text-xs text-muted-foreground">
              Needs revision
            </p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer hover:bg-muted/50 transition-colors ${
            activeTab === 'published' ? 'ring-2 ring-primary bg-primary/5' : ''
          }`}
          onClick={() => setActiveTab('published')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.published}</div>
            <p className="text-xs text-muted-foreground">
              Live
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search Results Info */}
      {searchTerm && (
        <div className="text-sm text-muted-foreground">
          Showing results for "{searchTerm}" ({filteredQuestions.length} found)
        </div>
      )}



      {/* Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Question</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredQuestions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  {searchTerm ? 'No questions found matching your search' : 'No questions found'}
                </TableCell>
              </TableRow>
            ) : (
              filteredQuestions.map((question) => (
                <TableRow key={question.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{question.title}</div>
                      <div className="text-sm text-muted-foreground line-clamp-2">
                        {question.stem}
                      </div>
                      {question.status === 'rejected' && question.reviewer_feedback && (
                        <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950 p-2 rounded mt-2 border border-red-200 dark:border-red-800">
                          <strong>Reviewer Feedback:</strong> {question.reviewer_feedback}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(question.status)}
                      <Badge
                        variant="secondary"
                        className={STATUS_CONFIG[question.status as keyof typeof STATUS_CONFIG]?.color}
                      >
                        {STATUS_CONFIG[question.status as keyof typeof STATUS_CONFIG]?.label}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {question.difficulty}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(question.created_at).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {/* Preview Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handlePreview(question)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      {/* Action Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(question.status === 'draft' || question.status === 'rejected') && (
                            <DropdownMenuItem onClick={() => handleEdit(question)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {(question.status === 'draft' || question.status === 'rejected') && (
                            <DropdownMenuItem onClick={() => handleSubmitForReview(question)}>
                              <Send className="h-4 w-4 mr-2" />
                              {question.status === 'rejected' ? 'Resubmit for Review' : 'Submit for Review'}
                            </DropdownMenuItem>
                          )}
                          {question.status === 'pending_review' && question.reviewer_id && (
                            <DropdownMenuItem onClick={() => handleReassign(question)}>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Reassign Reviewer
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      <QuestionPreviewDialog
        question={selectedQuestion}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />

      <EditQuestionDialog
        question={selectedQuestion}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={fetchMyQuestions}
      />

      {selectedQuestion && (
        <SubmitForReviewDialog
          open={submitForReviewOpen}
          onOpenChange={setSubmitForReviewOpen}
          questionId={selectedQuestion.id}
          questionTitle={selectedQuestion.title}
          questionStatus={selectedQuestion.status}
          onSuccess={handleSubmitSuccess}
        />
      )}

      {selectedQuestion && selectedQuestion.reviewer_id && (
        <ReassignReviewerDialog
          open={reassignOpen}
          onOpenChange={setReassignOpen}
          questionId={selectedQuestion.id}
          questionTitle={selectedQuestion.title}
          currentReviewerId={selectedQuestion.reviewer_id}
          onSuccess={handleReassignSuccess}
        />
      )}
    </div>
  )
}
