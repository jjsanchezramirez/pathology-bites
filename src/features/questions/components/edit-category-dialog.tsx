// src/components/question-management/edit-category-dialog.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
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

interface Category {
  id: string
  name: string
  parent_id?: string
  level: number
  color?: string
  short_form?: string
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

export function EditCategoryDialog({ open, onOpenChange, onSuccess, category }: EditCategoryDialogProps) {
  const [name, setName] = useState('')
  const [shortForm, setShortForm] = useState('')
  const [parentId, setParentId] = useState<string>('none')
  const [color, setColor] = useState<string>('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)

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
      setShortForm(category.short_form || '')
      setParentId(category.parent_id || 'none')
      setColor(category.color || '')
      loadCategories()
    }
  }, [category, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Category name is required')
      return
    }

    if (!category) {
      toast.error('No category selected for editing')
      return
    }

    setIsUpdating(true)
    try {
      const response = await fetch('/api/admin/categories', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          categoryId: category.id,
          name: name.trim(),
          shortForm: shortForm.trim() || null,
          parentId: parentId && parentId !== 'none' ? parentId : null,
          color: color || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update category')
      }

      toast.success('Category updated successfully')

      // Close dialog first, then refresh data
      onOpenChange(false)
      setTimeout(() => {
        onSuccess()
      }, 100)
    } catch (error) {
      console.error('Error updating category:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update category')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isUpdating) {
      onOpenChange(newOpen)
      // Note: State cleanup removed to prevent conflicts with Select dropdown portals
      // State will be reset when dialog opens again via useEffect
    }
  }

  const renderCategoryOption = (cat: Category) => {
    const indent = '  '.repeat(cat.level - 1)
    return `${indent}${cat.name}`
  }

  return (
    <BlurredDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Edit Category"
      description="Update the category details. This will affect all questions that use this category."
      maxWidth="2xl"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isUpdating}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isUpdating || !name.trim()}
            onClick={handleSubmit}
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Category'
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
              disabled={isUpdating}
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
              disabled={isUpdating}
              maxLength={10}
            />
            <p className="text-xs text-muted-foreground">
              Short abbreviation for this category (max 10 characters)
            </p>
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
                    disabled={isUpdating}
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
                    disabled={isUpdating}
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
                    disabled={isUpdating}
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
