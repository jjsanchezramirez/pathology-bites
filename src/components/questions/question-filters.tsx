// src/components/questions/question-filters.tsx
'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DIFFICULTY_LABELS, YIELD_LABELS } from '@/types/questions'

interface QuestionFilter {
  search: string
  difficulty: string
  yield: string
}

interface QuestionFiltersProps {
  filters: QuestionFilter
  onFilterChange: (key: keyof QuestionFilter, value: string) => void
}

export function QuestionFilters({ filters, onFilterChange }: QuestionFiltersProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search questions..."
          className="pl-9"
          value={filters.search}
          onChange={(e) => onFilterChange('search', e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Select
          value={filters.difficulty}
          onValueChange={(value) => onFilterChange('difficulty', value)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Difficulties</SelectItem>
            {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.yield}
          onValueChange={(value) => onFilterChange('yield', value)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Yield" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Yields</SelectItem>
            {Object.entries(YIELD_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}