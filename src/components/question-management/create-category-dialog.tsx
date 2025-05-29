// src/components/question-management/create-category-dialog.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
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

interface CreateCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

interface Category {
  id: string
  name: string
  level: number
  color?: string
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

export function CreateCategoryDialog({ open, onOpenChange, onSuccess }: CreateCategoryDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [parentId, setParentId] = useState<string>('none')
  const [color, setColor] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)

  const supabase = createClient()
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
      setCategories(data.categories || [])
    } catch (error) {
      console.error('Error loading categories:', error)
    } finally {
      setLoadingCategories(false)
    }
  }

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

    setIsCreating(true)
    try {
      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          parentId: parentId && parentId !== 'none' ? parentId : null,
          color: color || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create category')
      }

      toast({
        title: 'Success',
        description: 'Category created successfully'
      })

      setName('')
      setDescription('')
      setParentId('none')
      setColor('')
      onSuccess()
    } catch (error) {
      console.error('Error creating category:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create category'
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isCreating) {
      onOpenChange(newOpen)
      if (!newOpen) {
        setName('')
        setDescription('')
        setParentId('none')
        setColor('')
      }
    }
  }

  const renderCategoryOption = (category: Category) => {
    const indent = '  '.repeat(category.level - 1)
    return `${indent}${category.name}`
  }

  useEffect(() => {
    if (open) {
      loadCategories()
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Category</DialogTitle>
          <DialogDescription>
            Add a new category to organize your questions. Categories can be hierarchical with parent-child relationships.
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
              disabled={isCreating}
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
              disabled={isCreating}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="parent">Parent Category (Optional)</Label>
            <Select value={parentId} onValueChange={setParentId} disabled={isCreating || loadingCategories}>
              <SelectTrigger>
                <SelectValue placeholder="Select parent category..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No parent (top-level category)</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {renderCategoryOption(category)}
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
                  disabled={isCreating}
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
                disabled={isCreating}
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
                  disabled={isCreating}
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
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || !name.trim()}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Category'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
