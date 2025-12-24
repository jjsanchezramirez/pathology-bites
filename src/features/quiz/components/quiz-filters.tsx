'use client'

import { Card, CardContent } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/shared/components/ui/select'
import { Search } from 'lucide-react'

interface QuizFiltersProps {
  searchTerm: string
  selectedFilters: string[]
  sortBy: string
  onSearchChange: (value: string) => void
  onFiltersChange: (filters: string[]) => void
  onSortChange: (sort: string) => void
}

export function QuizFilters({
  searchTerm,
  selectedFilters,
  sortBy,
  onSearchChange,
  onFiltersChange,
  onSortChange
}: QuizFiltersProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search quizzes..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Combined Filters Dropdown */}
          <Select
            value={selectedFilters.length === 0 ? "all" : selectedFilters.join(",")}
            onValueChange={(value) => {
              if (value === "all") {
                onFiltersChange([])
              } else {
                // Toggle filter
                const filter = value
                onFiltersChange(
                  selectedFilters.includes(filter)
                    ? selectedFilters.filter(f => f !== filter)
                    : [...selectedFilters, filter]
                )
              }
            }}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder={selectedFilters.length === 0 ? "All Filters" : `${selectedFilters.length} filters`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Filters</SelectItem>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Status</div>
              <SelectItem value="completed">✓ Completed</SelectItem>
              <SelectItem value="in_progress">⟳ In Progress</SelectItem>
              <SelectItem value="not_started">○ Not Started</SelectItem>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Mode</div>
              <SelectItem value="tutor">Tutor</SelectItem>
              <SelectItem value="practice">Practice</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Timing</div>
              <SelectItem value="timed">Timed</SelectItem>
              <SelectItem value="untimed">Untimed</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort Dropdown */}
          <Select value={sortBy} onValueChange={onSortChange}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Newest First</SelectItem>
              <SelectItem value="date-asc">Oldest First</SelectItem>
              <SelectItem value="score-desc">Highest Score</SelectItem>
              <SelectItem value="score-asc">Lowest Score</SelectItem>
              <SelectItem value="progress">Incomplete First</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active Filters Display */}
        {selectedFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {selectedFilters.map(filter => (
              <Badge
                key={filter}
                variant="secondary"
                className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => onFiltersChange(selectedFilters.filter(f => f !== filter))}
              >
                {filter} ×
              </Badge>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFiltersChange([])}
              className="h-6 px-2 text-xs"
            >
              Clear all
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

