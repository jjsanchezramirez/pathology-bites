// src/app/(admin)/admin/my-questions/page.tsx
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
import { Card } from "@/shared/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"
import {
  Eye,
  Search,
  Loader2,
  RefreshCw,
  FileQuestion,
  CheckCheck,
  Clock,
  XCircle,
  Layers
} from 'lucide-react'
import { QuestionPreviewDialog } from '@/features/questions/components/question-preview-dialog'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { QuestionWithDetails, STATUS_CONFIG } from '@/features/questions/types/questions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select"

interface MyQuestion extends QuestionWithDetails {
  creator_name?: string
}

export default function MyQuestionsPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<MyQuestion[]>([])
  const [filteredQuestions, setFilteredQuestions] = useState<MyQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<string>('all')
  const [selectedQuestion, setSelectedQuestion] = useState<MyQuestion | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const { user } = useAuthStatus()
  const { role, canAccess } = useUserRole()
  const supabase = createClient()

  const isCreator = role === 'creator' || role === 'admin'
  const isReviewer = role === 'reviewer' || role === 'admin'

  // Access control
  if (!canAccess('questions.view')) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Access denied.</p>
        </div>
      </div>
    )
  }

  const fetchMyQuestions = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)

      let query = supabase
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
          published_at,
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

      // Filter based on role
      if (isCreator) {
        // Creators see only their own questions
        query = query.eq('created_by', user.id)
      } else if (isReviewer) {
        // Reviewers see questions they've reviewed or are assigned to review
        query = query.or(`reviewer_id.eq.${user.id},created_by.eq.${user.id}`)
      }

      query = query.order('updated_at', { ascending: false })

      const { data, error } = await query

      if (error) {
        console.error('Error fetching questions:', error)
        toast.error(`Failed to load questions: ${error.message}`)
        return
      }

      setQuestions(data || [])
      setFilteredQuestions(data || [])
    } catch (error) {
      console.error('Unexpected error fetching questions:', error)
      toast.error('Failed to load questions')
    } finally {
      setLoading(false)
    }
  }, [user, supabase, isCreator, isReviewer])

  useEffect(() => {
    fetchMyQuestions()
  }, [fetchMyQuestions])

  useEffect(() => {
    let filtered = questions

    // Apply tab filter
    if (activeTab !== 'all') {
      if (activeTab === 'published') {
        filtered = filtered.filter(q => q.status === 'published')
      } else if (activeTab === 'under-review') {
        filtered = filtered.filter(q => q.status === 'pending_review')
      } else if (activeTab === 'rejected') {
        filtered = filtered.filter(q => q.status === 'rejected')
      }
    }

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
  }, [searchTerm, difficultyFilter, activeTab, questions])

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
          updated_by_user:users!questions_updated_by_fkey(first_name, last_name),
          reviewer_user:users!questions_reviewer_id_fkey(first_name, last_name)
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

  // Calculate stats
  const allCount = questions.length
  const publishedCount = questions.filter(q => q.status === 'published').length
  const underReviewCount = questions.filter(q => q.status === 'pending_review').length
  const rejectedCount = questions.filter(q => q.status === 'rejected').length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground mt-2">Loading questions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Questions</h1>
        <p className="text-muted-foreground mt-2">
          {isCreator ? 'View and track all your questions' : 'Questions you have reviewed or are assigned to review'}
        </p>
      </div>

      {/* Filters */}
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
          onClick={fetchMyQuestions}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {isCreator ? (
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              All ({allCount})
            </TabsTrigger>
            <TabsTrigger value="published" className="flex items-center gap-2">
              <CheckCheck className="h-4 w-4" />
              Published ({publishedCount})
            </TabsTrigger>
            <TabsTrigger value="under-review" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Under Review ({underReviewCount})
            </TabsTrigger>
          </TabsList>
        ) : (
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              All ({allCount})
            </TabsTrigger>
            <TabsTrigger value="published" className="flex items-center gap-2">
              <CheckCheck className="h-4 w-4" />
              Published ({publishedCount})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Rejected ({rejectedCount})
            </TabsTrigger>
          </TabsList>
        )}

        <TabsContent value={activeTab} className="space-y-4">
          <Card>
            <div className="rounded-md border bg-card">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Status</TableHead>
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
                          <FileQuestion className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                          <h3 className="text-lg font-medium mb-2">No questions found</h3>
                          <p className="text-muted-foreground">
                            {searchTerm || difficultyFilter !== 'all'
                              ? 'No questions match your filters'
                              : 'You don\'t have any questions yet'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredQuestions.map((question) => (
                      <TableRow key={question.id}>
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
                          {getStatusBadge(question.status)}
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreview(question.id)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

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
