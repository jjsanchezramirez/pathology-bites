// src/features/anki/components/ankoma-viewer.tsx

'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
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
  FileText
} from 'lucide-react'

import { SimplifiedSubdeckSidebar } from './simplified-subdeck-sidebar'
import { AnkomaData, AnkomaSection, AnkomaViewerProps } from '../types/anki-card'
import {
  findSectionById,
  getAllCardsFromSection,
  getSectionStats
} from '../utils/ankoma-parser'
import { useClientAnkoma } from '@/shared/hooks/use-client-ankoma'
import { useImagePreloader } from '../hooks/use-image-preloader'
import { cn } from '@/shared/utils'
import { toast } from 'sonner'

// Funny loading messages for Anki deck loading
const ANKI_LOADING_MESSAGES = [
  "Shuffling through thousands of digital flashcards...",
  "Teaching the computer what 'spaced repetition' means...",
  "Convincing Anki cards to reveal their secrets...",
  "Parsing JSON like a pathologist reads slides...",
  "Loading cards faster than you can say 'again'...",
  "Organizing knowledge into bite-sized chunks...",
  "Channeling the spirit of Hermann Ebbinghaus...",
  "Converting study materials into brain food...",
  "Preparing your daily dose of educational torture...",
  "Assembling the army of forgotten facts...",
  "Calibrating the forgetting curve algorithm...",
  "Teaching AI the difference between 'easy' and 'hard'...",
  "Importing wisdom from the digital flashcard realm...",
  "Transforming procrastination into productivity...",
  "Loading cards that will haunt your dreams...",
  "Preparing the ultimate test of your memory...",
  "Gathering cards from the depths of ankoma.json...",
  "Converting study anxiety into learning opportunities...",
  "Assembling your personalized knowledge database...",
  "Preparing cards that make medical school look easy..."
]

