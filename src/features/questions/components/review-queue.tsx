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
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import {
  Eye,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import { QuestionPreviewDialog } from './question-preview-dialog'
import { ReviewActionDialog } from './review-action-dialog'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { QuestionWithDetails } from '@/features/questions/types/questions'

interface ReviewQuestion extends QuestionWithDetails {
  creator_name?: string
}

export function ReviewQueue() {
  const [questions, setQuestions] = useState<ReviewQuestion[]>([])
  const [filteredQuestions, setFilteredQuestions] = useState<ReviewQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedQuestion, setSelectedQuestion] = useState<ReviewQuestion | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null)

  const { user } = useAuthStatus()
  const supabase = createClient()

  const fetchReviewQueue = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)

      // Fetch questions assigned to current user with pending_review status
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
          ),
          users!questions_created_by_fkey(first_name, last_name, email)
        `)
        .eq('reviewer_id', user.id)
        .eq('status', 'pending_review')
        .order('created_at', { ascending: true }) // Oldest first

      if (error) {
        console.error('Error fetching review queue:', error)
        toast.error(`Failed to load review queue: ${error.message}`)
        return
      }

      // Format creator name
      const formattedData = (data || []).map(q => ({
        ...q,
        creator_name: q.users?.first_name && q.users?.last_name
          ? `${q.users.first_name} ${q.users.last_name}`
          : q.users?.email || 'Unknown'
      }))

      setQuestions(formattedData)
      setFilteredQuestions(formattedData)
    } catch (error) {
      console.error('Unexpected error fetching review queue:', error)
      toast.error('Failed to load review queue')
    } finally {
      setLoading(false)
    }
  }, [user, supabase])

  useEffect(() => {
    fetchReviewQueue()
  }, [fetchReviewQueue])

  useEffect(() => {
    if (searchTerm) {
      const filtered = questions.filter(q =>
        q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.stem.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.creator_name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredQuestions(filtered)
    } else {
      setFilteredQuestions(questions)
    }
  }, [searchTerm, questions])

  const handlePreview = (question: ReviewQuestion) => {
    setSelectedQuestion(question)
    setPreviewOpen(true)
  }

  const handleReviewAction = (question: ReviewQuestion, action: 'approve' | 'reject') => {
    setSelectedQuestion(question)
    setReviewAction(action)
  }

  const handleReviewComplete = () => {
    setReviewAction(null)
    setSelectedQuestion(null)
    fetchReviewQueue() // Refresh the queue
  }

  const getAgeIndicator = (createdAt: string) => {
    const daysOld = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
    if (daysOld > 7) {
      return <Badge variant="destructive" className="ml-2">Urgent</Badge>
    } else if (daysOld > 3) {
      return <Badge variant="secondary" className="ml-2">Aging</Badge>
    }
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground mt-2">Loading review queue...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Review Queue</h1>
        <p className="text-muted-foreground mt-2">
          Questions assigned to you for review
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{questions.length}</div>
            <p className="text-xs text-muted-foreground">
              Questions awaiting review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {questions.filter(q => {
                const daysOld = Math.floor((Date.now() - new Date(q.created_at).getTime()) / (1000 * 60 * 60 * 24))
                return daysOld > 7
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Over 7 days old
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Age</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {questions.length > 0
                ? Math.floor(
                    questions.reduce((sum, q) => {
                      return sum + (Date.now() - new Date(q.created_at).getTime()) / (1000 * 60 * 60 * 24)
                    }, 0) / questions.length
                  )
                : 0}d
            </div>
            <p className="text-xs text-muted-foreground">
              Average wait time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Refresh */}
      <div className="flex items-center justify-between gap-4">
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
          onClick={fetchReviewQueue}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Questions Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Question</TableHead>
              <TableHead>Creator</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredQuestions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  {searchTerm ? 'No questions found matching your search' : 'No questions in your review queue'}
                </TableCell>
              </TableRow>
            ) : (
              filteredQuestions.map((question) => (
                <TableRow key={question.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium flex items-center">
                        {question.title}
                        {getAgeIndicator(question.created_at)}
                      </div>
                      <div className="text-sm text-muted-foreground line-clamp-2">
                        {question.stem}
                      </div>
                      {question.resubmission_notes && (
                        <div className="mt-2 p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                          <div className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">
                            Changes Made:
                          </div>
                          <div className="text-xs text-blue-700 dark:text-blue-300">
                            {question.resubmission_notes}
                          </div>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{question.creator_name}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(question.created_at), { addSuffix: true })}
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
                        onClick={() => handlePreview(question)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReviewAction(question, 'approve')}
                      >
                        <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReviewAction(question, 'reject')}
                      >
                        <XCircle className="h-4 w-4 mr-1 text-red-600" />
                        Reject
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
          {reviewAction && (
            <ReviewActionDialog
              open={true}
              onOpenChange={(open) => !open && setReviewAction(null)}
              question={selectedQuestion}
              action={reviewAction}
              onSuccess={handleReviewComplete}
            />
          )}
        </>
      )}
    </div>
  )
}

