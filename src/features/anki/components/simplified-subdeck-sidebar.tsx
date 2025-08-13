// src/features/anki/components/simplified-subdeck-sidebar.tsx

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

interface SimplifiedSubdeckSidebarProps {
  sections: AnkomaSection[]
  selectedSectionId: string | null
  onSectionSelect: (sectionId: string) => void
  className?: string
}

interface SimplifiedSectionItemProps {
  section: AnkomaSection
  selectedSectionId: string | null
  onSectionSelect: (sectionId: string) => void
  searchQuery: string
  isExpanded: boolean
  onToggleExpand: () => void
}

// Major categories to show in order
const MAJOR_CATEGORIES = [
  'Surg Path Basic Principles',
  'Breast', 
  'Cytology',
  'Endocrine',
  'Gastrointestinal',
  'Genitourinary', 
  'Gynecology',
  'Head and Neck',
  'Hepatobiliary',
  'Pancreas',
  'Pediatrics',
  'Skin',
  'Thoracic',
  'Clinical Chemistry',
  'Coagulation', 
  'Hematopathology',
  'Medical Microbiology',
  'Transfusion Medicine'
]

function SimplifiedSectionItem({ 
  section, 
  selectedSectionId, 
  onSectionSelect, 
  searchQuery,
  isExpanded,
  onToggleExpand
}: SimplifiedSectionItemProps) {
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

  // Check if this section matches search
  const matchesSearch = !searchQuery || 
    section.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    filteredSubsections.length > 0

  if (!matchesSearch) return null

  const handleSelect = () => {
    if (hasCards) {
      onSectionSelect(section.id)
    } else if (hasSubsections && filteredSubsections.length > 0) {
      // If no direct cards, select first subsection with cards
      const firstSubsectionWithCards = filteredSubsections.find(sub => getSectionStats(sub).totalCards > 0)
      if (firstSubsectionWithCards) {
        onSectionSelect(firstSubsectionWithCards.id)
      }
    }
  }

  return (
    <div className="select-none">
      <div 
        className={cn(
          "flex items-center gap-2 py-3 px-3 rounded-md cursor-pointer transition-colors",
          "hover:bg-muted/50",
          isSelected && "bg-primary/10 border border-primary/20"
        )}
      >
        {/* Expand/Collapse Button */}
        {hasSubsections && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 hover:bg-transparent"
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand()
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        )}

        {/* Icon */}
        <div className="flex-shrink-0">
          {hasSubsections ? (
            isExpanded ? (
              <FolderOpen className="h-5 w-5 text-blue-600" />
            ) : (
              <Folder className="h-5 w-5 text-blue-600" />
            )
          ) : (
            <FileText className="h-5 w-5 text-green-600" />
          )}
        </div>

        {/* Section Name and Stats */}
        <div 
          className="flex-1 min-w-0 flex items-center justify-between gap-2"
          onClick={handleSelect}
        >
          <span 
            className={cn(
              "truncate font-medium",
              isSelected && "text-primary",
              "cursor-pointer hover:text-primary"
            )}
            title={section.name}
          >
            {section.name}
          </span>
          
          {/* Card Count Badge */}
          {stats.totalCards > 0 && (
            <Badge 
              variant={isSelected ? "default" : "secondary"} 
              className="text-xs px-2 py-1"
            >
              {stats.totalCards.toLocaleString()}
            </Badge>
          )}
        </div>
      </div>

      {/* Subsections */}
      {hasSubsections && isExpanded && (
        <div className="ml-6 mt-1 space-y-1">
          {filteredSubsections.map((subsection) => {
            const subStats = getSectionStats(subsection)
            const isSubSelected = selectedSectionId === subsection.id
            
            if (subStats.totalCards === 0) return null
            
            return (
              <div
                key={subsection.id}
                className={cn(
                  "flex items-center gap-2 py-2 px-3 rounded-md cursor-pointer transition-colors",
                  "hover:bg-muted/30",
                  isSubSelected && "bg-primary/5 border-l-2 border-primary"
                )}
                onClick={() => onSectionSelect(subsection.id)}
              >
                <FileText className="h-4 w-4 text-gray-500" />
                <span 
                  className={cn(
                    "flex-1 truncate text-sm",
                    isSubSelected && "font-medium text-primary"
                  )}
                  title={subsection.name}
                >
                  {subsection.name}
                </span>
                <Badge 
                  variant={isSubSelected ? "default" : "outline"} 
                  className="text-xs px-1.5 py-0.5"
                >
                  {subStats.totalCards}
                </Badge>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function SimplifiedSubdeckSidebar({ 
  sections, 
  selectedSectionId, 
  onSectionSelect, 
  className 
}: SimplifiedSubdeckSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Organize sections by major categories, excluding Introduction
  const organizedSections = useMemo(() => {
    const sectionMap = new Map<string, AnkomaSection>()
    
    // Build a map of all sections for easy lookup
    const buildSectionMap = (sectionList: AnkomaSection[]) => {
      for (const section of sectionList) {
        sectionMap.set(section.name.toLowerCase(), section)
        buildSectionMap(section.subsections)
      }
    }
    
    buildSectionMap(sections)
    
    // Map major categories to their sections
    const organized: AnkomaSection[] = []
    
    for (const categoryName of MAJOR_CATEGORIES) {
      const section = sectionMap.get(categoryName.toLowerCase()) || 
                     sectionMap.get(categoryName.replace('surg path ', '').toLowerCase()) ||
                     sectionMap.get(categoryName.replace(' path', '').toLowerCase())
      
      if (section && getSectionStats(section).totalCards > 0) {
        organized.push(section)
      }
    }
    
    return organized
  }, [sections])

  // Calculate total stats
  const totalStats = useMemo(() => {
    let totalCards = 0
    let totalSections = 0
    
    for (const section of organizedSections) {
      const stats = getSectionStats(section)
      totalCards += stats.totalCards
      if (stats.directCards > 0 || stats.totalCards > 0) totalSections++
    }
    
    return { totalCards, totalSections }
  }, [organizedSections])

  const handleToggleExpand = (sectionName: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(sectionName)) {
      newExpanded.delete(sectionName)
    } else {
      newExpanded.add(sectionName)
    }
    setExpandedCategories(newExpanded)
  }

  return (
    <Card className={cn("h-full flex flex-col min-h-0", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5" />
          Pathology Sections
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

      <CardContent className="flex-1 flex flex-col gap-3 pt-0 min-h-0">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sections..."
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
            onClick={() => {
              if (expandedCategories.size > 0) {
                setExpandedCategories(new Set())
              } else {
                setExpandedCategories(new Set(organizedSections.map(s => s.name)))
              }
            }}
            className="text-xs h-7"
          >
            {expandedCategories.size > 0 ? 'Collapse All' : 'Expand All'}
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

        {/* Section List */}
        <ScrollArea className="flex-1 -mx-3 min-h-0">
          <div className="px-3 space-y-1">
            {organizedSections.map((section) => (
              <SimplifiedSectionItem
                key={section.id}
                section={section}
                selectedSectionId={selectedSectionId}
                onSectionSelect={onSectionSelect}
                searchQuery={searchQuery}
                isExpanded={expandedCategories.has(section.name)}
                onToggleExpand={() => handleToggleExpand(section.name)}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}