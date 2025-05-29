// src/components/question-management/edit-category-dialog.tsx
'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

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

interface EditCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  category: Category | null
}

const predefinedColors = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#64748b', // slate
  '#78716c', // stone
]

export function EditCategoryDialog({ open, onOpenChange, onSuccess, category }: EditCategoryDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [parentId, setParentId] = useState<string>('none')
  const [color, setColor] = useState<string>('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)

  const { toast } = useToast()

  const loadCategories = async () => {
    setLoadingCategories(true)
    try {
      // Use a large page size to get all categories for the dropdown
      const response = await fetch('/api/admin/categories?page=0&pageSize=1000')

      if (!response.ok) {
        throw new Error('Failed to load categories')
      }

      const data = await response.json()
      // Filter out the current category and its descendants to prevent circular references
      const filteredCategories = (data.categories || []).filter((cat: Category) => {
        if (!category) return true
        // Don't include the current category or any of its descendants
        return cat.id !== category.id && !cat.parent_id?.includes(category.id)
      })
      setCategories(filteredCategories)
    } catch (error) {
      console.error('Error loading categories:', error)
    } finally {
      setLoadingCategories(false)
    }
  }

  // Update form when category changes
  useEffect(() => {
    if (category && open) {
      setName(category.name)
      setDescription(category.description || '')
      setParentId(category.parent_id || 'none')
      setColor(category.color || '')
      loadCategories()
    }
  }, [category, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Category name is required'
      })
      return
    }

    if (!category) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No category selected for editing'
      })
      return
    }

    setIsUpdating(true)
    try {
      const response = await fetch('/api/admin/categories', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categoryId: category.id,
          name: name.trim(),
          description: description.trim() || null,
          parentId: parentId && parentId !== 'none' ? parentId : null,
          color: color || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update category')
      }

      toast({
        title: 'Success',
        description: 'Category updated successfully'
      })

      onSuccess()
    } catch (error) {
      console.error('Error updating category:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update category'
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isUpdating) {
      onOpenChange(newOpen)
      if (!newOpen) {
        setName('')
        setDescription('')
        setParentId('none')
        setColor('')
      }
    }
  }

  const renderCategoryOption = (cat: Category) => {
    const indent = '  '.repeat(cat.level - 1)
    return `${indent}${cat.name}`
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
          <DialogDescription>
            Update the category details. This will affect all questions that use this category.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Category Name</Label>
            <Input
              id="name"
              placeholder="Enter category name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isUpdating}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Enter category description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isUpdating}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="parent">Parent Category (Optional)</Label>
            <Select value={parentId} onValueChange={setParentId} disabled={isUpdating || loadingCategories}>
              <SelectTrigger>
                <SelectValue placeholder="Select parent category..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No parent (top-level category)</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {renderCategoryOption(cat)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {loadingCategories && (
              <div className="text-sm text-muted-foreground">Loading categories...</div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Category Color (Optional)</Label>
            <div className="flex flex-wrap gap-2">
              {predefinedColors.map((colorOption) => (
                <button
                  key={colorOption}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === colorOption
                      ? 'border-gray-900 scale-110'
                      : 'border-gray-300 hover:border-gray-500'
                  }`}
                  style={{ backgroundColor: colorOption }}
                  onClick={() => setColor(color === colorOption ? '' : colorOption)}
                  disabled={isUpdating}
                  title={`Select color: ${colorOption}`}
                />
              ))}
              {color && !predefinedColors.includes(color) && (
                <div
                  className="w-8 h-8 rounded-full border-2 border-gray-900"
                  style={{ backgroundColor: color }}
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={isUpdating}
                className="w-16 h-8 p-1 border rounded"
              />
              <span className="text-sm text-muted-foreground">
                {color ? `Selected: ${color}` : 'No color selected'}
              </span>
              {color && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setColor('')}
                  disabled={isUpdating}
                  className="text-xs"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isUpdating || !name.trim()}>
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Category'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
