// src/features/anki/components/double-sidebar-ankoma-viewer.tsx

'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Skeleton } from '@/shared/components/ui/skeleton'
import {
  BookOpen,
  AlertCircle,
  ChevronLeft,
  RotateCcw,
  Shuffle,
  FileText
} from 'lucide-react'
import { InteractiveAnkiViewer } from './interactive-anki-viewer'
import { DeckSidebar } from './deck-sidebar'
import { CategorySidebar } from './category-sidebar'
import { CombinedMobileSidebar } from './combined-mobile-sidebar'
import { AnkomaViewerProps, AnkiCard, AnkomaSection } from '../types/anki-card'
import { useClientAnkoma } from '@/shared/hooks/use-client-ankoma'
import { cn } from '@/shared/utils'

interface CategoryData {
  id: string
  name: string
  cards: AnkiCard[]
  subcategories: Array<{
    name: string
    cardCount: number
  }>
}

interface DeckData {
  id: string
  name: string
  type: 'AP' | 'CP'
  categories: CategoryData[]
  totalCards: number
}

export function DoubleSidebarAnkomaViewer({
  autoLoad = true,
  defaultSection,
  onSectionChange,
  onError,
  className
}: AnkomaViewerProps) {
  // Use the new client-side hook instead of manual loading
  const { ankomaData, sections, isLoading, error, totalCards } = useClientAnkoma()
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isShuffled, setIsShuffled] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Initialize sidebars based on screen size
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Pass error to parent component
  useEffect(() => {
    if (error) {
      onError?.(error)
    }
  }, [error, onError])

  // Format tag names by separating uppercase letters and symbols
  const formatTagName = (tagName: string): string => {
    if (!tagName) return tagName
    
    return tagName
      // Split on uppercase letters (add space before them)
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      // Replace & with ' & ' (with spaces)
      .replace(/&/g, ' & ')
      // Replace other symbols with spaces
      .replace(/[_-]/g, ' ')
      // Clean up multiple spaces
      .replace(/\s+/g, ' ')
      .trim()
  }

  // Organize data by decks and categories from tags
  const organizedDecks = useMemo(() => {
    if (!ankomaData) return []

    const deckMap = new Map<string, DeckData>()
    
    // Get all cards from all sections
    const getAllCards = (sections: AnkomaSection[]): AnkiCard[] => {
      const allCards: AnkiCard[] = []
      for (const section of sections) {
        allCards.push(...section.cards)
        allCards.push(...getAllCards(section.subsections))
      }
      return allCards
    }

    const allCards = getAllCards(ankomaData.sections)

    // Organize by ANKOMA tags
    for (const card of allCards) {
      const ankomaTag = card.tags.find(tag => tag.startsWith('#ANKOMA::'))
      if (!ankomaTag) continue

      const tagParts = ankomaTag.replace('#ANKOMA::', '').split('::')
      if (tagParts.length < 2) continue

      const deckType = tagParts[0] as 'AP' | 'CP'
      const categoryName = formatTagName(tagParts[1])
      const subcategoryName = tagParts[2] ? formatTagName(tagParts[2]) : null

      const deckId = deckType
      const categoryId = `${deckType}::${categoryName}`

      // Create deck if doesn't exist
      if (!deckMap.has(deckId)) {
        deckMap.set(deckId, {
          id: deckId,
          name: deckType === 'AP' ? 'Anatomic Pathology' : 'Clinical Pathology',
          type: deckType,
          categories: [],
          totalCards: 0
        })
      }

      const deck = deckMap.get(deckId)!

      // Find or create category
      let category = deck.categories.find(cat => cat.id === categoryId)
      if (!category) {
        category = {
          id: categoryId,
          name: categoryName,
          cards: [],
          subcategories: []
        }
        deck.categories.push(category)
      }

      // Add card to category
      category.cards.push(card)
      deck.totalCards++

      // Add subcategory if exists
      if (subcategoryName) {
        const existingSubcat = category.subcategories.find(s => s.name === subcategoryName)
        if (existingSubcat) {
          existingSubcat.cardCount++
        } else {
          category.subcategories.push({
            name: subcategoryName,
            cardCount: 1
          })
        }
      }
    }

    // Sort categories and subcategories alphabetically
    for (const deck of deckMap.values()) {
      deck.categories.sort((a, b) => a.name.localeCompare(b.name))
      for (const category of deck.categories) {
        category.subcategories.sort((a, b) => a.name.localeCompare(b.name))
      }
    }

    return Array.from(deckMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [ankomaData])

  // Get current cards based on selection
  const currentCards = useMemo(() => {
    if (!selectedDeckId || !selectedCategoryId) return []

    const deck = organizedDecks.find(d => d.id === selectedDeckId)
    if (!deck) return []

    const category = deck.categories.find(c => c.id === selectedCategoryId)
    if (!category) return []

    let cards = category.cards

    // Filter by subcategory if selected
    if (selectedSubcategory) {
      cards = cards.filter(card => {
        const ankomaTag = card.tags.find(tag => tag.startsWith('#ANKOMA::'))
        if (!ankomaTag) return false
        const tagParts = ankomaTag.replace('#ANKOMA::', '').split('::')
        const subcatName = tagParts[2] ? formatTagName(tagParts[2]) : null
        return subcatName === selectedSubcategory
      })
    }

    return isShuffled ? [...cards].sort(() => Math.random() - 0.5) : cards
  }, [organizedDecks, selectedDeckId, selectedCategoryId, selectedSubcategory, isShuffled, formatTagName])

  const currentCard = currentCards[currentCardIndex]

  const handleDeckSelect = (deckId: string) => {
    setSelectedDeckId(deckId)
    setSelectedCategoryId(null)
    setSelectedSubcategory(null)
    setCurrentCardIndex(0)
    setIsShuffled(false)
  }

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(categoryId)
    setSelectedSubcategory(null)
    setCurrentCardIndex(0)
    setIsShuffled(false)
  }

  const handleSubcategorySelect = (subcategory: string | null) => {
    setSelectedSubcategory(subcategory)
    setCurrentCardIndex(0)
    setIsShuffled(false)
  }

  const handleNextCard = () => {
    if (currentCardIndex < currentCards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1)
    }
  }

  const handlePreviousCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1)
    }
  }

  const handleShuffle = () => {
    setIsShuffled(!isShuffled)
    setCurrentCardIndex(0)
  }

  const handleReset = () => {
    setCurrentCardIndex(0)
    setIsShuffled(false)
  }

  if (isLoading) {
    return (
      <div className={cn("w-full h-full flex overflow-hidden", className)}>
        {/* Desktop: Combined Sidebars Skeleton - Single rectangle */}
        <Skeleton className="hidden md:block w-80 h-full shrink-0" />

        {/* Main Content Skeleton */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header Skeleton */}
          <div className="border-b border-border bg-background p-3 md:p-5 shrink-0">
            <div className="flex items-center justify-between gap-2 md:gap-4">
              {/* Left: Mobile menu + Title */}
              <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                {/* Mobile button skeleton */}
                <Skeleton className="md:hidden h-8 w-28 shrink-0" />

                {/* Desktop Title Section Skeleton */}
                <div className="min-w-0 flex-1 hidden md:block space-y-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>

              {/* Right: Controls skeleton */}
              <div className="flex items-center gap-2 shrink-0">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>
          </div>

          {/* Card Content Skeleton */}
          <div className="flex-1 overflow-y-auto p-3 md:p-6 bg-muted/20">
            <div className="w-full h-full flex items-start justify-center pt-8">
              <Card className="w-full max-w-4xl">
                <CardContent className="p-6 md:p-8 space-y-6">
                  {/* Question skeleton */}
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-5/6" />
                  </div>

                  {/* Image skeleton */}
                  <Skeleton className="w-full h-64 md:h-96 rounded-lg" />

                  {/* Answer section skeleton */}
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>

                  {/* Navigation buttons skeleton */}
                  <div className="flex items-center justify-between pt-4">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-24" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn("w-full h-full flex items-center justify-center p-2 md:p-3", className)}>
        <div className="w-full max-w-[95%] md:max-w-3xl mx-auto">
          <Card className="w-full">
            <CardContent className="flex items-center justify-center py-16">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Failed to Load Deck</h3>
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button onClick={() => window.location.reload()}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reload Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!ankomaData) {
    return (
      <div className={cn("w-full h-full flex items-center justify-center p-2 md:p-3", className)}>
        <div className="w-full max-w-[95%] md:max-w-3xl mx-auto">
          <Card className="w-full">
            <CardContent className="flex items-center justify-center py-16">
              <div className="text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
                <p className="text-muted-foreground">
                  The Ankoma Deck Viewer data could not be loaded. Please try refreshing the page.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const selectedDeck = organizedDecks.find(d => d.id === selectedDeckId)
  const selectedCategory = selectedDeck?.categories.find(c => c.id === selectedCategoryId)

  // Prepare data for sidebar components
  const deckSidebarData = organizedDecks.map(deck => ({
    id: deck.id,
    name: deck.name,
    type: deck.type,
    totalCards: deck.totalCards,
    categoryCount: deck.categories.length
  }))

  const categorySidebarData = selectedDeck?.categories.map(cat => ({
    id: cat.id,
    name: cat.name,
    cardCount: cat.cards.length,
    subcategories: cat.subcategories
  })) || []

  return (
    <div className={cn("h-full flex overflow-hidden", className)}>
      {/* Mobile: Combined Sidebar */}
      {isMobile && (
        <CombinedMobileSidebar
          decks={deckSidebarData}
          categories={categorySidebarData}
          selectedDeckId={selectedDeckId}
          selectedCategoryId={selectedCategoryId}
          selectedSubcategory={selectedSubcategory}
          onDeckSelect={handleDeckSelect}
          onCategorySelect={handleCategorySelect}
          onSubcategorySelect={handleSubcategorySelect}
          deckName={selectedDeck?.name}
          isOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Desktop: Deck Sidebar */}
      {!isMobile && (
        <DeckSidebar
          decks={deckSidebarData}
          selectedDeckId={selectedDeckId}
          onDeckSelect={handleDeckSelect}
        />
      )}

      {/* Desktop: Category Sidebar */}
      {!isMobile && (
        <CategorySidebar
          categories={categorySidebarData}
          selectedCategoryId={selectedCategoryId}
          selectedSubcategory={selectedSubcategory}
          onCategorySelect={handleCategorySelect}
          onSubcategorySelect={handleSubcategorySelect}
          deckName={selectedDeck?.name}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="shrink-0 border-b border-border bg-background p-3 md:p-5">
          <div className="flex items-center justify-between gap-2 md:gap-4">
            {/* Left: Mobile menu + Title */}
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
              {/* Mobile: Combined sidebar button */}
              <Button
                variant="default"
                size="sm"
                onClick={() => setMobileSidebarOpen(true)}
                className="md:hidden shrink-0"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Select Deck
              </Button>

              {/* Desktop Title Section */}
              <div className="min-w-0 flex-1 hidden md:block">
                <div className="text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground mb-1">
                  {selectedCategory ? (
                    <>
                      {selectedCategory.name}
                      {selectedSubcategory && ` → ${selectedSubcategory}`}
                    </>
                  ) : (
                    'ANKOMA VIEWER'
                  )}
                </div>
                <div className="text-[13px] md:text-[14px] font-medium text-foreground truncate">
                  {selectedDeck?.name || 'Select a deck to begin'}
                </div>
              </div>
            </div>

            {/* Right: Card info and controls */}
            <div className="flex items-center gap-2 md:gap-3 shrink-0">
              {/* Card Navigation Info - Desktop only */}
              {currentCards.length > 0 && (
                <div className="hidden md:flex items-center gap-2 text-xs md:text-sm">
                  <span className="font-medium whitespace-nowrap">
                    {currentCardIndex + 1}/{currentCards.length}
                  </span>
                  {isShuffled && (
                    <Badge variant="secondary" className="text-xs hidden lg:inline-flex">
                      Shuffled
                    </Badge>
                  )}
                </div>
              )}

              {/* Controls */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShuffle}
                  disabled={currentCards.length <= 1}
                  title="Shuffle cards"
                  className="h-8 w-8 p-0"
                >
                  <Shuffle className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={currentCards.length === 0}
                  title="Reset to first card"
                  className="h-8 w-8 p-0"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousCard}
                  disabled={currentCardIndex === 0}
                  title="Previous card"
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Card Content Area - Scrollable */}
        <div className="flex-1 overflow-auto">
          <div className="flex justify-center p-2 md:p-3">
            <div className="w-full max-w-2xl">
          {currentCard ? (
            <InteractiveAnkiViewer
              card={currentCard}
              onNext={currentCardIndex < currentCards.length - 1 ? handleNextCard : undefined}
              onPrevious={currentCardIndex > 0 ? handlePreviousCard : undefined}
              currentCardIndex={currentCardIndex}
              totalCards={currentCards.length}
              categoryName={selectedCategory?.name}
              subcategoryName={selectedSubcategory}
            />
          ) : selectedCategory ? (
            <Card className="w-full">
              <CardContent className="flex items-center justify-center py-16">
                <div className="text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Cards Available</h3>
                  <p className="text-muted-foreground">
                    {selectedSubcategory
                      ? `No cards found in "${selectedSubcategory}" subcategory.`
                      : "This category doesn't contain any cards to study."
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="w-full">
              <CardContent className="flex items-center justify-center py-16">
                <div className="text-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Select a Category</h3>
                  <p className="text-muted-foreground">
                    Choose a deck and category from the sidebars to start studying.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}