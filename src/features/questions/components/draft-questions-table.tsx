// src/features/questions/components/draft-questions-table.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/shared/services/client'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select"
import { Checkbox } from "@/shared/components/ui/checkbox"
import { Eye, Search, Filter, Check, X, CheckSquare, FileQuestion, Send } from 'lucide-react'
import { QuestionPreviewDialog } from './question-preview-dialog'
import { SubmitForReviewButton } from './submit-for-review-button'
import { toast } from 'sonner'
import { SetData } from '@/features/questions/types/question-sets'

interface DraftQuestion {
  id: string
  title: string
  stem: string
  difficulty: "easy" | "medium" | "hard"
  status: "draft" | "pending_review" | "approved" | "flagged" | "archived"
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string
  question_set_id: string | null
  category_id: string | null
  teaching_point: string
  question_references: string | null
  version: string
  version_major: number
  version_minor: number
  version_patch: number
  version_string: string
  // Joined data
  creator?: {
    first_name: string
    last_name: string
    email: string
  }
  question_set?: SetData
}

export function DraftQuestionsTable() {
  const [questions, setQuestions] = useState<DraftQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('all')
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
  const [selectedQuestion, setSelectedQuestion] = useState<DraftQuestion | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchDraftQuestions()
  }, [])

  const fetchDraftQuestions = async () => {
    try {
      setLoading(true)

      // First, get the basic question data
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select(`
          id,
          title,
          stem,
          difficulty,
          status,
          created_at,
          updated_at,
          created_by,
          updated_by,
          question_set_id,
          category_id,
          teaching_point,
          question_references,
          version,
          version_major,
          version_minor,
          version_patch,
          version_string
        `)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })

      if (questionsError) {
        console.error('Error fetching draft questions:', questionsError)
        toast.error(`Failed to load draft questions: ${questionsError.message || 'Unknown error'}`)
        return
      }

      if (!questionsData || questionsData.length === 0) {
        setQuestions([])
        console.log('No draft questions found')
        return
      }

      // Get user data for creators
      const creatorIds = [...new Set(questionsData.map(q => q.created_by))]
      const { data: usersData } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .in('id', creatorIds)

      // Get question set data
      const questionSetIds = questionsData
        .map(q => q.question_set_id)
        .filter(id => id !== null)

      let questionSetsData: any[] = []
      if (questionSetIds.length > 0) {
        const { data } = await supabase
          .from('sets')
          .select('*')
          .in('id', questionSetIds)
        questionSetsData = data || []
      }

      // Transform and combine the data
      const transformedQuestions: DraftQuestion[] = questionsData.map((question) => {
        const creator = usersData?.find(user => user.id === question.created_by)
        const questionSet = questionSetsData.find(qs => qs.id === question.question_set_id)

        return {
          id: question.id,
          title: question.title,
          stem: question.stem,
          difficulty: question.difficulty,
          status: question.status,
          created_at: question.created_at,
          updated_at: question.updated_at,
          created_by: question.created_by,
          updated_by: question.updated_by,
          question_set_id: question.question_set_id,
          category_id: question.category_id,
          teaching_point: question.teaching_point,
          question_references: question.question_references,
          version: question.version,
          version_major: question.version_major,
          version_minor: question.version_minor,
          version_patch: question.version_patch,
          version_string: question.version_string,
          creator: creator ? {
            first_name: creator.first_name,
            last_name: creator.last_name,
            email: creator.email
          } : undefined,
          question_set: questionSet || undefined
        }
      })

      setQuestions(transformedQuestions)

    } catch (error) {
      console.error('Unexpected error fetching draft questions:', error)
      toast.error('An unexpected error occurred while loading draft questions')
    } finally {
      setLoading(false)
    }
  }

  const filteredQuestions = questions.filter(question => {
    const matchesSearch = 
      question.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      question.creator?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      question.creator?.last_name?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesDifficulty = difficultyFilter === 'all' || question.difficulty === difficultyFilter

    return matchesSearch && matchesDifficulty
  })

  const handleSelectQuestion = (questionId: string, checked: boolean) => {
    if (checked) {
      setSelectedQuestions(prev => [...prev, questionId])
    } else {
      setSelectedQuestions(prev => prev.filter(id => id !== questionId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedQuestions(filteredQuestions.map(q => q.id))
    } else {
      setSelectedQuestions([])
    }
  }

  const handlePreviewQuestion = (question: DraftQuestion) => {
    setSelectedQuestion(question)
    setPreviewOpen(true)
  }

  const updateQuestionStatus = async (questionIds: string[], newStatus: 'published' | 'rejected' | 'under_review') => {
    try {
      const { error } = await supabase
        .from('questions')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .in('id', questionIds)

      if (error) {
        console.error('Error updating question status:', error)
        toast.error(`Failed to update question status: ${error.message || 'Unknown error'}`)
        return
      }

      const action = newStatus === 'published' ? 'approved' :
                    newStatus === 'rejected' ? 'rejected' : 'submitted for review'
      toast.success(`${questionIds.length} question(s) ${action} successfully`)

      // Refresh the data and clear selections
      fetchDraftQuestions()
      setSelectedQuestions([])
    } catch (error) {
      console.error('Unexpected error updating question status:', error)
      toast.error('An unexpected error occurred while updating question status')
    }
  }

  const handleApproveSelected = () => {
    if (selectedQuestions.length === 0) return
    updateQuestionStatus(selectedQuestions, 'published')
  }

  const handleRejectSelected = () => {
    if (selectedQuestions.length === 0) return
    updateQuestionStatus(selectedQuestions, 'rejected')
  }

  const handleSubmitForReviewSelected = () => {
    if (selectedQuestions.length === 0) return
    updateQuestionStatus(selectedQuestions, 'under_review')
  }

  const getDifficultyBadge = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return <Badge variant="outline" className="text-green-600 border-green-600">Easy</Badge>
      case 'medium':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Medium</Badge>
      case 'hard':
        return <Badge variant="outline" className="text-red-600 border-red-600">Hard</Badge>
      default:
        return <Badge variant="outline">{difficulty}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="h-10 w-64 bg-muted rounded animate-pulse" />
          <div className="h-10 w-32 bg-muted rounded animate-pulse" />
        </div>
        <div className="border rounded-lg">
          <div className="h-12 bg-muted rounded-t-lg animate-pulse" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 border-t bg-muted/50 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-4">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search questions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
            <SelectTrigger className="w-32">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk Actions */}
        {selectedQuestions.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSubmitForReviewSelected}
              className="text-blue-600 border-blue-600 hover:bg-blue-50"
            >
              <Send className="h-4 w-4 mr-2" />
              Submit for Review ({selectedQuestions.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleApproveSelected}
              className="text-green-600 border-green-600 hover:bg-green-50"
            >
              <Check className="h-4 w-4 mr-2" />
              Approve ({selectedQuestions.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRejectSelected}
              className="text-red-600 border-red-600 hover:bg-red-50"
            >
              <X className="h-4 w-4 mr-2" />
              Reject ({selectedQuestions.length})
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedQuestions.length === filteredQuestions.length && filteredQuestions.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Creator</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead>Question Set</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[150px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredQuestions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <FileQuestion className="h-12 w-12 text-muted-foreground/50" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        {questions.length === 0 ? 'No draft questions available' : 'No questions match your search'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {questions.length === 0
                          ? 'Draft questions will appear here when they are submitted for review.'
                          : 'Try adjusting your search terms or filters.'
                        }
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredQuestions.map((question) => (
                <TableRow key={question.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedQuestions.includes(question.id)}
                      onCheckedChange={(checked) => handleSelectQuestion(question.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell className="font-medium max-w-[300px] truncate">
                    {question.title}
                  </TableCell>
                  <TableCell>
                    {question.creator ? 
                      `${question.creator.first_name} ${question.creator.last_name}` : 
                      'Unknown'
                    }
                  </TableCell>
                  <TableCell>{getDifficultyBadge(question.difficulty)}</TableCell>
                  <TableCell>
                    {question.question_set ? (
                      <Badge variant="secondary">
                        {question.question_set.name}
                      </Badge>
                    ) : (
                      '-'
                    )}
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
                      <SubmitForReviewButton
                        questionId={question.id}
                        questionTitle={question.title}
                        onSubmitComplete={fetchDraftQuestions}
                        variant="ghost"
                        size="sm"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Preview Dialog */}
      <QuestionPreviewDialog
        question={selectedQuestion}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  )
}
