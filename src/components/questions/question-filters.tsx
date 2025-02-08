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
            <SelectItem value="EASY">Easy</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="HARD">Hard</SelectItem>
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
            <SelectItem value="HIGH_YIELD">High Yield</SelectItem>
            <SelectItem value="MEDIUM_YIELD">Medium Yield</SelectItem>
            <SelectItem value="LOW_YIELD">Low Yield</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}