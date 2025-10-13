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

// Generate 30 colors from chart variables
// Row 1 (AP - Strong): Mix chart-5 (red), chart-4 (orange), chart-3 (purple) at 100% saturation
// Row 2 (CP - Light): Mix chart-2 (blue), chart-1 (cyan) at 50% lightness
const generateCategoryColors = () => {
  const colors: { value: string; name: string }[] = []

  // AP Colors (Strong - Reddish) - 15 colors
  // Base: chart-5 (red), chart-4 (orange), chart-3 (purple)
  const apBases = [
    { h: 354, s: 78, l: 56, name: 'chart-5' }, // red
    { h: 32, s: 94, l: 56, name: 'chart-4' },  // orange
    { h: 262, s: 80, l: 56, name: 'chart-3' }, // purple
  ]

  apBases.forEach((base, i) => {
    // 5 variations per base color
    for (let j = 0; j < 5; j++) {
      const hueShift = (j - 2) * 8 // -16, -8, 0, 8, 16
      const satShift = (j - 2) * -3 // Vary saturation slightly
      const h = (base.h + hueShift + 360) % 360
      const s = Math.max(60, Math.min(95, base.s + satShift))
      const l = 65 // Consistent lightness for strong colors
      colors.push({
        value: `hsl(${h} ${s}% ${l}%)`,
        name: `${base.name}-${j + 1}`
      })
    }
  })

  // CP Colors (Light - Bluish) - 15 colors
  // Base: chart-2 (blue), chart-1 (cyan)
  const cpBases = [
    { h: 214, s: 100, l: 60, name: 'chart-2' }, // blue
    { h: 186, s: 66, l: 40, name: 'chart-1' },  // cyan
  ]

  // 7 from blue, 8 from cyan = 15 total
  cpBases.forEach((base, i) => {
    const count = i === 0 ? 7 : 8
    for (let j = 0; j < count; j++) {
      const hueShift = (j - Math.floor(count / 2)) * 6
      const h = (base.h + hueShift + 360) % 360
      const s = Math.max(50, Math.min(90, base.s - 10))
      const l = 82 // Light colors
      colors.push({
        value: `hsl(${h} ${s}% ${l}%)`,
        name: `${base.name}-${j + 1}`
      })
    }
  })

  return colors
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
  const allColors = useMemo(() => generateCategoryColors(), [])
  const apColors = useMemo(() => allColors.slice(0, 15), [allColors])
  const cpColors = useMemo(() => allColors.slice(15, 30), [allColors])

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
            {/* Row 1: AP Colors (Strong - Reddish) */}
            <div className="grid grid-cols-15 gap-2">
              {apColors.map((colorOption, idx) => (
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

            {/* Row 2: CP Colors (Light - Bluish) */}
            <div className="grid grid-cols-15 gap-2">
              {cpColors.map((colorOption, idx) => (
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
                  {allColors.find(c => c.value === color)?.name || color}
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
