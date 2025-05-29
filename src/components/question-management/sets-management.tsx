// src/components/question-management/sets-management.tsx
'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Search,
  Loader2,
  MoreVertical,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Edit
} from 'lucide-react'
import { format } from 'date-fns'
import { CreateSetDialog } from './create-set-dialog'
import { EditSetDialog } from './edit-set-dialog'

interface QuestionSet {
  id: string
  name: string
  description?: string
  source_type: string
  is_active: boolean
  created_at: string
  question_count?: number
  created_by_name?: string
}

const PAGE_SIZE = 10

const sourceTypeConfig = {
  'ai': { label: 'AI', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
  'web': { label: 'Web', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
  'book': { label: 'Book', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' },
  'handwritten': { label: 'Handwritten', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300' },
  'other': { label: 'Other', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300' }
}

export function SetsManagement() {
  const [sets, setSets] = useState<QuestionSet[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalSets, setTotalSets] = useState(0)
  const [selectedSet, setSelectedSet] = useState<QuestionSet | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const supabase = createClient()
  const { toast } = useToast()

  const loadSets = useCallback(async () => {
    setLoading(true)
    try {
      // Use the admin API endpoint instead of direct Supabase queries
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: PAGE_SIZE.toString(),
        ...(searchTerm && { search: searchTerm })
      })

      const response = await fetch(`/api/admin/question-sets?${params}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load question sets')
      }

      const data = await response.json()

      setSets(data.questionSets || [])
      setTotalSets(data.totalSets || 0)
      setTotalPages(data.totalPages || 0)
    } catch (error) {
      console.error('Error loading question sets:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load question sets'
      })
    } finally {
      setLoading(false)
    }
  }, [searchTerm, page, toast])

  const handleDelete = async () => {
    if (!selectedSet) return

    setIsDeleting(true)
    try {
      const response = await fetch('/api/admin/question-sets', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          setId: selectedSet.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete question set')
      }

      toast({
        title: 'Success',
        description: 'Question set deleted successfully'
      })

      setShowDeleteDialog(false)
      setSelectedSet(null)
      loadSets()
    } catch (error) {
      console.error('Error deleting question set:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete question set'
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCreateSuccess = () => {
    setShowCreateDialog(false)
    loadSets()
  }

  const handleEditSuccess = () => {
    setShowEditDialog(false)
    setSelectedSet(null)
    loadSets()
  }

  const toggleSetStatus = async (set: QuestionSet) => {
    try {
      const response = await fetch('/api/admin/question-sets', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          setId: set.id,
          updates: { is_active: !set.is_active }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update question set status')
      }

      toast({
        title: 'Success',
        description: `Question set ${set.is_active ? 'deactivated' : 'activated'} successfully`
      })

      loadSets()
    } catch (error) {
      console.error('Error updating question set status:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update question set status'
      })
    }
  }

  useEffect(() => {
    loadSets()
  }, [loadSets])

  return (
    <div className="space-y-4">
      {/* Header with search and create button */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search question sets..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPage(0)
              }}
              className="pl-8"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadSets()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Question Set
        </Button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>Total: {totalSets} question sets</span>
        {searchTerm && (
          <span>Showing results for "{searchTerm}"</span>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Source Type</TableHead>
              <TableHead>Questions</TableHead>
              <TableHead>Status</TableHead>
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
            ) : sets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {searchTerm ? 'No question sets found matching your search' : 'No question sets found'}
                </TableCell>
              </TableRow>
            ) : (
              sets.map((set) => (
                <TableRow key={set.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{set.name}</div>
                      {set.description && (
                        <div className="text-sm text-muted-foreground max-w-xs truncate">
                          {set.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={sourceTypeConfig[set.source_type as keyof typeof sourceTypeConfig]?.color || sourceTypeConfig.other.color}
                    >
                      {sourceTypeConfig[set.source_type as keyof typeof sourceTypeConfig]?.label || set.source_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {set.question_count || 0} questions
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {set.is_active ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className={set.is_active ? 'text-green-600' : 'text-red-600'}>
                        {set.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(set.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedSet(set)
                            setShowEditDialog(true)
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => toggleSetStatus(set)}
                        >
                          {set.is_active ? (
                            <>
                              <XCircle className="h-4 w-4 mr-2" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedSet(set)
                            setShowDeleteDialog(true)
                          }}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question Set</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the question set "{selectedSet?.name}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Dialog */}
      <CreateSetDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Dialog */}
      <EditSetDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={handleEditSuccess}
        questionSet={selectedSet}
      />
    </div>
  )
}
