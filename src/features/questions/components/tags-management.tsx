// src/features/questions/components/tags-management.tsx
'use client'

import { useState, useCallback, useEffect, memo } from 'react'
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
  Edit
} from 'lucide-react'
import { format } from 'date-fns'
import { CreateTagDialog } from './create-tag-dialog'
import { EditTagDialog } from './edit-tag-dialog'

interface Tag {
  id: string
  name: string
  created_at: string
  question_count?: number
}

const PAGE_SIZE = 10

const TagRow = memo(function TagRow({
  tag,
  onEdit,
  onDelete
}: {
  tag: Tag
  onEdit: (tag: Tag) => void
  onDelete: (tag: Tag) => void
}) {
  return (
    <TableRow key={tag.id}>
      <TableCell>
        <div className="font-medium">{tag.name}</div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/20 dark:text-slate-300 dark:border-slate-800">
          {tag.question_count || 0} questions
        </Badge>
      </TableCell>
      <TableCell>
        {format(new Date(tag.created_at), 'MMM d, yyyy')}
      </TableCell>
      <TableCell>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(tag)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(tag)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
})

export function TagsManagement() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalTags, setTotalTags] = useState(0)
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const supabase = createClient()

  const loadTags = useCallback(async () => {
    setLoading(true)
    try {
      // Use the admin API endpoint instead of direct Supabase queries
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: PAGE_SIZE.toString(),
        ...(searchTerm && { search: searchTerm })
      })

      const response = await fetch(`/api/admin/tags?${params}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load tags')
      }

      const data = await response.json()

      setTags(data.tags || [])
      setTotalTags(data.totalTags || 0)
      setTotalPages(data.totalPages || 0)
    } catch (error) {
      console.error('Error loading tags:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load tags')
    } finally {
      setLoading(false)
    }
  }, [searchTerm, page])

  const handleDelete = async () => {
    if (!selectedTag) return

    setIsDeleting(true)
    try {
      const response = await fetch('/api/admin/tags', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          tagId: selectedTag.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete tag')
      }

      toast.success('Tag deleted successfully')

      setShowDeleteDialog(false)
      setSelectedTag(null)
      loadTags()
    } catch (error) {
      console.error('Error deleting tag:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete tag')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCreateSuccess = () => {
    setShowCreateDialog(false)
    loadTags()
  }

  const handleEditSuccess = () => {
    setShowEditDialog(false)
    setSelectedTag(null)
    loadTags()
  }

  const handleEditTag = useCallback((tag: Tag) => {
    setSelectedTag(tag)
    setShowEditDialog(true)
  }, [])

  const handleDeleteTag = useCallback((tag: Tag) => {
    setSelectedTag(tag)
    setShowDeleteDialog(true)
  }, [])

  useEffect(() => {
    loadTags()
  }, [loadTags])

  return (
    <div className="space-y-4">
      {/* Header with search and create button */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tags..."
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
            onClick={() => loadTags()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Tag
        </Button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>Total: {totalTags} tags</span>
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
              <TableHead>Questions</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : tags.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  {searchTerm ? 'No tags found matching your search' : 'No tags found'}
                </TableCell>
              </TableRow>
            ) : (
              tags.map((tag) => (
                <TagRow
                  key={tag.id}
                  tag={tag}
                  onEdit={handleEditTag}
                  onDelete={handleDeleteTag}
                />
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
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the tag "{selectedTag?.name}"?
              This will remove it from all associated questions and cannot be undone.
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
      <CreateTagDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Dialog */}
      <EditTagDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={handleEditSuccess}
        tag={selectedTag}
      />
    </div>
  )
}
