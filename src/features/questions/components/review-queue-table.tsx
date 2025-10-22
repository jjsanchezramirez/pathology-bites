'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { toast } from 'sonner'
import { createClient } from '@/shared/services/client'
import { 
  QuestionWithReviewDetails, 
  STATUS_CONFIG 
} from '@/features/questions/types/questions'
import { QuestionReviewDialog } from './question-review-dialog'
import { QuestionFlagDialog } from './question-flag-dialog'
import { QuestionPreviewDialog } from './question-preview-dialog'
import { 
  Eye, 
  Search, 
  Filter, 
  Clock, 
  User, 
  Flag,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react'

export function ReviewQueueTable() {
  const [questions, setQuestions] = useState<QuestionWithReviewDetails[]>([])
  const [filteredQuestions, setFilteredQuestions] = useState<QuestionWithReviewDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionWithReviewDetails | null>(null)
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [flagDialogOpen, setFlagDialogOpen] = useState(false)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [questionToPreview, setQuestionToPreview] = useState<QuestionWithReviewDetails | null>(null)

  const supabase = createClient()

  const fetchQuestions = async () => {
    try {
      setLoading(true)
      
      // Fetch questions that need review - SELECT only needed fields
      const { data, error } = await supabase
        .from('questions')
        .select(`
          id,
          title,
          stem,
          difficulty,
          status,
          question_set_id,
          created_by,
          reviewer_id,
          created_at,
          updated_at,
          created_by_user:users!questions_created_by_fkey(first_name, last_name),
          question_set:question_sets(name),
          question_options(id, text, is_correct, order_index),
          question_images(question_section, order_index, image:images(id, url))
        `)
        .in('status', ['pending_review', 'flagged'])
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching questions:', error)
        toast.error('Failed to load questions')
        return
      }

      // Transform the data to match our interface
      const transformedQuestions: QuestionWithReviewDetails[] = data.map(q => {
        return {
          ...q,
          created_by_name: q.created_by_user ?
            `${q.created_by_user.first_name} ${q.created_by_user.last_name}`.trim() :
            'Unknown',
          reviewer_name: undefined, // Will be fetched separately if needed
          flagger_name: undefined, // Will be fetched separately if needed
          reviews: [], // Will be fetched separately if needed
          flags: [] // Will be fetched separately if needed
        };
      })

      setQuestions(transformedQuestions)
    } catch (error) {
      console.error('Error fetching questions:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuestions()
  }, [])

  useEffect(() => {
    let filtered = questions

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(q => 
        q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.stem.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.created_by_name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(q => q.status === statusFilter)
    }

    setFilteredQuestions(filtered)
  }, [questions, searchTerm, statusFilter])

  const handleReviewQuestion = (question: QuestionWithReviewDetails) => {
    setSelectedQuestion(question)
    setReviewDialogOpen(true)
  }

  const handleFlagQuestion = (question: QuestionWithReviewDetails) => {
    setSelectedQuestion(question)
    setFlagDialogOpen(true)
  }

  const handlePreviewQuestion = async (question: QuestionWithReviewDetails) => {
    try {
      // Fetch complete question data with options and images for preview - SELECT only needed fields
      const { data: fullQuestion, error } = await supabase
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
          created_at,
          question_options(id, text, is_correct, explanation, order_index),
          question_images(question_section, order_index, image:images(id, url, alt_text, description)),
          categories(id, name, description)
        `)
        .eq('id', question.id)
        .single()

      if (error) {
        console.error('Error fetching full question data:', error)
        toast.error('Failed to load question details')
        return
      }

      setQuestionToPreview(fullQuestion)
      setPreviewDialogOpen(true)
    } catch (error) {
      console.error('Error fetching question for preview:', error)
      toast.error('Failed to load question preview')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <Clock className="h-4 w-4" />
      case 'under_review':
        return <Eye className="h-4 w-4" />
      case 'flagged':
        return <AlertTriangle className="h-4 w-4" />
      default:
        return null
    }
  }

  const getPriorityLevel = (question: QuestionWithReviewDetails) => {
    if (question.status === 'flagged') return 'high'
    if (question.status === 'pending_review') return 'medium'
    return 'low'
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading questions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search questions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending Review</SelectItem>
            <SelectItem value="flagged">Flagged</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Question</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Creator</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredQuestions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="text-muted-foreground">
                    {questions.length === 0 ? 'No questions need review' : 'No questions match your filters'}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredQuestions.map((question) => {
                const statusConfig = STATUS_CONFIG[question.status as keyof typeof STATUS_CONFIG]
                const priority = getPriorityLevel(question)
                
                return (
                  <TableRow key={question.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{question.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {question.stem.substring(0, 80)}...
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusConfig?.color}>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(question.status)}
                          {statusConfig?.label}
                        </div>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPriorityColor(priority)}>
                        {priority.charAt(0).toUpperCase() + priority.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {question.created_by_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(question.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreviewQuestion(question)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReviewQuestion(question)}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        {question.status === 'approved' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFlagQuestion(question)}
                          >
                            <Flag className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Review Dialog */}
      <QuestionReviewDialog
        question={selectedQuestion}
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        onReviewComplete={fetchQuestions}
      />

      {/* Preview Dialog */}
      <QuestionPreviewDialog
        question={questionToPreview}
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
      />

      {/* Flag Dialog */}
      <QuestionFlagDialog
        question={selectedQuestion}
        open={flagDialogOpen}
        onOpenChange={setFlagDialogOpen}
        onFlagComplete={fetchQuestions}
      />
    </div>
  )
}
