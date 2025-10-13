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

// Mix two HSL colors by averaging their components
const mixColors = (color1: { h: number; s: number; l: number }, color2: { h: number; s: number; l: number }) => {
  // Average hue (handle wraparound)
  let h1 = color1.h
  let h2 = color2.h
  if (Math.abs(h1 - h2) > 180) {
    if (h1 < h2) h1 += 360
    else h2 += 360
  }
  const h = ((h1 + h2) / 2) % 360

  // Average saturation and lightness
  const s = (color1.s + color2.s) / 2
  const l = (color1.l + color2.l) / 2

  return { h, s, l }
}

// Generate 30 colors: 15 strong + 15 light versions
// Row 1: 5 chart colors + 10 mixed colors = 15 distinct colors
// Row 2: Lighter versions of row 1
const generateCategoryColors = () => {
  // Chart colors from globals.css
  const chartColors = [
    { h: 186, s: 66, l: 40, name: 'chart-1' },  // cyan
    { h: 214, s: 100, l: 60, name: 'chart-2' }, // blue
    { h: 262, s: 80, l: 56, name: 'chart-3' },  // purple
    { h: 32, s: 94, l: 56, name: 'chart-4' },   // orange
    { h: 354, s: 78, l: 56, name: 'chart-5' },  // red
  ]

  const strongColors: { value: string; name: string }[] = []

  // First 5: Pure chart colors
  chartColors.forEach((color) => {
    strongColors.push({
      value: `hsl(${color.h} ${color.s}% ${color.l}%)`,
      name: color.name
    })
  })

  // Next 10: Mixed colors (all unique combinations)
  const mixPairs = [
    [0, 1], // cyan + blue
    [0, 2], // cyan + purple
    [0, 3], // cyan + orange
    [0, 4], // cyan + red
    [1, 2], // blue + purple
    [1, 3], // blue + orange
    [1, 4], // blue + red
    [2, 3], // purple + orange
    [2, 4], // purple + red
    [3, 4], // orange + red
  ]

  mixPairs.forEach(([i, j]) => {
    const mixed = mixColors(chartColors[i], chartColors[j])
    strongColors.push({
      value: `hsl(${mixed.h} ${mixed.s}% ${mixed.l}%)`,
      name: `${chartColors[i].name}+${chartColors[j].name}`
    })
  })

  // Create light versions (increase lightness by 25%)
  const lightColors = strongColors.map((color) => {
    // Parse HSL from the value string
    const match = color.value.match(/hsl\((\d+\.?\d*) (\d+\.?\d*)% (\d+\.?\d*)%\)/)
    if (match) {
      const h = parseFloat(match[1])
      const s = parseFloat(match[2])
      const l = Math.min(85, parseFloat(match[3]) + 25) // Add 25% lightness, cap at 85%
      return {
        value: `hsl(${h} ${s}% ${l}%)`,
        name: `${color.name}-light`
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
                  className={`w-8 h-8 rounded-md border-2 transition-all hover:scale-110 ${
                    color === colorOption.value
                      ? 'border-foreground ring-2 ring-foreground ring-offset-2 scale-110'
                      : 'border-border hover:border-foreground/50'
                  }`}
                  style={{ backgroundColor: colorOption.value }}
                  onClick={() => setColor(color === colorOption.value ? '' : colorOption.value)}
                  disabled={isCreating}
                  title={colorOption.name}
                />
              ))}
            </div>

            {/* Row 2: Light versions of row 1 */}
            <div className="grid grid-cols-15 gap-2">
              {lightColors.map((colorOption, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`w-8 h-8 rounded-md border-2 transition-all hover:scale-110 ${
                    color === colorOption.value
                      ? 'border-foreground ring-2 ring-foreground ring-offset-2 scale-110'
                      : 'border-border hover:border-foreground/50'
                  }`}
                  style={{ backgroundColor: colorOption.value }}
                  onClick={() => setColor(color === colorOption.value ? '' : colorOption.value)}
                  disabled={isCreating}
                  title={colorOption.name}
                />
              ))}
            </div>
          </div>

          {/* Selected color info */}
          <div className="flex items-center gap-2 pt-1">
            {color ? (
              <>
                <div
                  className="w-6 h-6 rounded border-2 border-border"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm text-muted-foreground">
                  {[...strongColors, ...lightColors].find(c => c.value === color)?.name || color}
                </span>
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
              </>
            ) : (
              <span className="text-sm text-muted-foreground">No color selected</span>
            )}
          </div>
        </div>
      </form>
    </BlurredDialog>
  )
}
