'use client'

import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Label } from '@/shared/components/ui/label'
import {
  QuestionType,
  CategorySelection,
  CATEGORY_SELECTION_CONFIG,
  CategoryWithStats
} from '@/features/quiz/types/quiz'

interface CategorySelectorProps {
  categorySelection: CategorySelection
  selectedCategories: string[]
  questionType: QuestionType
  categories: CategoryWithStats[]
  questionTypeStats: {
    all: Record<QuestionType, number>
    ap_only: Record<QuestionType, number>
    cp_only: Record<QuestionType, number>
  }
  onCategorySelectionChange: (selection: CategorySelection) => void
  onCategoryToggle: (categoryId: string) => void
}

export function CategorySelector({
  categorySelection,
  selectedCategories,
  questionType,
  categories,
  questionTypeStats,
  onCategorySelectionChange,
  onCategoryToggle
}: CategorySelectorProps) {
  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Categories</Label>
      <div className="grid grid-cols-1 gap-2">
        {Object.entries(CATEGORY_SELECTION_CONFIG).map(([key, config]) => {
          const stats = questionTypeStats[key as keyof typeof questionTypeStats]
          const count = stats ? stats[questionType] : 0

          return (
            <Button
              key={key}
              variant={categorySelection === key ? "default" : "outline"}
              size="sm"
              onClick={() => onCategorySelectionChange(key as CategorySelection)}
              disabled={key !== 'custom' && count === 0}
            >
              <div className="text-center">
                <div className="font-medium text-xs">
                  {key === 'custom' ? config.label : `${config.label} (${count})`}
                </div>
              </div>
            </Button>
          )
        })}
      </div>

      {/* Custom Category Selection - Always visible when custom is selected */}
      {categorySelection === 'custom' && (
        <div className="space-y-3 border-t pt-3 mt-3">
          <Label className="text-sm font-medium">Select Specific Categories</Label>
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
            {categories.map((category) => {
              const count = category.questionStats[questionType]
              if (count === 0) return null

              const isSelected = selectedCategories.includes(category.id)

              return (
                <Badge
                  key={category.id}
                  variant={isSelected ? "default" : "outline"}
                  className="cursor-pointer hover:bg-secondary/80 flex items-center gap-1 px-2 py-1"
                  onClick={() => onCategoryToggle(category.id)}
                >
                  <span className="text-xs">{category.shortName}</span>
                  <span className="text-xs opacity-70">({count})</span>
                </Badge>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

