// src/features/anki/components/double-sidebar-ankoma-viewer.tsx

'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { Separator } from '@/shared/components/ui/separator'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import {
  BookOpen,
  Loader2,
  AlertCircle,
  Search,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  Play,
  Shuffle,
  Folder,
  FolderOpen,
  FileText,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react'
import { InteractiveAnkiViewer } from '../../debug/components/interactive-anki-viewer'
import { AnkomaData, AnkomaSection, AnkomaViewerProps, AnkiCard } from '../types/anki-card'
import {
  findSectionById,
  getAllCardsFromSection,
  getSectionStats
} from '../utils/ankoma-parser'
import { useClientAnkoma } from '@/shared/hooks/use-client-ankoma'
import { cn } from '@/shared/utils'
import { toast } from 'sonner'

// Funny loading messages for Anki deck loading (Debug Interface)
const DEBUG_ANKI_LOADING_MESSAGES = [
  "Debugging the digital flashcard matrix...",
  "Teaching the debug console what 'spaced repetition' means...",
  "Parsing JSON like a pathologist reads slides (but faster)...",
  "Loading cards from the R2 cloud dimension...",
  "Convincing Anki cards to reveal their debug secrets...",
  "Calibrating the memory palace algorithms...",
  "Converting study anxiety into debug data...",
  "Assembling the army of forgotten medical facts...",
  "Teaching AI the difference between 'easy' and 'impossible'...",
  "Channeling the spirit of Hermann Ebbinghaus (debug edition)...",
  "Importing wisdom from the depths of ankoma.json...",
  "Transforming procrastination into productive debugging...",
  "Loading cards that will haunt your debug dreams...",
  "Preparing your daily dose of educational debugging torture...",
  "Organizing knowledge into bite-sized debug chunks...",
  "Converting medical terminology into debug-friendly format...",
  "Assembling your personalized debug knowledge database...",
  "Preparing cards that make medical school debugging look easy...",
  "Shuffling through thousands of digital debug flashcards...",
  "Loading from R2 storage with aggressive debug caching..."
]

