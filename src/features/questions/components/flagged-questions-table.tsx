'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import {
  Eye,
  Search,
  Filter,
  Flag,
  AlertTriangle,
  Clock,
  User,
  FileQuestion,
  Edit,
  X,
  CheckCircle
} from 'lucide-react'
import { QuestionPreviewDialog } from './question-preview-dialog'
import { FlagResolutionDialog } from './flag-resolution-dialog'
import { toast } from 'sonner'
import { FLAG_TYPE_CONFIG, QuestionWithDetails, QuestionFlagData } from '@/features/questions/types/questions'
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status'

interface FlaggedQuestion extends QuestionWithDetails {
  flag_count: number
  latest_flag_date: string
  // Joined data
  creator?: {
    first_name: string
    last_name: string
    email: string
  }
  flags?: Array<{
    id: string
    flag_type: string
    description: string
    created_at: string
    status: string
    flagged_by_user?: {
      first_name: string
      last_name: string
    }
  }>
}

export function FlaggedQuestionsTable() {
  const router = useRouter()
  const [questions, setQuestions] = useState<FlaggedQuestion[]>([])
  const [filteredQuestions, setFilteredQuestions] = useState<FlaggedQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [flagTypeFilter, setFlagTypeFilter] = useState('all')
  const [selectedQuestion, setSelectedQuestion] = useState<FlaggedQuestion | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [resolutionOpen, setResolutionOpen] = useState(false)
  const [selectedFlags, setSelectedFlags] = useState<QuestionFlagData[]>([])
  const [selectedQuestionTitle, setSelectedQuestionTitle] = useState('')

  const { user } = useAuthStatus()
  const supabase = createClient()

  useEffect(() => {
    fetchFlaggedQuestions()
  }, [])

  const fetchFlaggedQuestions = async () => {
    try {
      setLoading(true)
      
      // Use the v_flagged_questions view to get questions with pending flags
      const { data: questionsData, error: questionsError } = await supabase
        .from('v_flagged_questions')
        .select(`
          *,
          creator:users!questions_created_by_fkey(first_name, last_name, email),
          question_set:question_sets(name, short_form)
        `)
        .order('latest_flag_date', { ascending: false })

      if (questionsError) {
        console.error('Error fetching flagged questions:', questionsError)
        toast.error(`Failed to load flagged questions: ${questionsError.message || 'Unknown error'}`)
        return
      }

      if (!questionsData || questionsData.length === 0) {
        setQuestions([])
        console.log('No flagged questions found')
        return
      }

      // Get detailed flag information for each question
      const questionIds = questionsData.map(q => q.id)
      const { data: flagsData } = await supabase
        .from('question_flags')
        .select(`
          id,
          question_id,
          flag_type,
          description,
          created_at,
          status,
          flagged_by_user:users!question_flags_flagged_by_fkey(first_name, last_name)
        `)
        .in('question_id', questionIds)
        .eq('status', 'open')
        .order('created_at', { ascending: false })

      // Combine questions with their flags
      const transformedQuestions: FlaggedQuestion[] = questionsData.map((question) => ({
        ...question,
        flags: flagsData?.filter(flag => flag.question_id === question.id) || []
      }))

      setQuestions(transformedQuestions)

    } catch (error) {
      console.error('Unexpected error fetching flagged questions:', error)
      toast.error('An unexpected error occurred while loading flagged questions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let filtered = questions

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(q => 
        q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.stem.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.creator?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.creator?.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply flag type filter
    if (flagTypeFilter !== 'all') {
      filtered = filtered.filter(q => 
        q.flags?.some(flag => flag.flag_type === flagTypeFilter)
      )
    }

    setFilteredQuestions(filtered)
  }, [questions, searchTerm, flagTypeFilter])

  const handlePreviewQuestion = (question: FlaggedQuestion) => {
    setSelectedQuestion(question)
    setPreviewOpen(true)
  }

  const handleEditQuestion = (question: FlaggedQuestion) => {
    router.push(`/admin/questions/${question.id}/edit`)
  }

  const handleResolveFlags = (question: FlaggedQuestion) => {
    // Convert the flags to the expected format
    const flags: QuestionFlagData[] = (question.flags || []).map(flag => ({
      id: flag.id,
      question_id: question.id,
      flagged_by: '', // We don't need this for resolution
      flag_type: flag.flag_type,
      description: flag.description,
      status: flag.status,
      resolved_by: null,
      resolved_at: null,
      resolution_notes: null,
      created_at: flag.created_at,
      updated_at: flag.created_at
    }))

    setSelectedFlags(flags)
    setSelectedQuestionTitle(question.title)
    setResolutionOpen(true)
  }

  const handleDismissFlags = async (questionId: string) => {
    try {
      const { error } = await supabase
        .from('question_flags')
        .update({
          status: 'closed',
          resolution_type: 'dismissed',
          resolved_by: user?.id,
          resolved_at: new Date().toISOString()
        })
        .eq('question_id', questionId)
        .eq('status', 'open')

      if (error) {
        console.error('Error dismissing flags:', error)
        toast.error('Failed to dismiss flags')
        return
      }

      toast.success('Flags dismissed successfully')
      fetchFlaggedQuestions()
    } catch (error) {
      console.error('Unexpected error dismissing flags:', error)
      toast.error('An unexpected error occurred')
    }
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

  const getFlagTypeBadges = (flags: FlaggedQuestion['flags']) => {
    if (!flags || flags.length === 0) return null
    
    const uniqueTypes = [...new Set(flags.map(f => f.flag_type))]
    return uniqueTypes.map(type => (
      <Badge key={type} variant="destructive" className="text-xs">
        {FLAG_TYPE_CONFIG[type as keyof typeof FLAG_TYPE_CONFIG]?.label || type}
      </Badge>
    ))
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
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 sm:w-64">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search flagged questions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={flagTypeFilter} onValueChange={setFlagTypeFilter}>
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Flag Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Flag Types</SelectItem>
            {Object.entries(FLAG_TYPE_CONFIG).map(([type, config]) => (
              <SelectItem key={type} value={type}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Question</TableHead>
              <TableHead>Creator</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead>Flag Types</TableHead>
              <TableHead>Flag Count</TableHead>
              <TableHead>Latest Flag</TableHead>
              <TableHead className="w-[150px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredQuestions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <Flag className="h-12 w-12 text-muted-foreground/50" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        {questions.length === 0 ? 'No flagged questions' : 'No questions match your search'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {questions.length === 0
                          ? 'Flagged questions will appear here when users report issues.'
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
                    <div className="flex flex-wrap gap-1">
                      {getFlagTypeBadges(question.flags)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-red-600 border-red-600">
                      {question.flag_count}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(question.latest_flag_date).toLocaleDateString()}
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
                        onClick={() => handleEditQuestion(question)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResolveFlags(question)}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        title="Resolve flags"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDismissFlags(question.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Quick dismiss all flags"
                      >
                        <X className="h-4 w-4" />
                      </Button>
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

      {/* Flag Resolution Dialog */}
      <FlagResolutionDialog
        flags={selectedFlags}
        questionTitle={selectedQuestionTitle}
        open={resolutionOpen}
        onOpenChange={setResolutionOpen}
        onResolutionComplete={fetchFlaggedQuestions}
      />
    </div>
  )
}
