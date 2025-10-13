// src/components/question-management/categories-management.tsx
'use client'

import { useState, useCallback, useEffect } from 'react'
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
import { BlurredDialog } from '@/shared/components/ui/blurred-dialog'
import {
  Search,
  Loader2,
  MoreVertical,
  Plus,
  Trash2,
  RefreshCw,
  Edit,
  AlertTriangle
} from 'lucide-react'
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
  parent_short_form?: string
  parent_color?: string
  short_form?: string
}

// Category color mapping for better badge appearance
const getCategoryBadgeClass = (category: { short_form?: string; color?: string; parent_short_form?: string }) => {
  // Fallback to predefined colors based on short form
  const shortForm = category.short_form || category.parent_short_form

  // Main categories
  if (shortForm === 'AP') return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
  if (shortForm === 'CP') return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'

  // AP subspecialties - stronger colors
  if (category.parent_short_form === 'AP') {
    const colors = [
      'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800',
      'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800',
      'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
      'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-800',
      'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800',
      'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800',
      'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-800',
      'bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-900/20 dark:text-lime-300 dark:border-lime-800'
    ]
    const hash = shortForm ? shortForm.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 0
    return colors[hash % colors.length]
  }

  // CP subspecialties - lighter colors
  if (category.parent_short_form === 'CP') {
    const colors = [
      'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800',
      'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800',
      'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800',
      'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
      'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
    ]
    const hash = shortForm ? shortForm.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 0
    return colors[hash % colors.length]
  }

  // Default
  return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800'
}

const PAGE_SIZE = 30

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
      toast.error(error instanceof Error ? error.message : 'Failed to load categories')
    } finally {
      setLoading(false)
    }
  }, [searchTerm, page, organizeHierarchically])

  const handleDelete = async () => {
    if (!selectedCategory) return

    setIsDeleting(true)
    try {
      const response = await fetch('/api/admin/categories', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          categoryId: selectedCategory.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete category')
      }

      toast.success('Category deleted successfully')

      setShowDeleteDialog(false)
      setSelectedCategory(null)
      loadCategories()
    } catch (error) {
      console.error('Error deleting category:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete category')
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
    return (
      <div className="flex items-center">
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
              <TableHead>Short Form</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Questions</TableHead>
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
                    {category.short_form ? (
                      category.color ? (
                        <Badge
                          className="font-semibold px-3 py-1 text-white border-none"
                          style={{
                            backgroundColor: category.color,
                          }}
                        >
                          {category.short_form}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className={getCategoryBadgeClass(category)}
                        >
                          {category.short_form}
                        </Badge>
                      )
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {category.parent_short_form ? (
                      category.parent_color ? (
                        <Badge
                          className="text-white border-none"
                          style={{
                            backgroundColor: category.parent_color,
                          }}
                        >
                          {category.parent_short_form}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className={getCategoryBadgeClass({ short_form: category.parent_short_form, parent_short_form: category.parent_short_form })}
                        >
                          {category.parent_short_form}
                        </Badge>
                      )
                    ) : category.parent_name ? (
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
                    <DropdownMenu modal={false}>
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
      <BlurredDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Category"
        description={`Are you sure you want to delete the category "${selectedCategory?.name}"? This will remove it from all associated questions and cannot be undone.`}
        maxWidth="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Category'
              )}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This action cannot be undone. The category will be permanently removed from:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>All questions currently using this category</li>
            <li>The categories database</li>
          </ul>
          {selectedCategory && (selectedCategory.question_count || 0) > 0 && (
            <div className="flex items-center gap-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-md">
              <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
              <p className="text-sm text-orange-600 dark:text-orange-400">
                This category is currently used in {selectedCategory.question_count} question(s).
              </p>
            </div>
          )}
        </div>
      </BlurredDialog>

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