interface CategoryData {
  id: string
  name: string
  cards: AnkiCard[]
  subcategories: string[]
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
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false)
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false)

  // Loading message cycling state
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState('')
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null)

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
      if (subcategoryName && !category.subcategories.includes(subcategoryName)) {
        category.subcategories.push(subcategoryName)
      }
    }

    // Sort categories alphabetically
    for (const deck of deckMap.values()) {
      deck.categories.sort((a, b) => a.name.localeCompare(b.name))
      for (const category of deck.categories) {
        category.subcategories.sort()
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
        return formatTagName(tagParts[2] || '') === selectedSubcategory
      })
    }

    return isShuffled ? [...cards].sort(() => Math.random() - 0.5) : cards
  }, [organizedDecks, selectedDeckId, selectedCategoryId, selectedSubcategory, isShuffled, formatTagName])

  const currentCard = currentCards[currentCardIndex]

  // Cycle through loading messages while loading
  useEffect(() => {
    if (isLoading) {
      // Set initial message
      const initialIndex = Math.floor(Math.random() * DEBUG_ANKI_LOADING_MESSAGES.length)
      setLoadingMessageIndex(initialIndex)
      setCurrentLoadingMessage(DEBUG_ANKI_LOADING_MESSAGES[initialIndex])

      // Cycle through messages every 3 seconds
      loadingIntervalRef.current = setInterval(() => {
        setLoadingMessageIndex(prev => {
          const nextIndex = (prev + 1) % DEBUG_ANKI_LOADING_MESSAGES.length
          setCurrentLoadingMessage(DEBUG_ANKI_LOADING_MESSAGES[nextIndex])
          return nextIndex
        })
      }, 3000)
    } else {
      // Clear interval when not loading
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current)
        loadingIntervalRef.current = null
      }
    }

    // Cleanup on unmount
    return () => {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current)
        loadingIntervalRef.current = null
      }
    }
  }, [isLoading])

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

  const handleToggleBothSidebars = () => {
    const bothCollapsed = leftSidebarCollapsed && rightSidebarCollapsed
    setLeftSidebarCollapsed(!bothCollapsed)
    setRightSidebarCollapsed(!bothCollapsed)
  }

  if (isLoading) {
    return (
      <div className={cn("w-full h-full flex items-center justify-center", className)}>
        <Card className="animate-pulse max-w-md mx-4">
          <CardContent className="flex items-center justify-center py-16">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-foreground">Loading Debug Anki Viewer</h3>
                <p className="text-sm text-muted-foreground">
                  Parsing {totalCards?.toLocaleString() || 'thousands of'} cards from ankoma.json...
                </p>
              </div>

              {/* Funny loading message */}
              <div className="bg-muted/50 rounded-lg p-4 border">
                <p className="text-sm text-primary font-medium italic leading-relaxed min-h-[2.5rem] flex items-center justify-center transition-opacity duration-500">
                  {currentLoadingMessage || "Debugging the digital flashcard matrix..."}
                </p>
              </div>

              {/* Loading progress hint */}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span>Debug Mode • R2 Storage</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn("w-full max-w-4xl mx-auto", className)}>
        <Card>
          <CardContent className="flex items-center justify-center h-64">
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
    )
  }

  if (!ankomaData) {
    return (
      <div className={cn("w-full max-w-4xl mx-auto", className)}>
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
              <p className="text-muted-foreground">
                The Ankoma deck data could not be loaded. Please try refreshing the page.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const selectedDeck = organizedDecks.find(d => d.id === selectedDeckId)
  const selectedCategory = selectedDeck?.categories.find(c => c.id === selectedCategoryId)

  return (
    <div className={cn("w-full h-full min-h-0 flex", className)}>
      {/* Left Sidebar - Decks */}
      <div className={cn(
        "border-r bg-background transition-all duration-300",
        leftSidebarCollapsed ? "w-0" : "w-60"
      )}>
        {!leftSidebarCollapsed && (
        <Card className="h-full border-0 rounded-none flex flex-col min-h-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5" />
              Decks
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="space-y-2">
                {organizedDecks.map((deck) => (
                  <div
                    key={deck.id}
                    className={cn(
                      "p-3 rounded-md cursor-pointer transition-colors",
                      "hover:bg-muted/50",
                      selectedDeckId === deck.id && "bg-primary/10 border border-primary/20"
                    )}
                    onClick={() => handleDeckSelect(deck.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "font-medium",
                        selectedDeckId === deck.id && "text-primary"
                      )}>
                        {deck.name}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {deck.totalCards}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {deck.categories.length} categories
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        )}
      </div>

      {/* Middle Sidebar - Categories */}
      <div className={cn(
        "border-r bg-background transition-all duration-300",
        rightSidebarCollapsed ? "w-0" : "w-80"
      )}>
        {!rightSidebarCollapsed && (
        <Card className="h-full border-0 rounded-none flex flex-col min-h-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {selectedDeck ? `${selectedDeck.name} Categories` : 'Categories'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex-1 min-h-0">
            {selectedDeck ? (
              <ScrollArea className="h-full">
                <div className="space-y-1">
                  {selectedDeck.categories.map((category) => (
                    <div key={category.id}>
                      <div
                        className={cn(
                          "p-2 rounded-md cursor-pointer transition-colors",
                          "hover:bg-muted/50",
                          selectedCategoryId === category.id && "bg-primary/10 border border-primary/20"
                        )}
                        onClick={() => handleCategorySelect(category.id)}
                      >
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "font-medium",
                            selectedCategoryId === category.id && "text-primary"
                          )}>
                            {category.name}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {category.cards.length}
                          </Badge>
                        </div>
                      </div>
                      
                      {/* Subcategories */}
                      {selectedCategoryId === category.id && category.subcategories.length > 0 && (
                        <div className="ml-4 mt-2 space-y-1">
                          <div
                            className={cn(
                              "p-1 px-2 rounded text-sm cursor-pointer transition-colors",
                              "hover:bg-muted/30",
                              !selectedSubcategory && "bg-primary/5 text-primary"
                            )}
                            onClick={() => handleSubcategorySelect(null)}
                          >
                            All ({category.cards.length})
                          </div>
                          {category.subcategories.map((subcategory) => {
                            const subcategoryCards = category.cards.filter(card => {
                              const ankomaTag = card.tags.find(tag => tag.startsWith('#ANKOMA::'))
                              if (!ankomaTag) return false
                              const tagParts = ankomaTag.replace('#ANKOMA::', '').split('::')
                              return formatTagName(tagParts[2] || '') === subcategory
                            })
                            
                            return (
                              <div
                                key={subcategory}
                                className={cn(
                                  "p-1 px-2 rounded text-sm cursor-pointer transition-colors",
                                  "hover:bg-muted/30",
                                  selectedSubcategory === subcategory && "bg-primary/5 text-primary"
                                )}
                                onClick={() => handleSubcategorySelect(subcategory)}
                              >
                                {subcategory} ({subcategoryCards.length})
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center text-muted-foreground mt-8">
                Select a deck to view categories
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Header */}
        <div className="border-b bg-background p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleBothSidebars}
                title="Toggle sidebars"
                className="flex items-center gap-2"
              >
                {leftSidebarCollapsed && rightSidebarCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
                <span className="text-sm">
                  {leftSidebarCollapsed && rightSidebarCollapsed ? 'Show' : 'Hide'} Sidebar
                </span>
              </Button>
            </div>
            
            <div className="text-center">
              <h1 className="text-xl font-semibold">
                {selectedDeck?.name || 'Ankoma Deck'}
              </h1>
              {selectedCategory && (
                <p className="text-sm text-muted-foreground">
                  {selectedCategory.name}
                  {selectedSubcategory && ` → ${selectedSubcategory}`}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Card Navigation Info */}
              {currentCards.length > 0 && (
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-medium">
                    Card {currentCardIndex + 1} of {currentCards.length}
                  </span>
                  {isShuffled && (
                    <Badge variant="secondary" className="text-xs">
                      Shuffled
                    </Badge>
                  )}
                </div>
              )}

              {/* Controls */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShuffle}
                  disabled={currentCards.length <= 1}
                >
                  <Shuffle className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={currentCards.length === 0}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Card Content */}
        <div className="flex-1 overflow-auto p-6 min-h-0 pb-16">
          {currentCard ? (
            <div className="w-full">
              <InteractiveAnkiViewer
                card={currentCard}
                onNext={currentCardIndex < currentCards.length - 1 ? handleNextCard : undefined}
                onPrevious={currentCardIndex > 0 ? handlePreviousCard : undefined}
              />
            </div>
          ) : selectedCategory ? (
            <div className="max-w-4xl mx-auto">
              <Card>
                <CardContent className="flex items-center justify-center h-64">
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
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              <Card>
                <CardContent className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Select a Category</h3>
                    <p className="text-muted-foreground">
                      Choose a deck and category from the sidebars to start studying.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}