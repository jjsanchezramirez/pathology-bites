// src/features/anki/components/anki-deck-viewer.tsx

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Progress } from '@/shared/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { 
  Shuffle, 
  RotateCcw, 
  Play, 
  Pause,
  SkipForward,
  SkipBack,
  BookOpen,
  Clock,
  Target
} from 'lucide-react'
import { AnkiDeck, AnkiDeckViewerProps, AnkiCard } from '../types/anki-card'
import { InteractiveAnkiViewer } from '@/features/debug/components/interactive-anki-viewer'
import { cn } from '@/shared/utils'

export function AnkiDeckViewer({
  deck,
  currentCardIndex = 0,
  onCardChange,
  showAnswers = false,
  className
}: AnkiDeckViewerProps) {
  const [internalCardIndex, setInternalCardIndex] = useState(currentCardIndex)
  const [internalShowAnswers, setInternalShowAnswers] = useState(showAnswers)
  const [isStudyMode, setIsStudyMode] = useState(false)
  const [studyCards, setStudyCards] = useState<AnkiCard[]>(deck.cards)
  const [completedCards, setCompletedCards] = useState<Set<number>>(new Set())

  // Use internal state if no external control is provided
  const activeCardIndex = onCardChange ? currentCardIndex : internalCardIndex
  const currentCard = studyCards[activeCardIndex]

  const handleCardChange = (newIndex: number) => {
    const clampedIndex = Math.max(0, Math.min(newIndex, studyCards.length - 1))
    if (onCardChange) {
      onCardChange(clampedIndex)
    } else {
      setInternalCardIndex(clampedIndex)
    }
  }

  const handleAnswerToggle = () => {
    setInternalShowAnswers(!internalShowAnswers)
  }

  const handleNextCard = () => {
    const nextIndex = (activeCardIndex + 1) % studyCards.length
    handleCardChange(nextIndex)
    setInternalShowAnswers(false)
  }

  const handlePreviousCard = () => {
    const prevIndex = (activeCardIndex - 1 + studyCards.length) % studyCards.length
    handleCardChange(prevIndex)
    setInternalShowAnswers(false)
  }

  const handleShuffleDeck = () => {
    const shuffled = [...studyCards].sort(() => Math.random() - 0.5)
    setStudyCards(shuffled)
    handleCardChange(0)
    setCompletedCards(new Set())
  }

  const handleResetDeck = () => {
    setStudyCards(deck.cards)
    handleCardChange(0)
    setCompletedCards(new Set())
    setInternalShowAnswers(false)
  }

  const handleStartStudy = () => {
    setIsStudyMode(true)
    setCompletedCards(new Set())
    setInternalShowAnswers(false)
  }

  const handleStopStudy = () => {
    setIsStudyMode(false)
    setCompletedCards(new Set())
  }

  const handleMarkCompleted = () => {
    if (currentCard) {
      const newCompleted = new Set(completedCards)
      newCompleted.add(currentCard.cardId)
      setCompletedCards(newCompleted)
      
      // Auto-advance to next card
      setTimeout(() => {
        handleNextCard()
      }, 500)
    }
  }

  const handleJumpToCard = (cardIndex: string) => {
    const index = parseInt(cardIndex, 10)
    handleCardChange(index)
    setInternalShowAnswers(false)
  }

  // Calculate progress
  const progress = studyCards.length > 0 ? ((activeCardIndex + 1) / studyCards.length) * 100 : 0
  const completionRate = studyCards.length > 0 ? (completedCards.size / studyCards.length) * 100 : 0

  // Get card statistics
  const cardStats = {
    total: studyCards.length,
    completed: completedCards.size,
    remaining: studyCards.length - completedCards.size,
    newCards: studyCards.filter(card => card.type === 0).length,
    learningCards: studyCards.filter(card => card.type === 1).length,
    reviewCards: studyCards.filter(card => card.type === 2).length
  }

  if (!currentCard) {
    return (
      <div className={cn("w-full max-w-4xl mx-auto", className)}>
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Cards Available</h3>
              <p className="text-muted-foreground">This deck doesn't contain any cards.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn("w-full max-w-6xl mx-auto space-y-6", className)}>
      {/* Deck Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                {deck.name}
              </CardTitle>
              {deck.description && (
                <p className="text-sm text-muted-foreground mt-1">{deck.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {cardStats.total} cards
              </Badge>
              {isStudyMode && (
                <Badge variant="secondary">
                  Study Mode
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress: {activeCardIndex + 1} of {studyCards.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            
            {isStudyMode && (
              <div className="flex justify-between text-sm">
                <span>Completed: {completedCards.size} of {studyCards.length}</span>
                <span>{Math.round(completionRate)}%</span>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Select value={activeCardIndex.toString()} onValueChange={handleJumpToCard}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {studyCards.map((card, index) => (
                    <SelectItem key={card.cardId} value={index.toString()}>
                      Card {index + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button variant="outline" size="sm" onClick={handleShuffleDeck}>
                <Shuffle className="h-4 w-4" />
              </Button>
              
              <Button variant="outline" size="sm" onClick={handleResetDeck}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {isStudyMode ? (
                <>
                  <Button variant="outline" onClick={handleStopStudy}>
                    <Pause className="h-4 w-4 mr-2" />
                    Stop Study
                  </Button>
                  <Button onClick={handleMarkCompleted}>
                    <Target className="h-4 w-4 mr-2" />
                    Mark Complete
                  </Button>
                </>
              ) : (
                <Button onClick={handleStartStudy}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Study
                </Button>
              )}
            </div>
          </div>

          {/* Card Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center p-2 bg-blue-50 rounded-lg">
              <div className="font-semibold text-blue-700">{cardStats.newCards}</div>
              <div className="text-blue-600">New</div>
            </div>
            <div className="text-center p-2 bg-orange-50 rounded-lg">
              <div className="font-semibold text-orange-700">{cardStats.learningCards}</div>
              <div className="text-orange-600">Learning</div>
            </div>
            <div className="text-center p-2 bg-green-50 rounded-lg">
              <div className="font-semibold text-green-700">{cardStats.reviewCards}</div>
              <div className="text-green-600">Review</div>
            </div>
            <div className="text-center p-2 bg-purple-50 rounded-lg">
              <div className="font-semibold text-purple-700">{cardStats.completed}</div>
              <div className="text-purple-600">Completed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card Viewer */}
      <InteractiveAnkiViewer
        card={currentCard}
        onNext={handleNextCard}
        onPrevious={handlePreviousCard}
      />
    </div>
  )
}
