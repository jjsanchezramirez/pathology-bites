// src/components/question-management/create-category-dialog.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/shared/services/client'
import { toast } from 'sonner'
import { BlurredDialog } from '@/shared/components/ui/blurred-dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Loader2 } from 'lucide-react'

// Generate 30 colors: 15 strong + 15 light versions
// Row 1: 5 chart colors + 10 carefully selected mixed colors = 15 distinct colors
// Row 2: Lighter versions of row 1
const generateCategoryColors = () => {
  // Chart colors from globals.css
  const chartColors = [
    { h: 186, s: 66, l: 40 },  // chart-1: cyan
    { h: 214, s: 100, l: 60 }, // chart-2: blue
    { h: 262, s: 80, l: 56 },  // chart-3: purple
    { h: 32, s: 94, l: 56 },   // chart-4: orange
    { h: 354, s: 78, l: 56 },  // chart-5: red
  ]

  const strongColors: { value: string }[] = []

  // Create 15 distinct colors by mixing chart colors strategically
  // Avoid similar combinations
  const colorRecipes = [
    // Pure chart colors (5)
    { h: 186, s: 66, l: 40 },   // 1. Cyan (chart-1)
    { h: 214, s: 100, l: 60 },  // 2. Blue (chart-2)
    { h: 262, s: 80, l: 56 },   // 3. Purple (chart-3)
    { h: 32, s: 94, l: 56 },    // 4. Orange (chart-4)
    { h: 354, s: 78, l: 56 },   // 5. Red (chart-5)

    // Mixed colors (10) - carefully selected to be visually distinct
    { h: 200, s: 83, l: 50 },   // 6. Teal (cyan+blue)
    { h: 224, s: 90, l: 58 },   // 7. Sky blue (blue shifted)
    { h: 280, s: 85, l: 58 },   // 8. Violet (purple shifted)
    { h: 20, s: 90, l: 52 },    // 9. Coral (orange+red)
    { h: 340, s: 82, l: 54 },   // 10. Pink (red shifted)
    { h: 170, s: 70, l: 45 },   // 11. Turquoise (cyan shifted)
    { h: 245, s: 88, l: 58 },   // 12. Periwinkle (blue+purple)
    { h: 295, s: 75, l: 54 },   // 13. Magenta (purple+red)
    { h: 45, s: 92, l: 54 },    // 14. Gold (orange shifted)
    { h: 10, s: 85, l: 52 },    // 15. Vermillion (orange+red shifted)
  ]

  colorRecipes.forEach((color) => {
    strongColors.push({
      value: `hsl(${color.h} ${color.s}% ${color.l}%)`
    })
  })

  // Create light versions (increase lightness by 25%)
  const lightColors = strongColors.map((color) => {
    const match = color.value.match(/hsl\((\d+\.?\d*) (\d+\.?\d*)% (\d+\.?\d*)%\)/)
    if (match) {
      const h = parseFloat(match[1])
      const s = parseFloat(match[2])
      const l = Math.min(85, parseFloat(match[3]) + 25)
      return {
        value: `hsl(${h} ${s}% ${l}%)`
      }
    }
    return color
  })

  return { strongColors, lightColors }
}

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
  short_form?: string
}

export function CreateCategoryDialog({ open, onOpenChange, onSuccess }: CreateCategoryDialogProps) {
  const [name, setName] = useState('')
  const [shortForm, setShortForm] = useState('')
  const [parentId, setParentId] = useState<string>('none')
  const [color, setColor] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)

  const supabase = createClient()

  // Generate colors once
  const { strongColors, lightColors } = useMemo(() => generateCategoryColors(), [])

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
      toast.error('Category name is required')
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
          shortForm: shortForm.trim() || null,
          parentId: parentId && parentId !== 'none' ? parentId : null,
          color: color || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create category')
      }

      toast.success('Category created successfully')

      setName('')
      setShortForm('')
      setParentId('none')
      setColor('')
      // Close dialog first, then refresh data
      onOpenChange(false)
      setTimeout(() => {
        onSuccess()
      }, 100)
    } catch (error) {
      console.error('Error creating category:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create category')
    } finally {
      setIsCreating(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isCreating) {
      onOpenChange(newOpen)
      if (!newOpen) {
        setName('')
        setShortForm('')
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
    <BlurredDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Create New Category"
      description="Add a new category to organize your questions. Categories can be hierarchical with parent-child relationships."
      maxWidth="2xl"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isCreating || !name.trim()}
            onClick={handleSubmit}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Category'
            )}
          </Button>
        </>
      }
    >

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
          <Label htmlFor="shortForm">Short Form</Label>
          <Input
            id="shortForm"
            placeholder="e.g., AP, CP, HEME..."
            value={shortForm}
            onChange={(e) => setShortForm(e.target.value.toUpperCase())}
            disabled={isCreating}
            maxLength={10}
          />
          <p className="text-xs text-muted-foreground">
            Short abbreviation for this category (max 10 characters)
          </p>
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

        <div className="space-y-3">
          <Label>Category Color</Label>

          {/* All 30 colors in 2 rows of 15 */}
          <div className="space-y-2">
            {/* Row 1: Strong colors (5 chart + 10 mixed) */}
            <div className="grid grid-cols-15 gap-2">
              {strongColors.map((colorOption, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`w-8 h-8 rounded border transition-all hover:scale-105 ${
                    color === colorOption.value
                      ? 'border-foreground scale-105'
                      : 'border-border/50 hover:border-foreground/30'
                  }`}
                  style={{ backgroundColor: colorOption.value }}
                  onClick={() => setColor(color === colorOption.value ? '' : colorOption.value)}
                  disabled={isCreating}
                />
              ))}
            </div>

            {/* Row 2: Light versions of row 1 */}
            <div className="grid grid-cols-15 gap-2">
              {lightColors.map((colorOption, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`w-8 h-8 rounded border transition-all hover:scale-105 ${
                    color === colorOption.value
                      ? 'border-foreground scale-105'
                      : 'border-border/50 hover:border-foreground/30'
                  }`}
                  style={{ backgroundColor: colorOption.value }}
                  onClick={() => setColor(color === colorOption.value ? '' : colorOption.value)}
                  disabled={isCreating}
                />
              ))}
            </div>
          </div>

          {/* Selected color preview */}
          {color && (
            <div className="flex items-center gap-2 pt-1">
              <div
                className="w-6 h-6 rounded border border-border"
                style={{ backgroundColor: color }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setColor('')}
                disabled={isCreating}
                className="text-xs ml-auto"
              >
                Clear
              </Button>
            </div>
          )}
        </div>
      </form>
    </BlurredDialog>
  )
}
