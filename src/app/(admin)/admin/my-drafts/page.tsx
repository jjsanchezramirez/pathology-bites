// src/app/(admin)/admin/my-drafts/page.tsx
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
import { Checkbox } from "@/shared/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import {
  Eye,
  Search,
  Edit3,
  Send,
  Loader2,
  RefreshCw,
  FileText
} from 'lucide-react'
import { QuestionPreviewDialog } from '@/features/questions/components/question-preview-dialog'
import { SubmitForReviewDialog } from '@/features/questions/components/submit-for-review-dialog'
import { BulkSubmitDialog } from '@/features/questions/components/bulk-submit-dialog'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { QuestionWithDetails } from '@/features/questions/types/questions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select"

interface DraftQuestion extends QuestionWithDetails {
  creator_name?: string
}

export default function MyDraftsPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<DraftQuestion[]>([])
  const [filteredQuestions, setFilteredQuestions] = useState<DraftQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all')
  const [selectedQuestion, setSelectedQuestion] = useState<DraftQuestion | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [bulkSubmitDialogOpen, setBulkSubmitDialogOpen] = useState(false)
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())

  const { user } = useAuthStatus()
  const { canAccess } = useUserRole()
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

  const fetchDraftQuestions = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)

      // Fetch draft questions created by current user
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
          )
        `)
        .eq('created_by', user.id)
        .eq('status', 'draft')
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error fetching draft questions:', error)
        toast.error(`Failed to load drafts: ${error.message}`)
        return
      }

      setQuestions(data || [])
      setFilteredQuestions(data || [])
    } catch (error) {
      console.error('Unexpected error fetching draft questions:', error)
      toast.error('Failed to load drafts')
    } finally {
      setLoading(false)
    }
  }, [user, supabase])

  useEffect(() => {
    fetchDraftQuestions()
  }, [fetchDraftQuestions])

  useEffect(() => {
    let filtered = questions

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(q =>
        q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.stem.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply difficulty filter
    if (difficultyFilter !== 'all') {
      filtered = filtered.filter(q => q.difficulty?.toLowerCase() === difficultyFilter)
    }

    setFilteredQuestions(filtered)
  }, [searchTerm, difficultyFilter, questions])

  const handlePreview = async (questionId: string) => {
    try {
      const supabase = createClient()
      const { data: fullQuestion, error } = await supabase
        .from('questions')
        .select(`
          *,
          question_options(*),
          question_images(*, image:images(*)),
          categories(*),
          question_sets(id, name, source_type, short_form),
          created_by_user:users!questions_created_by_fkey(first_name, last_name),
          updated_by_user:users!questions_updated_by_fkey(first_name, last_name)
        `)
        .eq('id', questionId)
        .single()

      if (error) {
        console.error('Error fetching question:', error)
        toast.error('Failed to load question preview')
        return
      }

      setSelectedQuestion(fullQuestion)
      setPreviewOpen(true)
    } catch (error) {
      console.error('Error fetching question for preview:', error)
      toast.error('Failed to load question preview')
    }
  }

  const handleEdit = (questionId: string) => {
    router.push(`/admin/questions/${questionId}/edit`)
  }

  const handleSubmitForReview = (questionId: string) => {
    const question = questions.find(q => q.id === questionId)
    if (question) {
      setSelectedQuestion(question)
      setSubmitDialogOpen(true)
    }
  }

  const handleSubmitSuccess = async () => {
    await fetchDraftQuestions()
    setSelectedQuestion(null)
    setSubmitDialogOpen(false)
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
      setSelectedQuestions(new Set(filteredQuestions.map(q => q.id)))
    } else {
      setSelectedQuestions(new Set())
    }
  }

  const handleBulkSubmitForReview = () => {
    if (selectedQuestions.size === 0) {
      toast.error('No questions selected')
      return
    }

    if (selectedQuestions.size === 1) {
      const questionId = Array.from(selectedQuestions)[0]
      handleSubmitForReview(questionId)
      return
    }

    setBulkSubmitDialogOpen(true)
  }

  const handleBulkSubmitConfirm = async (reviewerId: string) => {
    const selectedIds = Array.from(selectedQuestions)

    try {
      const submissions = selectedIds.map(questionId =>
        fetch(`/api/questions/${questionId}/submit-for-review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewer_id: reviewerId }),
        })
      )

      const results = await Promise.allSettled(submissions)
      const failures = results.filter(result => result.status === 'rejected')

      if (failures.length > 0) {
        toast.error(`Failed to submit ${failures.length} question(s)`)
      } else {
        toast.success(`Successfully submitted ${selectedIds.length} questions for review`)
      }

      setSelectedQuestions(new Set())
      await fetchDraftQuestions()
    } catch (error) {
      console.error('Error in bulk submission:', error)
      toast.error('Failed to submit questions')
    }
  }

  const allSelected = filteredQuestions.length > 0 && selectedQuestions.size === filteredQuestions.length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground mt-2">Loading drafts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Drafts</h1>
        <p className="text-muted-foreground mt-2">
          Draft questions ready to be reviewed and submitted
        </p>
      </div>

      {/* Stats Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Draft Questions</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{questions.length}</div>
          <p className="text-xs text-muted-foreground">
            Ready to submit for review
          </p>
        </CardContent>
      </Card>

      {/* Filters and Actions */}
      <div className="flex items-center justify-between gap-4">
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
          <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Difficulties</SelectItem>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchDraftQuestions}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Bulk Actions Bar */}
      {selectedQuestions.size > 0 && (
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectedQuestions.size} question{selectedQuestions.size !== 1 ? 's' : ''} selected
          </span>
          <Button size="sm" onClick={handleBulkSubmitForReview}>
            <Send className="h-4 w-4 mr-2" />
            Submit Selected for Review
          </Button>
        </div>
      )}

      {/* Questions Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Question</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredQuestions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <div className="text-center py-6">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">No drafts yet</h3>
                    <p className="text-muted-foreground">
                      {searchTerm || difficultyFilter !== 'all'
                        ? 'No questions match your filters'
                        : 'Create a new question to get started'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredQuestions.map((question) => (
                <TableRow key={question.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedQuestions.has(question.id)}
                      onCheckedChange={(checked) => handleSelectQuestion(question.id, !!checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <div className="font-medium">{question.title}</div>
                      <div className="text-sm text-muted-foreground line-clamp-2">
                        {question.stem}
                      </div>
                      {question.question_sets && (
                        <Badge variant="outline" className="text-xs">
                          {question.question_sets.name}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(question.updated_at), { addSuffix: true })}
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
                        onClick={() => handlePreview(question.id)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(question.id)}
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
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      {selectedQuestion && (
        <>
          <QuestionPreviewDialog
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            question={selectedQuestion}
          />
          <SubmitForReviewDialog
            open={submitDialogOpen}
            onOpenChange={setSubmitDialogOpen}
            questionId={selectedQuestion.id}
            questionTitle={selectedQuestion.title}
            questionStatus={selectedQuestion.status}
            onSuccess={handleSubmitSuccess}
          />
        </>
      )}

      <BulkSubmitDialog
        open={bulkSubmitDialogOpen}
        onOpenChange={setBulkSubmitDialogOpen}
        questionCount={selectedQuestions.size}
        onConfirm={handleBulkSubmitConfirm}
      />
    </div>
  )
}
