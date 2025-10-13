// src/components/question-management/sets-management.tsx
'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/shared/services/client'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Checkbox } from '@/shared/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog'
import {
  Search,
  Loader2,
  MoreVertical,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Edit,
  Merge,
  AlertTriangle
} from 'lucide-react'
import { CreateSetDialog } from './create-set-dialog'
import { EditSetDialog } from './edit-set-dialog'
import { getQuestionSetDisplayName } from '@/features/questions/utils/display-helpers'
import { SOURCE_TYPE_CONFIG } from '@/features/questions/types/question-sets'

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

const PAGE_SIZE = 30

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

  // Selection and bulk operations state
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set())
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [mergeTargetSet, setMergeTargetSet] = useState<QuestionSet | null>(null)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [isMerging, setIsMerging] = useState(false)

  const supabase = createClient()

  // Selection helper functions
  const handleSelectSet = (setId: string) => {
    const newSelected = new Set(selectedSetIds)
    if (newSelected.has(setId)) {
      newSelected.delete(setId)
    } else {
      newSelected.add(setId)
    }
    setSelectedSetIds(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedSetIds.size === sets.length) {
      setSelectedSetIds(new Set())
    } else {
      setSelectedSetIds(new Set(sets.map(set => set.id)))
    }
  }

  const clearSelection = () => {
    setSelectedSetIds(new Set())
  }

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
      toast.error(error instanceof Error ? error.message : 'Failed to load question sets')
    } finally {
      setLoading(false)
    }
  }, [searchTerm, page])

  const handleDelete = async () => {
    if (!selectedSet) return

    setIsDeleting(true)
    try {
      const response = await fetch('/api/admin/question-sets', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          setId: selectedSet.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete question set')
      }

      toast.success('Question set deleted successfully')

      setShowDeleteDialog(false)
      setSelectedSet(null)
      loadSets()
    } catch (error) {
      console.error('Error deleting question set:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete question set')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedSetIds.size === 0) return

    setIsBulkDeleting(true)
    try {
      const setIds = Array.from(selectedSetIds)

      const response = await fetch('/api/admin/question-sets/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ setIds })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete question sets')
      }

      const result = await response.json()
      toast.success(`Successfully deleted ${result.deletedCount} question sets`)

      setShowBulkDeleteDialog(false)
      clearSelection()
      loadSets()
    } catch (error) {
      console.error('Error bulk deleting question sets:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete question sets')
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const handleMergeSets = async () => {
    if (selectedSetIds.size < 2 || !mergeTargetSet) return

    setIsMerging(true)
    try {
      const sourceSetIds = Array.from(selectedSetIds).filter(id => id !== mergeTargetSet.id)

      const response = await fetch('/api/admin/question-sets/merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          sourceSetIds,
          targetSetId: mergeTargetSet.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to merge question sets')
      }

      const result = await response.json()
      toast.success(`Successfully merged ${result.mergedCount} question sets into "${mergeTargetSet.name}"`)

      setShowMergeDialog(false)
      setMergeTargetSet(null)
      clearSelection()
      loadSets()
    } catch (error) {
      console.error('Error merging question sets:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to merge question sets')
    } finally {
      setIsMerging(false)
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

      toast.success(`Question set ${set.is_active ? 'deactivated' : 'activated'} successfully`)

      loadSets()
    } catch (error) {
      console.error('Error updating question set status:', error)
      toast.error('Failed to update question set status')
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
        <div className="flex items-center gap-2">
          {selectedSetIds.size > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkDeleteDialog(true)}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete ({selectedSetIds.size})
              </Button>
              {selectedSetIds.size >= 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMergeDialog(true)}
                  disabled={loading}
                >
                  <Merge className="h-4 w-4 mr-2" />
                  Merge ({selectedSetIds.size})
                </Button>
              )}
            </>
          )}
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Question Set
          </Button>
        </div>
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
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedSetIds.size === sets.length && sets.length > 0}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all question sets"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Source Type</TableHead>
              <TableHead>Questions</TableHead>
              <TableHead>Status</TableHead>
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
                <TableRow key={set.id} className={selectedSetIds.has(set.id) ? 'bg-muted/50' : ''}>
                  <TableCell>
                    <Checkbox
                      checked={selectedSetIds.has(set.id)}
                      onCheckedChange={() => handleSelectSet(set.id)}
                      aria-label={`Select ${set.name}`}
                    />
                  </TableCell>
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
                      className={SOURCE_TYPE_CONFIG[set.source_type as keyof typeof SOURCE_TYPE_CONFIG]?.color || SOURCE_TYPE_CONFIG.other.color}
                    >
                      <span className="mr-1">
                        {SOURCE_TYPE_CONFIG[set.source_type as keyof typeof SOURCE_TYPE_CONFIG]?.icon || SOURCE_TYPE_CONFIG.other.icon}
                      </span>
                      {SOURCE_TYPE_CONFIG[set.source_type as keyof typeof SOURCE_TYPE_CONFIG]?.label || set.source_type}
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
                    <DropdownMenu modal={false}>
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

      {/* Bulk Delete Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question Sets</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedSetIds.size} question sets?
              This action cannot be undone and will affect all questions in these sets.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isBulkDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                `Delete ${selectedSetIds.size} Sets`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Merge Dialog */}
      <AlertDialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge Question Sets</AlertDialogTitle>
            <AlertDialogDescription>
              Select a target question set to merge {selectedSetIds.size} selected sets into.
              All questions will be moved to the target set and the source sets will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Question Set:</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    {mergeTargetSet ? mergeTargetSet.name : "Select target set..."}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full">
                  {sets
                    .filter(set => selectedSetIds.has(set.id))
                    .map(set => (
                      <DropdownMenuItem
                        key={set.id}
                        onClick={() => setMergeTargetSet(set)}
                      >
                        {set.name} ({set.question_count || 0} questions)
                      </DropdownMenuItem>
                    ))
                  }
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMergeTargetSet(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMergeSets}
              disabled={!mergeTargetSet || isMerging}
            >
              {isMerging ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Merging...
                </>
              ) : (
                'Merge Sets'
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
