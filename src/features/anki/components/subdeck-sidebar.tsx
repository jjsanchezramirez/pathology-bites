// src/features/anki/components/subdeck-sidebar.tsx

'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { 
  ChevronRight, 
  ChevronDown, 
  Search, 
  Folder, 
  FolderOpen, 
  FileText,
  BookOpen
} from 'lucide-react'
import { AnkomaSection } from '../types/anki-card'
import { getSectionStats } from '../utils/ankoma-parser'
import { cn } from '@/shared/utils'

interface SubdeckSidebarProps {
  sections: AnkomaSection[]
  selectedSectionId: string | null
  onSectionSelect: (sectionId: string) => void
  className?: string
}

interface SectionTreeItemProps {
  section: AnkomaSection
  selectedSectionId: string | null
  onSectionSelect: (sectionId: string) => void
  level: number
  searchQuery: string
}

function SectionTreeItem({ 
  section, 
  selectedSectionId, 
  onSectionSelect, 
  level,
  searchQuery 
}: SectionTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2) // Auto-expand first 2 levels
  const stats = getSectionStats(section)
  const isSelected = selectedSectionId === section.id
  const hasCards = stats.directCards > 0
  const hasSubsections = section.subsections.length > 0
  
  // Filter subsections based on search
  const filteredSubsections = useMemo(() => {
    if (!searchQuery) return section.subsections
    
    return section.subsections.filter(subsection => 
      subsection.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getSectionStats(subsection).totalCards > 0
    )
  }, [section.subsections, searchQuery])

  // Check if this section or any subsection matches search
  const matchesSearch = !searchQuery || 
    section.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    filteredSubsections.length > 0

  if (!matchesSearch) return null

  const handleToggle = () => {
    if (hasSubsections) {
      setIsExpanded(!isExpanded)
    }
  }

  const handleSelect = () => {
    if (hasCards) {
      onSectionSelect(section.id)
    }
  }

  return (
    <div className="select-none">
      <div 
        className={cn(
          "flex items-center gap-2 py-2 px-3 rounded-md cursor-pointer transition-colors",
          "hover:bg-muted/50",
          isSelected && "bg-primary/10 border border-primary/20",
          !hasCards && "opacity-60 cursor-default",
          level > 0 && "ml-4"
        )}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
      >
        {/* Expand/Collapse Button */}
        {hasSubsections ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 hover:bg-transparent"
            onClick={handleToggle}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        ) : (
          <div className="w-4" /> // Spacer for alignment
        )}

        {/* Icon */}
        <div className="flex-shrink-0">
          {hasSubsections ? (
            isExpanded ? (
              <FolderOpen className="h-4 w-4 text-blue-600" />
            ) : (
              <Folder className="h-4 w-4 text-blue-600" />
            )
          ) : (
            <FileText className="h-4 w-4 text-green-600" />
          )}
        </div>

        {/* Section Name */}
        <div 
          className="flex-1 min-w-0 flex items-center gap-2"
          onClick={handleSelect}
        >
          <span 
            className={cn(
              "truncate text-sm",
              isSelected && "font-medium",
              hasCards && "cursor-pointer hover:text-primary"
            )}
            title={section.name}
          >
            {section.name}
          </span>
          
          {/* Card Count Badge */}
          {stats.totalCards > 0 && (
            <Badge 
              variant={isSelected ? "default" : "secondary"} 
              className="text-xs px-1.5 py-0.5 h-5"
            >
              {stats.totalCards}
            </Badge>
          )}
        </div>
      </div>

      {/* Subsections */}
      {hasSubsections && isExpanded && (
        <div className="mt-1">
          {filteredSubsections.map((subsection) => (
            <SectionTreeItem
              key={subsection.id}
              section={subsection}
              selectedSectionId={selectedSectionId}
              onSectionSelect={onSectionSelect}
              level={level + 1}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function SubdeckSidebar({ 
  sections, 
  selectedSectionId, 
  onSectionSelect, 
  className 
}: SubdeckSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandAll, setExpandAll] = useState(false)

  // Calculate total stats
  const totalStats = useMemo(() => {
    let totalCards = 0
    let totalSections = 0
    
    const countStats = (sectionList: AnkomaSection[]) => {
      for (const section of sectionList) {
        const stats = getSectionStats(section)
        totalCards += stats.totalCards
        if (stats.directCards > 0) totalSections++
        countStats(section.subsections)
      }
    }
    
    countStats(sections)
    return { totalCards, totalSections }
  }, [sections])

  const handleExpandAll = () => {
    setExpandAll(!expandAll)
    // This would need to be implemented with a context or state management
    // For now, we'll just toggle the state
  }

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5" />
          Subdecks
        </CardTitle>
        
        {/* Stats */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline" className="text-xs">
            {totalStats.totalCards.toLocaleString()} cards
          </Badge>
          <Badge variant="outline" className="text-xs">
            {totalStats.totalSections} sections
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-3 pt-0">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search subdecks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExpandAll}
            className="text-xs h-7"
          >
            {expandAll ? 'Collapse All' : 'Expand All'}
          </Button>
          
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="text-xs h-7"
            >
              Clear
            </Button>
          )}
        </div>

        {/* Section Tree */}
        <ScrollArea className="flex-1 -mx-3">
          <div className="px-3 space-y-1">
            {sections.map((section) => (
              <SectionTreeItem
                key={section.id}
                section={section}
                selectedSectionId={selectedSectionId}
                onSectionSelect={onSectionSelect}
                level={0}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
