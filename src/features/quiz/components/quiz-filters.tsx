"use client";

import { Card, CardContent } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Search } from "lucide-react";

interface QuizFiltersProps {
  searchTerm: string;
  selectedFilter: string;
  sortBy: string;
  onSearchChange: (value: string) => void;
  onFilterChange: (filter: string) => void;
  onSortChange: (sort: string) => void;
}

export function QuizFilters({
  searchTerm,
  selectedFilter,
  sortBy,
  onSearchChange,
  onFilterChange,
  onSortChange,
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

          {/* Filter Dropdown */}
          <Select value={selectedFilter} onValueChange={onFilterChange}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All Filters" />
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
      </CardContent>
    </Card>
  );
}
