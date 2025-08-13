// src/features/learning-modules/components/module-list.tsx

'use client'

import React, { useState } from 'react'
import { Search, Filter, Grid, List, SortAsc, SortDesc } from 'lucide-react'
import { LearningModule, LearningModuleFilters } from '../types/learning-modules'
import { ModuleCard } from './module-card'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Badge } from '@/shared/components/ui/badge'
import { Separator } from '@/shared/components/ui/separator'
import { Card, CardContent } from '@/shared/components/ui/card'

interface ModuleListProps {
  modules: LearningModule[]
  loading?: boolean
  filters?: LearningModuleFilters
  onFiltersChange?: (filters: LearningModuleFilters) => void
  onModuleClick?: (module: LearningModule) => void
  showProgress?: boolean
  showCategory?: boolean
  variant?: 'grid' | 'list'
  className?: string
}

export function ModuleList({
  modules,
  loading = false,
  filters = {},
  onFiltersChange,
  onModuleClick,
  showProgress = false,
  showCategory = true,
  variant = 'grid',
  className = ''
}: ModuleListProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(variant)
  const [sortBy, setSortBy] = useState<'title' | 'difficulty' | 'duration' | 'rating' | 'created'>('title')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [searchTerm, setSearchTerm] = useState(filters.search || '')

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    onFiltersChange?.({ ...filters, search: value || undefined })
  }

  const handleFilterChange = (key: keyof LearningModuleFilters, value: any) => {
    onFiltersChange?.({ ...filters, [key]: value || undefined })
  }

  const handleSortChange = (newSortBy: typeof sortBy) => {
    if (newSortBy === sortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(newSortBy)
      setSortOrder('asc')
    }
  }

  const sortedModules = React.useMemo(() => {
    const sorted = [...modules].sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortBy) {
        case 'title':
          aValue = a.title.toLowerCase()
          bValue = b.title.toLowerCase()
          break
        case 'difficulty':
          const difficultyOrder = { beginner: 1, intermediate: 2, advanced: 3 }
          aValue = difficultyOrder[a.difficulty_level]
          bValue = difficultyOrder[b.difficulty_level]
          break
        case 'duration':
          aValue = a.estimated_duration_minutes
          bValue = b.estimated_duration_minutes
          break
        case 'rating':
          aValue = a.average_rating || 0
          bValue = b.average_rating || 0
          break
        case 'created':
          aValue = new Date(a.created_at).getTime()
          bValue = new Date(b.created_at).getTime()
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [modules, sortBy, sortOrder])

  const clearFilters = () => {
    setSearchTerm('')
    onFiltersChange?.({})
  }

  const hasActiveFilters = !!(
    filters.search ||
    filters.difficulty_level ||
    filters.content_type ||
    filters.category_id ||
    filters.is_featured
  )

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {/* Loading skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-10 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-full mb-4" />
                <div className="flex gap-2 mb-4">
                  <div className="h-6 bg-gray-200 rounded w-16" />
                  <div className="h-6 bg-gray-200 rounded w-20" />
                </div>
                <div className="h-8 bg-gray-200 rounded w-24 ml-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search modules..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2">
          <Select
            value={filters.difficulty_level || 'all'}
            onValueChange={(value) => handleFilterChange('difficulty_level', value === 'all' ? undefined : value)}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.content_type || 'all'}
            onValueChange={(value) => handleFilterChange('content_type', value === 'all' ? undefined : value)}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="interactive">Interactive</SelectItem>
              <SelectItem value="mixed">Mixed</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600">Active filters:</span>
          {filters.search && (
            <Badge variant="secondary">
              Search: {filters.search}
            </Badge>
          )}
          {filters.difficulty_level && (
            <Badge variant="secondary">
              {filters.difficulty_level}
            </Badge>
          )}
          {filters.content_type && (
            <Badge variant="secondary">
              {filters.content_type}
            </Badge>
          )}
          {filters.is_featured && (
            <Badge variant="secondary">
              Featured
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear all
          </Button>
        </div>
      )}

      {/* Sort Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Sort by:</span>
          <div className="flex gap-1">
            {[
              { key: 'title', label: 'Title' },
              { key: 'difficulty', label: 'Difficulty' },
              { key: 'duration', label: 'Duration' },
              { key: 'rating', label: 'Rating' },
              { key: 'created', label: 'Created' }
            ].map(({ key, label }) => (
              <Button
                key={key}
                variant={sortBy === key ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleSortChange(key as typeof sortBy)}
                className="text-xs"
              >
                {label}
                {sortBy === key && (
                  sortOrder === 'asc' ? 
                    <SortAsc className="h-3 w-3 ml-1" /> : 
                    <SortDesc className="h-3 w-3 ml-1" />
                )}
              </Button>
            ))}
          </div>
        </div>

        <div className="text-sm text-gray-600">
          {sortedModules.length} module{sortedModules.length !== 1 ? 's' : ''}
        </div>
      </div>

      <Separator />

      {/* Module Grid/List */}
      {sortedModules.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Filter className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No modules found</h3>
          <p className="text-gray-600 mb-4">
            {hasActiveFilters 
              ? 'Try adjusting your filters to see more results.'
              : 'No modules are available at the moment.'
            }
          </p>
          {hasActiveFilters && (
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className={
          viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
            : 'space-y-4'
        }>
          {sortedModules.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              variant={viewMode === 'list' ? 'compact' : 'default'}
              showProgress={showProgress}
              showCategory={showCategory}
              onClick={() => onModuleClick?.(module)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
