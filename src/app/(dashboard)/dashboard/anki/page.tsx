// src/app/(dashboard)/dashboard/anki/page.tsx
'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { cn } from '@/shared/utils'
import { useClientAnkoma } from '@/shared/hooks/use-client-ankoma'
import { BookOpen, Layers, ChevronRight, Shuffle, RotateCcw, ChevronLeft, FileText, Info, ExternalLink } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent } from '@/shared/components/ui/card'
import { InteractiveAnkiViewer } from '@/features/anki/components/interactive-anki-viewer'
import { AnkiCard, AnkomaSection } from '@/features/anki/types/anki-card'

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

export default function AnkiPage() {
  const { ankomaData, isLoading, _error } = useClientAnkoma()
  const [leftSidebarExpanded, setLeftSidebarExpanded] = useState(true) // Start expanded
  const [rightSidebarExpanded, setRightSidebarExpanded] = useState(false) // Start collapsed
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isShuffled, setIsShuffled] = useState(false)
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)

  // Detect mobile device once (useMemo ensures stable value)
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  }, [])

  // Cards to ignore by ID (excluded from all views)
  const IGNORED_CARD_IDS = useMemo(() => new Set(['e;+G?PkVD5']), [])

  // Normalization constants (memoized to prevent recreation)
  const NAME_NORMALIZATIONS = useMemo(() => ({
    'Smooth Muscle': 'Muscle',
    'Skeletal Muscle': 'Muscle',
    'Myfibroblastic': 'Myofibroblastic',
    'Parathyroid Adenoma': 'Parathyroid',
    'Natural Deaths AP': 'Natural Deaths',
    'Ewing': 'Ewing Sarcoma',
    'Gaucher': 'Gaucher Disease',
    '7.1 7.2': 'Molecular Biology & Techniques',
    '7.3': 'Non-Neoplastic Molecular Pathology',
    '7.4': 'Neoplastic Molecular Pathology',
    'CLIA88': 'CLIA 88',
    'Professional Component Billing': 'Billing',
    'Laboratory Test Panels': 'Billing',
    'Billing Regulations': 'Billing',
    'Quality Assurance': 'Quality Control',
    'Quality Management': 'Quality Control',
    'Quality Improvement': 'Quality Control',
    'Statistical Quality Control': 'Quality Control',
    'Medicare & Medicaid': 'Medicare & Medicaid',
    'B Cells': 'B Cells',
    'T Cells': 'T Cells',
    'NK cells': 'NK Cells',
    'HLA Testing': 'HLA Testing',
    'A PCs': 'Antigen Processing Cells',
    'Quick Compendium': 'General Principles',
    'Pre analytical': 'General Principles',
    'Miscellaneous': 'General Principles',
    'proteins': 'Protein Analysis',
    'Special Circumstances': 'General Principles',
    'Extras': 'General Principles',
    'Passenger Lymphocyte Syndrome': 'General Principles',
    'misc': 'General Principles',
    'Methods': 'General Principles',
    'Peripheral blood smears': 'Peripheral Blood Smears',
  }), [])

  const PARENT_SPECIFIC_NORMALIZATIONS = useMemo(() => ({
    'Chemistry::proteins': 'Protein Analysis',
    'Chemistry::Quick Compendium': 'General Principles',
    'Chemistry::Pre analytical': 'General Principles',
    'Chemistry::Miscellaneous': 'General Principles',
    'TransfusionMedicine::Quick Compendium': 'General Principles',
    'TransfusionMedicine::Special Circumstances': 'General Principles',
    'TransfusionMedicine::Extras': 'General Principles',
    'TransfusionMedicine::Passenger Lymphocyte Syndrome': 'General Principles',
    'Hemepath-Benign::misc': 'General Principles',
    'Hemepath-Benign::Methods': 'General Principles',
  }), [])

  const MICROBIOLOGY_VALID_SUBCATEGORIES = useMemo(() => [
    'Bacteriology', 'Mycology', 'Parasitology', 'Virology', 'General Principles'
  ], [])

  const CATEGORY_MERGES = useMemo(() => ({
    'Benign Heme': 'Hemepath Benign',
    'Hemepath': 'Hemepath Neoplastic',
    'Pulmonary': 'Thoracic',
  }), [])

  // Format tag names with normalization
  const formatTagName = useCallback((tagName: string, parentCategory?: string): string => {
    if (!tagName) return tagName

    let formatted = tagName
      .replace(/([a-z])(and)([A-Z])/g, '$1 $2 $3')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
      .replace(/&/g, ' & ')
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (formatted.startsWith('#')) {
      formatted = formatted.substring(1).trim()
    }

    if (parentCategory) {
      const parentKey = `${parentCategory}::${formatted}`
      if (PARENT_SPECIFIC_NORMALIZATIONS[parentKey]) {
        return PARENT_SPECIFIC_NORMALIZATIONS[parentKey]
      }
    }

    if (NAME_NORMALIZATIONS[formatted]) {
      formatted = NAME_NORMALIZATIONS[formatted]
    }

    if (CATEGORY_MERGES[formatted]) {
      formatted = CATEGORY_MERGES[formatted]
    }

    if (parentCategory === 'Microbiology' && !MICROBIOLOGY_VALID_SUBCATEGORIES.includes(formatted)) {
      formatted = 'General Principles'
    }

    formatted = formatted.replace(/\band\b/gi, '&')

    if (formatted.length > 0) {
      formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1)
    }

    return formatted
  }, [NAME_NORMALIZATIONS, PARENT_SPECIFIC_NORMALIZATIONS, CATEGORY_MERGES, MICROBIOLOGY_VALID_SUBCATEGORIES])

  // Handle direct cardId navigation from URL
  useEffect(() => {
    if (!ankomaData || !window) return

    const urlParams = new URLSearchParams(window.location.search)
    const cardId = urlParams.get('cardId')

    if (cardId) {
      // Find the card with this GUID (could be full card.id like "guid-ord" or just "guid")
      const getAllCards = (sections: AnkomaSection[]): AnkiCard[] => {
        const allCards: AnkiCard[] = []
        for (const section of sections) {
          allCards.push(...section.cards)
          allCards.push(...getAllCards(section.subsections))
        }
        return allCards
      }

      const allCards = getAllCards(ankomaData.sections)

      // Try to find by exact card.id match first, then by GUID prefix
      let targetCard = allCards.find(card => card.id === cardId)
      if (!targetCard) {
        // If not found, try matching just the GUID part (before the "-ord" suffix)
        targetCard = allCards.find(card => card.id.startsWith(cardId + '-') || card.id === cardId)
      }

      if (targetCard) {
        // Extract deck and category from the card's tags
        const ankomaTag = targetCard.tags.find(tag => tag.startsWith('#ANKOMA::'))
        if (ankomaTag) {
          const tagParts = ankomaTag.replace('#ANKOMA::', '').split('::')
          if (tagParts.length >= 2) {
            const deckType = tagParts[0] as 'AP' | 'CP'
            const rawCategoryName = tagParts[1]
            const categoryName = formatTagName(rawCategoryName)
            const subcategoryName = tagParts[2] ? formatTagName(tagParts[2], rawCategoryName) : null

            const deckId = deckType
            const categoryId = `${deckType}::${categoryName}`

            // Set the deck and category
            setSelectedDeckId(deckId)
            setSelectedCategoryId(categoryId)
            if (subcategoryName) {
              setSelectedSubcategory(subcategoryName)
              setExpandedCategoryId(categoryId)
            }

            // Expand the right sidebar
            setLeftSidebarExpanded(false)
            setRightSidebarExpanded(true)
          }
        }
      }
    }
  }, [ankomaData, formatTagName])

  // Organize data by decks and categories
  const organizedDecks = useMemo(() => {
    if (!ankomaData) return []

    const deckMap = new Map<string, DeckData>()

    const getAllCards = (sections: AnkomaSection[]): AnkiCard[] => {
      const allCards: AnkiCard[] = []
      for (const section of sections) {
        allCards.push(...section.cards)
        allCards.push(...getAllCards(section.subsections))
      }
      return allCards
    }

    const allCards = getAllCards(ankomaData.sections)

    for (const card of allCards) {
      // Skip ignored cards
      if (IGNORED_CARD_IDS.has(card.id)) continue

      const ankomaTag = card.tags.find(tag => tag.startsWith('#ANKOMA::'))
      if (!ankomaTag) continue

      const tagParts = ankomaTag.replace('#ANKOMA::', '').split('::')
      if (tagParts.length < 2) continue

      const deckType = tagParts[0] as 'AP' | 'CP'
      const rawCategoryName = tagParts[1]
      const categoryName = formatTagName(rawCategoryName)
      // Pass the raw category name for parent-specific normalization
      const subcategoryName = tagParts[2] ? formatTagName(tagParts[2], rawCategoryName) : null

      const deckId = deckType
      const categoryId = `${deckType}::${categoryName}`

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
      let category = deck.categories.find(c => c.id === categoryId)

      if (!category) {
        category = {
          id: categoryId,
          name: categoryName,
          cards: [],
          subcategories: []
        }
        deck.categories.push(category)
      }

      category.cards.push(card)
      deck.totalCards++

      if (subcategoryName) {
        const existingSubcat = category.subcategories.find(s => s.name === subcategoryName)
        if (existingSubcat) {
          existingSubcat.cardCount++
        } else {
          category.subcategories.push({ name: subcategoryName, cardCount: 1 })
        }
      }
    }

    return Array.from(deckMap.values())
  }, [ankomaData, IGNORED_CARD_IDS, formatTagName])

  const selectedDeck = organizedDecks.find(d => d.id === selectedDeckId)
  const selectedCategory = selectedDeck?.categories.find(c => c.id === selectedCategoryId)

  const currentCards = useMemo(() => {
    if (!selectedCategory) return []

    if (selectedSubcategory) {
      const subcatCards = selectedCategory.cards.filter(card => {
        const ankomaTag = card.tags.find(tag => tag.startsWith('#ANKOMA::'))
        if (!ankomaTag) return false
        const tagParts = ankomaTag.replace('#ANKOMA::', '').split('::')
        const rawCategoryName = tagParts[1]
        const subcatName = tagParts[2] ? formatTagName(tagParts[2], rawCategoryName) : null
        return subcatName === selectedSubcategory
      })
      return isShuffled ? [...subcatCards].sort(() => Math.random() - 0.5) : subcatCards
    }

    return isShuffled ? [...selectedCategory.cards].sort(() => Math.random() - 0.5) : selectedCategory.cards
  }, [selectedCategory, selectedSubcategory, isShuffled, formatTagName])

  const currentCard = currentCards[currentCardIndex]

  // Set card index when navigating via URL with cardId
  useEffect(() => {
    if (!window || currentCards.length === 0) return

    const urlParams = new URLSearchParams(window.location.search)
    const cardId = urlParams.get('cardId')

    if (cardId) {
      // Find the index of the card with this GUID in currentCards
      let targetIndex = currentCards.findIndex(card => card.id === cardId)
      if (targetIndex === -1) {
        // Try matching just the GUID part
        targetIndex = currentCards.findIndex(card => card.id.startsWith(cardId + '-') || card.id === cardId)
      }

      if (targetIndex !== -1) {
        setCurrentCardIndex(targetIndex)
      }
    }
  }, [currentCards])

  const handleDeckSelect = (deckId: string) => {
    setSelectedDeckId(deckId)
    setSelectedCategoryId(null)
    setSelectedSubcategory(null)
    setCurrentCardIndex(0)
    setIsShuffled(false)
    // When deck is selected, collapse DECKS and expand CATEGORIES
    setIsAnimating(true)
    setLeftSidebarExpanded(false)
    setRightSidebarExpanded(true)
    // Clear animation flag after transition
    setTimeout(() => setIsAnimating(false), 300)
  }

  const handleCategoryClick = (categoryId: string, hasSubcategories: boolean) => {
    setSelectedCategoryId(categoryId)
    setSelectedSubcategory(null)
    setCurrentCardIndex(0)
    if (hasSubcategories) {
      setExpandedCategoryId(prev => prev === categoryId ? null : categoryId)
    } else {
      setExpandedCategoryId(null)
    }
  }

  const handleSubcategoryClick = (subcategory: string) => {
    setSelectedSubcategory(subcategory)
    setCurrentCardIndex(0)
  }

  const handleNextCard = () => {
    if (currentCardIndex < currentCards.length - 1) {
      setCurrentCardIndex(prev => prev + 1)
    }
  }

  const handlePreviousCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(prev => prev - 1)
    }
  }

  const handleShuffle = () => {
    setIsShuffled(!isShuffled)
    setCurrentCardIndex(0)
  }

  const handleReset = () => {
    setIsShuffled(false)
    setCurrentCardIndex(0)
  }

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
    subcategories: [...cat.subcategories].sort((a, b) => a.name.localeCompare(b.name))
  })).sort((a, b) => a.name.localeCompare(b.name)) || []

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left Sidebar - DECKS */}
      <aside
        className="h-full shrink-0 bg-secondary border-r border-border overflow-hidden"
        style={{
          width: leftSidebarExpanded ? '240px' : '64px',
          transition: 'width 300ms ease-in-out'
        }}
        onMouseEnter={() => !isAnimating && setLeftSidebarExpanded(true)}
        onMouseLeave={() => !isAnimating && setLeftSidebarExpanded(false)}
      >
        {leftSidebarExpanded ? (
          <div className="h-full w-full flex flex-col min-w-[240px]">
            <div className="p-5 border-b border-border shrink-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground mb-1">
                DECKS
              </div>
              <div className="text-[13px] text-muted-foreground">
                Select a deck
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {deckSidebarData.length > 0 ? (
                <div className="space-y-1">
                  {deckSidebarData.map((deck) => {
                    const isActive = selectedDeckId === deck.id
                    return (
                      <button
                        key={deck.id}
                        onClick={() => handleDeckSelect(deck.id)}
                        className={cn(
                          "w-full px-3 py-2.5 rounded-lg transition-all duration-200 ease-in-out flex flex-col text-left cursor-pointer gap-1",
                          isActive ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "flex-1 text-[14px] font-medium truncate",
                            isActive ? "text-primary-foreground" : "text-foreground"
                          )}>
                            {deck.name}
                          </span>
                          <span className={cn(
                            "text-[13px] shrink-0 ml-2 font-mono",
                            isActive ? "text-primary-foreground/90" : "text-muted-foreground"
                          )}>
                            {deck.totalCards}
                          </span>
                        </div>
                        <div className={cn(
                          "text-[12px]",
                          isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                        )}>
                          {deck.categoryCount} categories
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground text-center">
                    {isLoading ? 'Loading...' : 'No decks available'}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full w-full flex flex-col items-center pt-5 px-2 gap-6">
            <BookOpen className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex flex-col items-center gap-4">
              <div className="writing-mode-vertical-rl rotate-180 text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground">
                DECKS
              </div>
              <div className="writing-mode-vertical-rl rotate-180 text-[13px] text-muted-foreground">
                Select a deck
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Right Sidebar - CATEGORIES */}
      <aside
        className="h-full shrink-0 bg-card border-r border-border overflow-hidden"
        style={{
          width: rightSidebarExpanded ? '300px' : '64px',
          transition: 'width 300ms ease-in-out'
        }}
        onMouseEnter={() => !isAnimating && setRightSidebarExpanded(true)}
        onMouseLeave={() => !isAnimating && setRightSidebarExpanded(false)}
      >
        {rightSidebarExpanded ? (
          <div className="h-full w-full flex flex-col min-w-[300px]">
            <div className="p-5 border-b border-border shrink-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground mb-1">
                CATEGORIES
              </div>
              <div className="text-[13px] text-muted-foreground">
                {selectedDeck?.name || 'Select a deck'}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {categorySidebarData.length > 0 ? (
                <div className="space-y-1">
                  {categorySidebarData.map((category) => {
                    const isCategoryExpanded = expandedCategoryId === category.id
                    const hasSubcategories = category.subcategories.length > 0

                    return (
                      <div key={category.id}>
                        <button
                          onClick={() => handleCategoryClick(category.id, hasSubcategories)}
                          className={cn(
                            "w-full px-3 py-2.5 rounded-lg transition-all duration-200 ease-in-out flex items-center text-left cursor-pointer gap-2 hover:bg-muted"
                          )}
                        >
                          {hasSubcategories && (
                            <ChevronRight
                              className={cn(
                                "w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ease-in-out",
                                isCategoryExpanded && "rotate-90"
                              )}
                            />
                          )}
                          {!hasSubcategories && <div className="w-4" />}
                          <span className="flex-1 text-[14px] font-medium text-foreground truncate">
                            {category.name}
                          </span>
                          <span className="text-[13px] text-muted-foreground shrink-0 font-mono">
                            {category.cardCount}
                          </span>
                        </button>

                        {hasSubcategories && isCategoryExpanded && (
                          <div className="ml-6 mt-1 space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                            {category.subcategories.map((subcategory) => {
                              const isSubActive = selectedSubcategory === subcategory.name
                              return (
                                <button
                                  key={subcategory.name}
                                  onClick={() => handleSubcategoryClick(subcategory.name)}
                                  className={cn(
                                    "w-full py-2 px-3 rounded-lg transition-all duration-200 ease-in-out flex items-center justify-between cursor-pointer text-left",
                                    isSubActive ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted"
                                  )}
                                >
                                  <span className={cn(
                                    "flex-1 text-[13px] truncate",
                                    isSubActive ? "text-primary-foreground font-medium" : "text-foreground"
                                  )}>
                                    {subcategory.name}
                                  </span>
                                  <span className={cn(
                                    "text-[12px] shrink-0 ml-2 font-mono",
                                    isSubActive ? "text-primary-foreground/90" : "text-muted-foreground"
                                  )}>
                                    {subcategory.cardCount}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground text-center">
                    Select a deck to view categories
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full w-full flex flex-col items-center pt-5 px-2 gap-6">
            <Layers className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex flex-col items-center gap-4">
              <div className="writing-mode-vertical-rl rotate-180 text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground">
                CATEGORIES
              </div>
              <div className="writing-mode-vertical-rl rotate-180 text-[13px] text-muted-foreground">
                {selectedDeck?.name || 'Select a deck'}
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="anki-main flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="anki-header shrink-0 border-b border-border bg-background p-3 md:p-5">
          <div className="flex items-center justify-between gap-2 md:gap-4">
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
              <div className="min-w-0 flex-1">
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

            <div className="flex items-center gap-2 md:gap-3 shrink-0">
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
            <div className="w-full max-w-2xl space-y-3">
              {currentCard ? (
                <>
                  <InteractiveAnkiViewer
                    card={currentCard}
                    onNext={currentCardIndex < currentCards.length - 1 ? handleNextCard : undefined}
                    onPrevious={currentCardIndex > 0 ? handlePreviousCard : undefined}
                    currentCardIndex={currentCardIndex}
                    totalCards={currentCards.length}
                    categoryName={selectedCategory?.name}
                    subcategoryName={selectedSubcategory}
                  />

                  {/* Anki Sync Warning */}
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <div className="flex items-start gap-2 text-xs sm:text-sm text-amber-800 dark:text-amber-200">
                      <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <p>
                        This is a read-only viewer for educational review. For spaced repetition and progress tracking, use the{' '}
                        <a
                          href={isMobile
                            ? /iPad|iPhone|iPod/.test(navigator.userAgent)
                              ? "https://apps.apple.com/us/app/ankimobile-flashcards/id373493387"
                              : "https://play.google.com/store/apps/details?id=com.ichi2.anki"
                            : "https://apps.ankiweb.net/"
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-900 dark:text-amber-100 hover:underline font-medium inline-flex items-center gap-1"
                        >
                          official Anki app
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        .
                      </p>
                    </div>
                  </div>
                </>
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
