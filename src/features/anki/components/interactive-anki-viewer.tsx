// src/features/anki/components/interactive-anki-viewer.tsx

'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Separator } from '@/shared/components/ui/separator'
import { 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw,
  Clock,
  Hash,
  BookOpen,
  Eye,
  ExternalLink
} from 'lucide-react'
import { AnkiCard, AnkiCardViewerProps } from '@/features/anki/types/anki-card'
import { 
  processInteractiveClozes, 
  extractClozes, 
  hasInteractiveClozes,
  InteractiveCloze
} from '@/features/anki/utils/interactive-cloze-processor'
import { extractImagesFromHtml, sanitizeHtmlForSafeRendering, replaceImagePlaceholders } from '@/shared/utils/html-image-extractor'
import { cn } from '@/shared/utils'

interface InteractiveAnkiViewerProps extends Omit<AnkiCardViewerProps, 'showAnswer' | 'onAnswerToggle'> {
  card: AnkiCard
  onNext?: () => void
  onPrevious?: () => void
  className?: string
  currentCardIndex?: number
  totalCards?: number
  categoryName?: string
  subcategoryName?: string
}

// Function to format tag names by splitting on uppercase letters and symbols
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

export function InteractiveAnkiViewer({
  card,
  onNext,
  onPrevious,
  className,
  currentCardIndex,
  totalCards,
  categoryName,
  subcategoryName
}: InteractiveAnkiViewerProps) {
  const [revealedClozes, setRevealedClozes] = useState<Set<number>>(new Set())
  const [showAnswer, setShowAnswer] = useState(false)

  // Check if this is an image occlusion card (strict check; do NOT infer from presence of <img>)
  const isImageOcclusion = card.modelName === 'Image Occlusion Enhanced+' ||
                          card.modelName === 'Image Occlusion Enhanced+++' ||
                          card.modelName.includes('Image Occlusion Enhanced') ||
                          card.tags.some(tag => tag.toLowerCase().includes('image-occlusion'))

  // Check if the card has clozes (only for non-image occlusion cards)
  const questionHasClozes = !isImageOcclusion && hasInteractiveClozes(card.question)
  const answerHasClozes = !isImageOcclusion && hasInteractiveClozes(card.answer)
  const hasClozes = questionHasClozes || answerHasClozes

  // Check if this is a basic front/back card (no clozes, no image occlusion)
  const isBasicCard = !hasClozes && !isImageOcclusion

  // Extract clozes for reference
  const questionClozes = useMemo(() => 
    questionHasClozes ? extractClozes(card.question) : [], 
    [card.question, questionHasClozes]
  )
  const answerClozes = useMemo(() => 
    answerHasClozes ? extractClozes(card.answer) : [], 
    [card.answer, answerHasClozes]
  )

  // Reset revealed clozes and answer state when card changes
  useEffect(() => {
    setRevealedClozes(new Set())
    setShowAnswer(false)
  }, [card.id])

  // Extract images from question and answer HTML
  const { questionImages, processedQuestionHtml } = useMemo(() => {
    const extracted = extractImagesFromHtml(card.question, true)

    // Replace [IMAGE_#] placeholders with actual inline image tags
    const htmlWithImages = replaceImagePlaceholders(extracted.cleanHtml, (index) => {
      const image = extracted.images[index]
      if (image && image.src) {
        // Check if it's an arrow or small icon (should stay small)
        const isSmallIcon = image.alt?.toLowerCase().includes('arrow') ||
                           image.src?.toLowerCase().includes('arrow') ||
                           image.alt?.toLowerCase().includes('icon')

        const className = isSmallIcon ? 'inline-image-small' : 'inline-image'
        return `<img src="${image.src}" alt="${image.alt || 'Image'}" class="${className}" loading="lazy" />`
      }
      // Show placeholder text if image is missing
      return `<span class="text-muted-foreground text-sm italic">[Image ${index + 1} not available]</span>`
    })

    return {
      questionImages: extracted.images,
      processedQuestionHtml: htmlWithImages
    }
  }, [card.question])

  const { answerImages, processedAnswerHtml } = useMemo(() => {
    const extracted = extractImagesFromHtml(card.answer, true)

    // Replace [IMAGE_#] placeholders with actual inline image tags
    const htmlWithImages = replaceImagePlaceholders(extracted.cleanHtml, (index) => {
      const image = extracted.images[index]
      if (image && image.src) {
        // Check if it's an arrow or small icon (should stay small)
        const isSmallIcon = image.alt?.toLowerCase().includes('arrow') ||
                           image.src?.toLowerCase().includes('arrow') ||
                           image.alt?.toLowerCase().includes('icon')

        const className = isSmallIcon ? 'inline-image-small' : 'inline-image'
        return `<img src="${image.src}" alt="${image.alt || 'Image'}" class="${className}" loading="lazy" />`
      }
      // Show placeholder text if image is missing
      return `<span class="text-muted-foreground text-sm italic">[Image ${index + 1} not available]</span>`
    })

    return {
      answerImages: extracted.images,
      processedAnswerHtml: htmlWithImages
    }
  }, [card.answer])

  // Process content with interactive clozes or handle image occlusion
  const clozeProcessedQuestion = useMemo(() => {
    if (isImageOcclusion) {
      return { html: processedQuestionHtml, clozes: [], allRevealed: true }
    }
    if (questionHasClozes) {
      return processInteractiveClozes(processedQuestionHtml, revealedClozes)
    }
    return { html: processedQuestionHtml, clozes: [], allRevealed: true }
  }, [processedQuestionHtml, questionHasClozes, revealedClozes, isImageOcclusion])

  const clozeProcessedAnswer = useMemo(() => {
    if (isImageOcclusion) {
      return { html: processedAnswerHtml, clozes: [], allRevealed: true }
    }
    if (answerHasClozes) {
      return processInteractiveClozes(processedAnswerHtml, revealedClozes)
    }
    return { html: processedAnswerHtml, clozes: [], allRevealed: true }
  }, [processedAnswerHtml, answerHasClozes, revealedClozes, isImageOcclusion])

  // Combined cloze state across question and answer
  const hasAnyClozes = hasClozes && ((clozeProcessedQuestion.clozes?.length || 0) + (clozeProcessedAnswer.clozes?.length || 0) > 0)
  const allClozesRevealed = hasAnyClozes && [...new Set([...(clozeProcessedQuestion.clozes||[]), ...(clozeProcessedAnswer.clozes||[])].map(c => c.index))].every(idx => revealedClozes.has(idx))

  // Handle cloze click
  const handleClozeClick = useCallback((clozeIndex: number) => {
    setRevealedClozes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(clozeIndex)) {
        newSet.delete(clozeIndex)
      } else {
        newSet.add(clozeIndex)
      }
      return newSet
    })
  }, [])

  // Reset all clozes
  const resetClozes = useCallback(() => {
    setRevealedClozes(new Set())
  }, [])

  // Toggle answer visibility
  const toggleAnswer = useCallback(() => {
    setShowAnswer(prev => !prev)
  }, [])

  // For Basic cards, only show the back if there is more than a citation
  const basicHasNonCitationAnswer = useMemo(() => {
    const ans = card.answer || ''
    if (!ans.trim()) return false
    // Consider Extra/Personal Notes/Textbook as meaningful; Citation-only should not block progression
    return ans.includes('extra-section') || ans.includes('personal-notes-section') || ans.includes('textbook-section')
  }, [card.answer])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't interfere with input fields
      if (['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) {
        return
      }

      switch (event.code) {
        case 'Space':
        case 'Enter':
        case 'NumpadEnter':
          event.preventDefault()
          if (hasAnyClozes && !allClozesRevealed) {
            // Reveal next cloze in numerical order (c1, c2, c3, etc.)
            const nextClozeIndex = [...questionClozes, ...answerClozes]
              .map(c => c.index)
              .sort((a, b) => a - b)
              .find(index => !revealedClozes.has(index))
            if (nextClozeIndex !== undefined) {
              handleClozeClick(nextClozeIndex)
            } else {
              onNext?.()
            }
          } else if ((isImageOcclusion || isBasicCard) && !showAnswer && card.answer && card.answer.trim()) {
            if (isBasicCard && !basicHasNonCitationAnswer) {
              onNext?.()
            } else {
              toggleAnswer()
            }
          } else {
            onNext?.()
          }
          break
        case 'ArrowLeft':
          event.preventDefault()
          onPrevious?.()
          break
        case 'ArrowRight':
          event.preventDefault()
          onNext?.()
          break
        case 'KeyR':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            resetClozes()
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    hasAnyClozes,
    allClozesRevealed,
    questionClozes,
    answerClozes,
    revealedClozes,
    isImageOcclusion,
    isBasicCard,
    basicHasNonCitationAnswer,
    showAnswer,
    handleClozeClick,
    toggleAnswer,
    onNext,
    onPrevious,
    resetClozes,
    card.answer
  ])

  // Handle click events on processed content
  const handleContentClick = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement
    
    // Check if clicked element or its parent has cloze classes
    const clozeElement = target.closest('.cloze-hidden') as HTMLElement
    if (clozeElement) {
      event.preventDefault()
      event.stopPropagation()
      const clozeIndex = parseInt(clozeElement.dataset.clozeIndex || '0', 10)
      handleClozeClick(clozeIndex)
      return
    }
  }, [handleClozeClick])

  // Reveal all clozes
  const revealAllClozes = useCallback(() => {
    const allIndices = new Set([
      ...questionClozes.map(c => c.index),
      ...answerClozes.map(c => c.index)
    ])
    setRevealedClozes(allIndices)
  }, [questionClozes, answerClozes])

  const totalClozes = questionClozes.length + answerClozes.length
  const revealedCount = revealedClozes.size

  return (
    <div className={cn("w-full max-w-7xl mx-auto mb-3 md:mb-6 pb-3 md:pb-6 px-2 md:px-0", className)}>
      <style jsx>{`
        .inline-image {
          max-width: 100%;
          max-height: 600px;
          width: auto;
          height: auto;
          display: block;
          margin: 0.5rem auto;
          object-fit: contain;
        }
        .inline-image-small {
          max-width: 2rem;
          height: auto;
          display: inline;
          margin: 0 0.25rem;
          vertical-align: middle;
        }
      `}</style>

      {/* Breadcrumb above card */}
      {(categoryName || subcategoryName) && (
        <div className="mb-3 md:mb-4 px-2 md:px-0">
          {categoryName && (
            <h2 className="text-lg md:text-xl font-semibold text-foreground">
              {categoryName}
            </h2>
          )}
          {subcategoryName && (
            <p className="text-sm md:text-base text-muted-foreground mt-0.5">
              {subcategoryName}
            </p>
          )}
        </div>
      )}

      <Card className="w-full">
        <CardHeader className="pb-2 px-4 md:px-6 border-b">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs md:text-sm text-muted-foreground font-mono">
              Card ID #{card.id}
            </div>
            {currentCardIndex !== undefined && totalCards !== undefined && (
              <div className="text-xs md:text-sm font-semibold text-foreground">
                {currentCardIndex + 1}/{totalCards}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3 md:space-y-4 pb-4 md:pb-6 px-4 md:px-6 overflow-visible">

          {/* Question */}
          <div className="space-y-2">
            <div className="prose prose-sm max-w-none">
              <div
                className={cn(
                  "text-foreground leading-relaxed",
                  isImageOcclusion ? "io-wrapper" : "cursor-pointer"
                )}
                dangerouslySetInnerHTML={{ __html: clozeProcessedQuestion.html }}
                onClick={isImageOcclusion ? () => toggleAnswer() : handleContentClick}
              />
            </div>
          </div>


          {/* Answer section - show when conditions met */}
          {(hasAnyClozes ? allClozesRevealed : showAnswer) && card.answer && card.answer.trim() && (
            <>
              <Separator />
              <div className="space-y-3">
                {/* Answer content - let ankoma parser CSS classes handle styling */}
                <div className="prose prose-sm max-w-none">
                  <div
                    className={cn(
                      "text-foreground leading-relaxed",
                      isImageOcclusion ? "io-wrapper" : "cursor-pointer"
                    )}
                    dangerouslySetInnerHTML={{
                      __html: clozeProcessedAnswer.html
                        .replace(/\[IMAGE_\d+\]/gi, '') // Remove any remaining image placeholders
                        .trim()
                    }}
                    onClick={isImageOcclusion ? () => toggleAnswer() : handleContentClick}
                  />
                </div>
              </div>
            </>
          )}

          {/* Navigation Controls - Mobile only */}
          <div className="flex items-center justify-between pt-3 md:hidden">
            <Button
              variant="outline"
              onClick={onPrevious}
              disabled={!onPrevious}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
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

          {/* Instructions - Desktop only */}
          <div className="border-t pt-6 mt-4 hidden md:block">
            <div className="text-center">
              <div className="text-xs text-muted-foreground">
                {!isImageOcclusion && hasAnyClozes && !allClozesRevealed ? (
                  <p>
                    <strong>Instructions:</strong> Use <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">◀</kbd> <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">▶</kbd> to navigate • <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">Space</kbd> or <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">Enter</kbd> to reveal next
                  </p>
                ) : (
                  <p>
                    <strong>Instructions:</strong> Use <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">◀</kbd> <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">▶</kbd> to navigate • <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">Space</kbd> or <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">Enter</kbd> for next card
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cloze and Image Occlusion styles */}
      <style jsx global>{`
        .cloze-hidden {
          background-color: #fef3c7;
          border: 1px solid #f59e0b;
          padding: 2px 6px;
          border-radius: 3px;
          cursor: pointer;
          user-select: none;
          transition: all 0.15s ease;
          display: inline;
          margin: 0 1px;
          font-weight: 500;
          color: #92400e;
        }

        .cloze-hidden:hover {
          background-color: #fde68a;
          border-color: #d97706;
        }

        .cloze-hidden:active {
          background-color: #fcd34d;
        }

        .cloze-revealed {
          background-color: #d1fae5;
          border: 1px solid #22c55e;
          padding: 2px 6px;
          border-radius: 3px;
          cursor: pointer;
          user-select: none;
          transition: all 0.15s ease;
          display: inline;
          margin: 0 1px;
          font-weight: 500;
          color: #166534;
        }

        .cloze-revealed:hover {
          background-color: #bbf7d0;
          border-color: #16a34a;
        }

        /* Answer section styling - simplified */
        .extra-section,
        .personal-notes-section,
        .textbook-section {
          margin: 12px 0;
          font-size: 0.875rem;
        }

        .citation-section {
          margin: 4px 0 12px 0;
          padding: 12px;
          background-color: #f9fafb;
          border-radius: 8px;
          font-size: 0.75rem;
        }

        .extra-section h4,
        .personal-notes-section h4,
        .textbook-section h4 {
          margin: 16px 0 8px 0;
          font-size: 0.875rem;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .citation-section h4 {
          margin: 0 0 8px 0;
          font-size: 0.75rem;
          font-weight: 500;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Image Occlusion styles */
        .io-wrapper {
          position: relative;
          max-width: 100%;
          display: flex;
          justify-content: center;
          flex-direction: column;
          align-items: center;
        }

        /* Ensure images don't exceed container but keep natural size by default */
        .io-wrapper img {
          max-width: 100%;
          height: auto;
          display: inline-block;
        }

        /* Center all prose images except small icons */
        .prose img:not(.inline-image-small) {
          max-width: 100% !important;
          height: auto !important;
          display: block !important;
          margin: 0.5rem auto !important;
        }

        /* Support inline SVG overlays and IMG-wrapped SVG overlays */
        #io-wrapper { position: relative; width: 100%; }
        #io-overlay { position: absolute; top: 0; left: 0; width: 100%; z-index: 3; pointer-events: none; }
        #io-original { position: relative; top: 0; width: 100%; z-index: 2; }

        .io-wrapper svg,
        #io-overlay svg {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          pointer-events: none;
        }

        .io-wrapper .io-overlay {
          fill: #000;
          opacity: 0.8;
        }

        .io-wrapper .io-overlay.revealed {
          opacity: 0;
        }

        .io-header {
          font-weight: bold;
          margin-bottom: 10px;
          text-align: center;
        }

        .io-footer {
          margin-top: 10px;
          font-style: italic;
          text-align: center;
        }

        .io-extra-entry {
          margin: 15px 0;
          padding: 10px;
          background-color: #f9fafb;
          border-radius: 6px;
        }

        .io-field-descr {
          font-weight: bold;
          margin-bottom: 8px;
          color: #374151;
        }

        @media (prefers-color-scheme: dark) {
          .io-extra-entry {
            background-color: #1f2937;
          }

          .io-field-descr {
            color: #d1d5db;
          }
        }
      `}</style>
    </div>
  )
}

