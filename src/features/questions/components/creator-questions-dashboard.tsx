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
import { Checkbox } from "@/shared/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"
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
import { toast } from 'sonner'
import { STATUS_CONFIG, QuestionWithDetails } from '@/features/questions/types/questions'

interface CreatorQuestion extends QuestionWithDetails {
  question_set_name?: string
  latest_feedback?: string
  rejected_at?: string
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
  const [activeTab, setActiveTab] = useState('all')
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false)

  const { user } = useAuthStatus()
  const supabase = createClient()

  const fetchMyQuestions = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      
      // Use the creator dashboard view
      const { data, error } = await supabase
        .from('v_creator_questions')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching questions:', error)
        toast.error('Failed to load questions')
        return
      }

      setQuestions(data || [])
    } catch (error) {
      console.error('Error fetching questions:', error)
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
      // Fetch complete question data with options and images for preview
      const { data: fullQuestion, error } = await supabase
        .from('questions')
        .select(`
          *,
          question_options(*),
          question_images(*, image:images(*)),
          categories(*)
        `)
        .eq('id', question.id)
        .single()

      if (error) {
        console.error('Error fetching full question data:', error)
        toast.error('Failed to load question details')
        return
      }

      // Merge the full data with the existing question data
      const questionWithDetails: CreatorQuestion = {
        ...question,
        ...fullQuestion,
        question_options: fullQuestion.question_options || [],
        question_images: fullQuestion.question_images || [],
        categories: fullQuestion.categories ? [fullQuestion.categories] : []
      }

      setSelectedQuestion(questionWithDetails)
      setPreviewOpen(true)
    } catch (error) {
      console.error('Error fetching question details:', error)
      toast.error('Failed to load question details')
    }
  }

  const handleEdit = async (question: CreatorQuestion) => {
    try {
      // Fetch complete question data with options and images for editing
      const { data: fullQuestion, error } = await supabase
        .from('questions')
        .select(`
          *,
          question_options(*),
          question_images(*, image:images(*)),
          categories(*),
          tags:question_tags(tag:tags(*))
        `)
        .eq('id', question.id)
        .single()

      if (error) {
        console.error('Error fetching full question data:', error)
        toast.error('Failed to load question details')
        return
      }

      // Merge the full data with the existing question data
      const questionWithDetails: CreatorQuestion = {
        ...question,
        ...fullQuestion,
        question_options: fullQuestion.question_options || [],
        question_images: fullQuestion.question_images || [],
        categories: fullQuestion.categories ? [fullQuestion.categories] : [],
        tags: fullQuestion.tags?.map((t: any) => t.tag).filter(Boolean) || []
      }

      setSelectedQuestion(questionWithDetails)
      setEditOpen(true)
    } catch (error) {
      console.error('Error fetching question details:', error)
      toast.error('Failed to load question details')
    }
  }

  const handleSubmitForReview = async (questionId: string) => {
    try {
      const response = await fetch(`/api/questions/${questionId}/submit-for-review`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to submit for review')
      }

      toast.success('Question submitted for review')
      fetchMyQuestions()
    } catch (error) {
      console.error('Error submitting for review:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to submit for review')
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const submittableQuestions = filteredQuestions
        .filter(q => q.status === 'draft' || q.status === 'rejected')
        .map(q => q.id)
      setSelectedQuestions(new Set(submittableQuestions))
    } else {
      setSelectedQuestions(new Set())
    }
  }

  const handleBatchSubmitForReview = async () => {
    if (selectedQuestions.size === 0) return

    setIsSubmittingBatch(true)
    try {
      const promises = Array.from(selectedQuestions).map(questionId =>
        fetch(`/api/questions/${questionId}/submit-for-review`, {
          method: 'POST',
        })
      )

      const results = await Promise.allSettled(promises)
      const failed = results.filter(r => r.status === 'rejected').length
      const succeeded = results.filter(r => r.status === 'fulfilled').length

      if (failed > 0) {
        toast.error(`${failed} questions failed to submit, ${succeeded} succeeded`)
      } else {
        toast.success(`${succeeded} questions submitted for review`)
      }

      setSelectedQuestions(new Set())
      fetchMyQuestions()
    } catch (error) {
      console.error('Error submitting batch for review:', error)
      toast.error('Failed to submit questions for review')
    } finally {
      setIsSubmittingBatch(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <Edit className="h-4 w-4 text-gray-500" />
      case 'under_review':
        return <Clock className="h-4 w-4 text-blue-500" />
      case 'published':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <FileQuestion className="h-4 w-4 text-gray-500" />
    }
  }

  const getTabCounts = () => {
    const drafts = questions.filter(q => q.status === 'draft').length
    const underReview = questions.filter(q => q.status === 'under_review').length
    const published = questions.filter(q => q.status === 'published').length
    const rejected = questions.filter(q => q.status === 'rejected').length
    
    return { drafts, underReview, published, rejected, total: questions.length }
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

  const submittableQuestions = filteredQuestions.filter(q => q.status === 'draft' || q.status === 'rejected')
  const selectedSubmittableCount = Array.from(selectedQuestions).filter(id =>
    submittableQuestions.some(q => q.id === id)
  ).length

  return (
    <div className="space-y-4">
      {/* Header with search and refresh button */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
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
        {selectedQuestions.size > 0 && (
          <Button
            onClick={handleBatchSubmitForReview}
            disabled={isSubmittingBatch}
          >
            {isSubmittingBatch ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Submit {selectedQuestions.size} for Review
          </Button>
        )}
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              Total questions created
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
              Questions in draft
            </p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer hover:bg-muted/50 transition-colors ${
            activeTab === 'under_review' ? 'ring-2 ring-primary bg-primary/5' : ''
          }`}
          onClick={() => setActiveTab('under_review')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Under Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.underReview}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting review
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
              Need revision
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
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedSubmittableCount > 0 && selectedSubmittableCount === submittableQuestions.length}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all draft questions"
                />
              </TableHead>
              <TableHead>Question</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredQuestions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {searchTerm ? 'No questions found matching your search' : 'No questions found'}
                </TableCell>
              </TableRow>
            ) : (
              filteredQuestions.map((question) => (
                <TableRow key={question.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedQuestions.has(question.id)}
                      onCheckedChange={(checked) => handleSelectQuestion(question.id, checked as boolean)}
                      disabled={question.status !== 'draft' && question.status !== 'rejected'}
                      aria-label={`Select ${question.title}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{question.title}</div>
                      <div className="text-sm text-muted-foreground line-clamp-2">
                        {question.stem}
                      </div>
                      {question.status === 'rejected' && question.latest_feedback && (
                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded mt-2">
                          <strong>Feedback:</strong> {question.latest_feedback}
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
                            <DropdownMenuItem onClick={() => handleSubmitForReview(question.id)}>
                              <Send className="h-4 w-4 mr-2" />
                              {question.status === 'rejected' ? 'Resubmit for Review' : 'Send for Review'}
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
    </div>
  )
}
