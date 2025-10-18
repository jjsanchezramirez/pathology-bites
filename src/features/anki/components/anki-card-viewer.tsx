// src/features/anki/components/anki-card-viewer.tsx

'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { useImageCacheHandler } from '@/shared/hooks/use-smart-image-cache'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Separator } from '@/shared/components/ui/separator'
import {
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Clock,
  Hash,
  BookOpen
} from 'lucide-react'
import { AnkiCard, AnkiCardViewerProps } from '../types/anki-card'
import {
  processClozeText,
  hasClozes,
  getClozeIndices,
  generateClozeQuestion,
  generateClozeAnswer
} from '../utils/cloze-processor'
import { cn } from '@/shared/utils'

// Separate component for cached images to avoid hook violations
function CachedAnkiImage({ src, alt, index }: { src: string; alt: string; index: number }) {
  const handleImageLoad = useImageCacheHandler(src, true)

  return (
    <div className="flex justify-center">
      <div className="relative max-w-2xl w-full">
        <Image
          src={src}
          alt={alt}
          width={800}
          height={600}
          className="w-full h-auto rounded-xl border object-contain"
          style={{ maxHeight: '70vh' }}
          unoptimized={true}
          onLoad={handleImageLoad}
        />
      </div>
    </div>
  )
}

export function AnkiCardViewer({
  card,
  showAnswer = false,
  onAnswerToggle,
  onNext,
  onPrevious,
  className
}: AnkiCardViewerProps) {
  const [currentClozeIndex, setCurrentClozeIndex] = useState<number>(0)
  const [internalShowAnswer, setInternalShowAnswer] = useState(showAnswer)

  // Use internal state if no external control is provided
  const isShowingAnswer = onAnswerToggle ? showAnswer : internalShowAnswer
  
  const handleAnswerToggle = () => {
    if (onAnswerToggle) {
      onAnswerToggle()
    } else {
      setInternalShowAnswer(!internalShowAnswer)
    }
  }

  // Process card content for clozes
  const questionClozes = useMemo(() => {
    if (hasClozes(card.question)) {
      return getClozeIndices(card.question)
    }
    return []
  }, [card.question])

  const answerClozes = useMemo(() => {
    if (hasClozes(card.answer)) {
      return getClozeIndices(card.answer)
    }
    return []
  }, [card.answer])

  const isClozeCard = questionClozes.length > 0 || answerClozes.length > 0

  // Reset cloze index when card changes
  useEffect(() => {
    setCurrentClozeIndex(0)
    setInternalShowAnswer(false)
  }, [card.id])

  // Generate display content
  const displayContent = useMemo(() => {
    if (!isClozeCard) {
      return {
        question: card.question,
        answer: card.answer
      }
    }

    if (questionClozes.length > 0) {
      const clozeIndex = questionClozes[currentClozeIndex] || questionClozes[0]
      return {
        question: generateClozeQuestion(card.question, clozeIndex),
        answer: generateClozeAnswer(card.question)
      }
    }

    if (answerClozes.length > 0) {
      const clozeIndex = answerClozes[currentClozeIndex] || answerClozes[0]
      return {
        question: card.question,
        answer: generateClozeQuestion(card.answer, clozeIndex)
      }
    }

    return {
      question: card.question,
      answer: card.answer
    }
  }, [card, isClozeCard, questionClozes, answerClozes, currentClozeIndex])

  // Handle cloze navigation
  const handlePreviousCloze = () => {
    const totalClozes = Math.max(questionClozes.length, answerClozes.length)
    setCurrentClozeIndex((prev) => (prev - 1 + totalClozes) % totalClozes)
  }

  const handleNextCloze = () => {
    const totalClozes = Math.max(questionClozes.length, answerClozes.length)
    setCurrentClozeIndex((prev) => (prev + 1) % totalClozes)
  }

  // Extract images from content and convert to R2 URLs
  const extractImages = (content: string) => {
    const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g
    const images: string[] = []
    let match

    while ((match = imgRegex.exec(content)) !== null) {
      let src = match[1]

      // Convert relative paths to direct R2 CDN URLs for better performance
      // Files are now organized in anki/ subfolder
      if (!src.startsWith('http')) {
        const sanitizedSrc = src.replace(/\s+/g, '_')
        const publicUrl = 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev'
        src = `${publicUrl}/anki/${sanitizedSrc}`
      }

      images.push(src)
    }

    return images
  }

  const questionImages = extractImages(displayContent.question)
  const answerImages = extractImages(displayContent.answer)

  // Clean HTML content for display
  const cleanHtml = (html: string) => {
    return html
      .replace(/<img[^>]*>/g, '') // Remove img tags (we'll display them separately)
      .replace(/<[^>]*>/g, '') // Remove other HTML tags
      .trim()
  }

  return (
    <div className={cn("w-full max-w-4xl mx-auto", className)}>
      <Card className="h-full">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">{card.deckName}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {card.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          
          {/* Card metadata */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Hash className="h-4 w-4" />
              <span>Card {card.cardId}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{card.reviews} reviews</span>
            </div>
            <div className="flex items-center gap-1">
              <RotateCcw className="h-4 w-4" />
              <span>{card.interval}d interval</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Cloze navigation for cloze cards */}
          {isClozeCard && (
            <div className="flex items-center justify-center gap-2 p-2 bg-muted/50 rounded-lg">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousCloze}
                disabled={questionClozes.length + answerClozes.length <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">
                Cloze {currentClozeIndex + 1} of {Math.max(questionClozes.length, answerClozes.length)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextCloze}
                disabled={questionClozes.length + answerClozes.length <= 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Question */}
          <div className="space-y-4">
            <div className="prose prose-sm max-w-none">
              <div 
                className="text-foreground leading-relaxed"
                dangerouslySetInnerHTML={{ __html: displayContent.question }}
              />
            </div>

            {/* Question images */}
            {questionImages.length > 0 && (
              <div className="flex flex-col items-center gap-4">
                {questionImages.map((src, index) => (
                  <CachedAnkiImage
                    key={index}
                    src={src}
                    alt={`Question image ${index + 1}`}
                    index={index}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Answer section */}
          {isShowingAnswer && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="prose prose-sm max-w-none">
                  <div 
                    className="text-foreground leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: displayContent.answer }}
                  />
                </div>

                {/* Answer images */}
                {answerImages.length > 0 && (
                  <div className="flex flex-col items-center gap-4">
                    {answerImages.map((src, index) => (
                      <CachedAnkiImage
                        key={index}
                        src={src}
                        alt={`Answer image ${index + 1}`}
                        index={index}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Controls */}
          <div className="flex items-center justify-between pt-4">
            <Button
              variant="outline"
              onClick={onPrevious}
              disabled={!onPrevious}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <Button
              variant={isShowingAnswer ? "secondary" : "default"}
              onClick={handleAnswerToggle}
            >
              {isShowingAnswer ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Hide Answer
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Show Answer
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={onNext}
              disabled={!onNext}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
