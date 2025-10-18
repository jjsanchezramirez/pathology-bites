'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"
import { 
  Eye, 
  Search, 
  Clock,
  User,
  FileQuestion,
  Flag,
  AlertTriangle
} from 'lucide-react'
import { QuestionPreviewDialog } from './question-preview-dialog'
import { QuestionReviewDialog } from './question-review-dialog'
import { FlagResolutionDialog } from './flag-resolution-dialog'
import { toast } from 'sonner'
import { STATUS_CONFIG, QuestionWithDetails, QuestionFlagData } from '@/features/questions/types/questions'

// Component to handle search params
function TabInitializer({ setActiveTab }: { setActiveTab: (tab: string) => void }) {
  const searchParams = useSearchParams()

  useEffect(() => {
    const tabParam = searchParams?.get('tab')
    if (tabParam && ['all', 'new_submission', 'flagged_question'].includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [searchParams, setActiveTab])

  return null
}

interface ReviewQueueItem extends QuestionWithDetails {
  creator_name: string
  creator_email: string
  question_set_name?: string
  review_type: 'new_submission' | 'flagged_question' | 'other'
  priority_score: number
  flag_count?: number
  latest_flag_date?: string
}

export function UnifiedReviewQueue() {
  const router = useRouter()
  const [items, setItems] = useState<ReviewQueueItem[]>([])
  const [filteredItems, setFilteredItems] = useState<ReviewQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedItem, setSelectedItem] = useState<ReviewQueueItem | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [resolutionOpen, setResolutionOpen] = useState(false)
  const [selectedFlags, setSelectedFlags] = useState<QuestionFlagData[]>([])
  const [selectedQuestionTitle, setSelectedQuestionTitle] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  const supabase = createClient()

  const fetchReviewQueue = async () => {
    try {
      setLoading(true)
      
      // Use the simplified review queue view
      const { data, error } = await supabase
        .from('v_simplified_review_queue')
        .select('*')
        .order('priority_score', { ascending: false })
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching review queue:', error)
        toast.error('Failed to load review queue')
        return
      }

      setItems(data || [])
    } catch (error) {
      console.error('Error fetching review queue:', error)
      toast.error('Failed to load review queue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReviewQueue()
  }, [])

  useEffect(() => {
    let filtered = items

    // Apply tab filter
    if (activeTab !== 'all') {
      filtered = filtered.filter(item => item.review_type === activeTab)
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.stem.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.creator_name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredItems(filtered)
  }, [items, activeTab, searchTerm])

  const handlePreview = (item: ReviewQueueItem) => {
    setSelectedItem(item)
    setPreviewOpen(true)
  }

  const handleReview = (item: ReviewQueueItem) => {
    setSelectedItem(item)
    setReviewOpen(true)
  }

  const handleEdit = (item: ReviewQueueItem) => {
    router.push(`/admin/questions/${item.id}/edit`)
  }

  const handleResolveFlags = async (item: ReviewQueueItem) => {
    if (!item.flag_count || item.flag_count === 0) return

    try {
      // Fetch the actual flags for this question
      const { data: flags, error } = await supabase
        .from('question_flags')
        .select('*')
        .eq('question_id', item.id)
        .eq('status', 'open')

      if (error) {
        console.error('Error fetching flags:', error)
        toast.error('Failed to load flags')
        return
      }

      setSelectedFlags(flags || [])
      setSelectedQuestionTitle(item.title)
      setResolutionOpen(true)
    } catch (error) {
      console.error('Error fetching flags:', error)
      toast.error('Failed to load flags')
    }
  }

  const getItemTypeDisplay = (item: ReviewQueueItem) => {
    if (item.review_type === 'flagged_question') {
      return (
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-orange-500" />
          <span className="text-sm">Flagged ({item.flag_count})</span>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-2">
        <FileQuestion className="h-4 w-4 text-blue-500" />
        <span className="text-sm">New Submission</span>
      </div>
    )
  }

  const getTabCounts = () => {
    const newSubmissions = items.filter(item => item.review_type === 'new_submission').length
    const flaggedQuestions = items.filter(item => item.review_type === 'flagged_question').length
    
    return { newSubmissions, flaggedQuestions, total: items.length }
  }

  const counts = getTabCounts()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground mt-2">Loading review queue...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tab initializer wrapped in Suspense */}
      <Suspense fallback={null}>
        <TabInitializer setActiveTab={setActiveTab} />
      </Suspense>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Review Queue</h1>
          <p className="text-muted-foreground">
            Review new submissions and flagged questions
          </p>
        </div>
        <Button onClick={fetchReviewQueue} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search questions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">
            All ({counts.total})
          </TabsTrigger>
          <TabsTrigger value="new_submission">
            New Submissions ({counts.newSubmissions})
          </TabsTrigger>
          <TabsTrigger value="flagged_question">
            Flagged Questions ({counts.flaggedQuestions})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {/* Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <FileQuestion className="h-12 w-12 text-muted-foreground/50" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">
                            {items.length === 0 ? 'No items in review queue' : 'No items match your search'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {items.length === 0 ? 'All caught up!' : 'Try adjusting your search terms'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium line-clamp-1">{item.title}</p>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {item.stem}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{item.creator_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getItemTypeDisplay(item)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG]?.color}
                        >
                          {STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {item.difficulty}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(item.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreview(item)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReview(item)}
                          >
                            Review
                          </Button>
                          {item.review_type === 'flagged_question' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResolveFlags(item)}
                              className="text-green-600 hover:text-green-700"
                            >
                              <Flag className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <QuestionPreviewDialog
        question={selectedItem}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />

      <QuestionReviewDialog
        question={selectedItem}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onReviewComplete={fetchReviewQueue}
      />

      <FlagResolutionDialog
        flags={selectedFlags}
        questionTitle={selectedQuestionTitle}
        open={resolutionOpen}
        onOpenChange={setResolutionOpen}
        onResolutionComplete={fetchReviewQueue}
      />
    </div>
  )
}