export function AnkomaViewer({
  autoLoad = true,
  defaultSection,
  onSectionChange,
  onError,
  className
}: AnkomaViewerProps) {
  // Use the new client-side hook instead of manual loading
  const { ankomaData, sections, isLoading, error, totalCards } = useClientAnkoma()
  
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [currentCardIndex, setCurrentCardIndex] = useState(0)

  // Loading message cycling state
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState('')
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [isShuffled, setIsShuffled] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Set default section when data loads
  useEffect(() => {
    if (ankomaData && defaultSection && !selectedSectionId) {
      const section = findSectionById(ankomaData.sections, defaultSection)
      if (section) {
        setSelectedSectionId(section.id)
      }
    }
  }, [ankomaData, defaultSection, selectedSectionId])

  // Auto-select first section with cards when data loads
  useEffect(() => {
    if (ankomaData && !defaultSection && !selectedSectionId && sections.length > 0) {
      const findFirstSectionWithCards = (sections: AnkomaSection[]): AnkomaSection | null => {
        for (const section of sections) {
          if (section.cardCount > 0) return section
          const found = findFirstSectionWithCards(section.subsections)
          if (found) return found
        }
        return null
      }

      const firstSectionWithCards = findFirstSectionWithCards(sections)
      if (firstSectionWithCards) {
        setSelectedSectionId(firstSectionWithCards.id)
      }
    }
  }, [ankomaData, sections, defaultSection, selectedSectionId])

  // Show success toast when data loads
  useEffect(() => {
    if (ankomaData && totalCards > 0) {
      toast.success(`Loaded ${totalCards.toLocaleString()} cards from Ankoma deck`)
    }
  }, [ankomaData, totalCards])

  // Pass error to parent component
  useEffect(() => {
    if (error) {
      onError?.(error)
    }
  }, [error, onError])

  // Cycle through loading messages while loading
  useEffect(() => {
    if (isLoading) {
      // Set initial message
      const initialIndex = Math.floor(Math.random() * ANKI_LOADING_MESSAGES.length)
      setLoadingMessageIndex(initialIndex)
      setCurrentLoadingMessage(ANKI_LOADING_MESSAGES[initialIndex])

      // Cycle through messages every 3 seconds
      loadingIntervalRef.current = setInterval(() => {
        setLoadingMessageIndex(prev => {
          const nextIndex = (prev + 1) % ANKI_LOADING_MESSAGES.length
          setCurrentLoadingMessage(ANKI_LOADING_MESSAGES[nextIndex])
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

  // Get current section and its cards
  const currentSection = useMemo(() => {
    if (!ankomaData || !selectedSectionId) return null
    return findSectionById(ankomaData.sections, selectedSectionId)
  }, [ankomaData, selectedSectionId])

  const currentCards = useMemo(() => {
    if (!currentSection) return []
    const allCards = getAllCardsFromSection(currentSection)
    return isShuffled ? [...allCards].sort(() => Math.random() - 0.5) : allCards
  }, [currentSection, isShuffled])

  // Preload images for better performance
  const { preloadedCount } = useImagePreloader(currentCards, currentCardIndex, {
    enabled: currentCards.length > 0,
    preloadCount: 5,
    priority: 'low'
  })

  // Current card from selected section
  const currentCard = currentCards[currentCardIndex]

  const handleSectionSelect = (sectionId: string) => {
    const section = findSectionById(ankomaData?.sections || [], sectionId)
    if (section) {
      setSelectedSectionId(sectionId)
      setCurrentCardIndex(0)
      setShowAnswer(false)
      setIsShuffled(false)
      onSectionChange?.(section)

      // Show success message with section info
      const stats = getSectionStats(section)
      toast.success(`Selected: ${section.name} (${stats.totalCards} cards)`)
    }
  }

  const handleNextCard = () => {
    if (currentCardIndex < currentCards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1)
      setShowAnswer(false)
    }
  }

  const handlePreviousCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1)
      setShowAnswer(false)
    }
  }

  const handleShuffle = () => {
    setIsShuffled(!isShuffled)
    setCurrentCardIndex(0)
    setShowAnswer(false)
  }

  const handleReset = () => {
    setCurrentCardIndex(0)
    setShowAnswer(false)
    setIsShuffled(false)
  }

  if (isLoading) {
    return (
      <div className={cn("w-full max-w-4xl mx-auto", className)}>
        <Card className="animate-pulse">
          <CardContent className="flex items-center justify-center py-16">
            <div className="text-center space-y-4 max-w-md">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-foreground">Loading Ankoma Deck</h3>
                <p className="text-sm text-muted-foreground">
                  Parsing {totalCards?.toLocaleString() || 'thousands of'} cards from ankoma.json...
                </p>
              </div>

              {/* Funny loading message */}
              <div className="bg-muted/50 rounded-lg p-4 border">
                <p className="text-sm text-primary font-medium italic leading-relaxed min-h-[2.5rem] flex items-center justify-center transition-opacity duration-500">
                  {currentLoadingMessage || "Shuffling through thousands of digital flashcards..."}
                </p>
              </div>

              {/* Loading progress hint */}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span>Loading from R2 storage</span>
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

  return (
    <div className={cn("w-full h-full min-h-0 flex", className)}>
      {/* Sidebar */}
      <div className={cn(
        "transition-all duration-300 border-r bg-background",
        sidebarCollapsed ? "w-0" : "w-80"
      )}>
        {!sidebarCollapsed && (
          <SimplifiedSubdeckSidebar
            sections={ankomaData.sections}
            selectedSectionId={selectedSectionId}
            onSectionSelect={handleSectionSelect}
            className="h-full border-0 rounded-none"
          />
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
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
                <ChevronRight className={cn(
                  "h-4 w-4 transition-transform",
                  !sidebarCollapsed && "rotate-180"
                )} />
              </Button>

              <div>
                <h1 className="text-xl font-semibold flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Ankoma Deck
                </h1>
                {currentSection && (
                  <p className="text-sm text-muted-foreground">
                    {currentSection.path.slice(1).join(' → ')}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Card Navigation Info */}
              {currentSection && currentCards.length > 0 && (
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
                  disabled={!currentSection || currentCards.length <= 1}
                >
                  <Shuffle className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={!currentSection}
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
            <div className="max-w-4xl mx-auto">
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">Card {currentCardIndex + 1} of {currentCards.length}</h3>
                      <div className="flex gap-2">
                        {currentCardIndex > 0 && (
                          <Button onClick={handlePreviousCard} size="sm">
                            Previous
                          </Button>
                        )}
                        {currentCardIndex < currentCards.length - 1 && (
                          <Button onClick={handleNextCard} size="sm">
                            Next
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="border rounded-lg p-4">
                      <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: currentCard.question }} />
                    </div>

                    <div className="border rounded-lg p-4 bg-muted/50">
                      <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: currentCard.answer }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : currentSection ? (
            <div className="max-w-4xl mx-auto">
              <Card>
                <CardContent className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Cards Available</h3>
                    <p className="text-muted-foreground">
                      This section doesn't contain any cards to study.
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
                    <h3 className="text-lg font-semibold mb-2">Select a Subdeck</h3>
                    <p className="text-muted-foreground">
                      Choose a subdeck from the sidebar to start studying.
                    </p>
                    {sidebarCollapsed && (
                      <Button
                        className="mt-4"
                        onClick={() => setSidebarCollapsed(false)}
                      >
                        <ChevronRight className="h-4 w-4 mr-2" />
                        Show Subdecks
                      </Button>
                    )}
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
