// src/components/question-management/categories-management.tsx
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
  ChevronRight,
  Edit
} from 'lucide-react'
import { format } from 'date-fns'
import { CreateCategoryDialog } from './create-category-dialog'
import { EditCategoryDialog } from './edit-category-dialog'

interface Category {
  id: string
  name: string
  description?: string
  parent_id?: string
  level: number
  color?: string
  created_at: string
  question_count?: number
  parent_name?: string
}

const PAGE_SIZE = 10

export function CategoriesManagement() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalCategories, setTotalCategories] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const supabase = createClient()
  const { toast } = useToast()

  // Function to organize categories hierarchically
  const organizeHierarchically = useCallback((categories: Category[]): Category[] => {
    // Create a map for quick lookup
    const categoryMap = new Map<string, Category>()
    const rootCategories: Category[] = []
    const childCategories = new Map<string, Category[]>()

    // First pass: organize into map and separate roots from children
    categories.forEach(category => {
      categoryMap.set(category.id, category)
      if (!category.parent_id) {
        rootCategories.push(category)
      } else {
        if (!childCategories.has(category.parent_id)) {
          childCategories.set(category.parent_id, [])
        }
        childCategories.get(category.parent_id)!.push(category)
      }
    })

    // Sort function for alphabetical order
    const sortAlphabetically = (a: Category, b: Category) => a.name.localeCompare(b.name)

    // Recursive function to build hierarchy
    const buildHierarchy = (parentCategories: Category[]): Category[] => {
      const result: Category[] = []

      // Sort current level alphabetically
      parentCategories.sort(sortAlphabetically)

      parentCategories.forEach(category => {
        result.push(category)

        // Add children recursively
        const children = childCategories.get(category.id) || []
        if (children.length > 0) {
          result.push(...buildHierarchy(children))
        }
      })

      return result
    }

    return buildHierarchy(rootCategories)
  }, [])

  const loadCategories = useCallback(async () => {
    setLoading(true)
    try {
      // For hierarchical display, we need all categories to organize them properly
      // Use a large page size to get all categories, then handle pagination client-side
      const params = new URLSearchParams({
        page: '0',
        pageSize: '1000', // Get all categories for proper hierarchy
        ...(searchTerm && { search: searchTerm })
      })

      const response = await fetch(`/api/admin/categories?${params}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load categories')
      }

      const data = await response.json()
      const allCategories = data.categories || []

      // For search results, show all matching categories
      if (searchTerm) {
        setCategories(allCategories)
        setTotalCategories(allCategories.length)
        setTotalPages(1)
      } else {
        // For normal display, organize hierarchically first, then paginate
        const organizedCategories = organizeHierarchically(allCategories)
        const startIndex = page * PAGE_SIZE
        const endIndex = startIndex + PAGE_SIZE
        const paginatedCategories = organizedCategories.slice(startIndex, endIndex)

        setCategories(paginatedCategories)
        setTotalCategories(organizedCategories.length)
        setTotalPages(Math.ceil(organizedCategories.length / PAGE_SIZE))
      }
    } catch (error) {
      console.error('Error loading categories:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load categories'
      })
    } finally {
      setLoading(false)
    }
  }, [searchTerm, page, toast, organizeHierarchically])

  const handleDelete = async () => {
    if (!selectedCategory) return

    setIsDeleting(true)
    try {
      const response = await fetch('/api/admin/categories', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categoryId: selectedCategory.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete category')
      }

      toast({
        title: 'Success',
        description: 'Category deleted successfully'
      })

      setShowDeleteDialog(false)
      setSelectedCategory(null)
      loadCategories()
    } catch (error) {
      console.error('Error deleting category:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete category'
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCreateSuccess = () => {
    setShowCreateDialog(false)
    loadCategories()
  }

  const handleEditSuccess = () => {
    setShowEditDialog(false)
    setSelectedCategory(null)
    loadCategories()
  }

  const renderCategoryName = (category: Category) => {
    const indentLevel = category.level - 1
    const indentSpacing = indentLevel * 8 // Reduced from 20px to 8px per level

    return (
      <div className="flex items-center" style={{ paddingLeft: `${indentSpacing}px` }}>
        {category.level > 1 && (
          <div className="flex items-center mr-1 text-muted-foreground text-xs">
            {'> '.repeat(category.level - 1)}
          </div>
        )}
        {category.color && (
          <div
            className="w-3 h-3 rounded-full mr-2 border border-gray-300"
            style={{ backgroundColor: category.color }}
            title={`Category color: ${category.color}`}
          />
        )}
        <span className="font-medium">{category.name}</span>
      </div>
    )
  }

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  return (
    <div className="space-y-4">
      {/* Header with search and create button */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search categories..."
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
            onClick={() => loadCategories()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Category
        </Button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>Total: {totalCategories} categories</span>
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
              <TableHead>Parent</TableHead>
              <TableHead>Questions</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  {searchTerm ? 'No categories found matching your search' : 'No categories found'}
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell>
                    {renderCategoryName(category)}
                  </TableCell>
                  <TableCell>
                    {category.parent_name ? (
                      <Badge variant="outline">{category.parent_name}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {category.question_count || 0} questions
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(category.created_at), 'MMM d, yyyy')}
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
                            setSelectedCategory(category)
                            setShowEditDialog(true)
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedCategory(category)
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
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the category "{selectedCategory?.name}"?
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
      <CreateCategoryDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Dialog */}
      <EditCategoryDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={handleEditSuccess}
        category={selectedCategory}
      />
    </div>
  )
}
