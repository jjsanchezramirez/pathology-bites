// src/features/debug/components/interactive-anki-viewer.tsx

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
import { extractImagesFromHtml, sanitizeHtmlForSafeRendering } from '@/shared/utils/html-image-extractor'
import { cn } from '@/shared/utils'

interface InteractiveAnkiViewerProps extends Omit<AnkiCardViewerProps, 'showAnswer' | 'onAnswerToggle'> {
  card: AnkiCard
  onNext?: () => void
  onPrevious?: () => void
  className?: string
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
  className
}: InteractiveAnkiViewerProps) {
  const [revealedClozes, setRevealedClozes] = useState<Set<number>>(new Set())
  const [showAnswer, setShowAnswer] = useState(false)

  // Check if this is an image occlusion card (strict check; do NOT infer from presence of <img>)
  const isImageOcclusion = card.modelName === 'Image Occlusion Enhanced+' ||
                          card.modelName === 'Image Occlusion Enhanced+++' ||
                          card.modelName.includes('Image Occlusion Enhanced') ||
                          card.tags.some(tag => tag.toLowerCase().includes('image-occlusion'))

  // Debug logging to see what card types we're getting
  if (process.env.NODE_ENV === 'development') {
    console.log('Card model:', card.modelName, 'isImageOcclusion:', isImageOcclusion, 'hasImages:', card.question.includes('<img') || card.answer.includes('<img'))
  }

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
    const sanitizedHtml = sanitizeHtmlForSafeRendering(extracted.cleanHtml)
    return {
      questionImages: extracted.images,
      processedQuestionHtml: sanitizedHtml
    }
  }, [card.question])

  const { answerImages, processedAnswerHtml } = useMemo(() => {
    const extracted = extractImagesFromHtml(card.answer, true)
    const sanitizedHtml = sanitizeHtmlForSafeRendering(extracted.cleanHtml)
    return {
      answerImages: extracted.images,
      processedAnswerHtml: sanitizedHtml
    }
  }, [card.answer])

  // Process content with interactive clozes or handle image occlusion
  const clozeProcessedQuestion = useMemo(() => {
    if (isImageOcclusion) {
      // For image occlusion, treat as no clozes and mark revealed
      return { html: processedQuestionHtml, clozes: [], allRevealed: true }
    } else if (questionHasClozes) {
      return processInteractiveClozes(processedQuestionHtml, revealedClozes)
    }
    return { html: processedQuestionHtml, clozes: [], allRevealed: true }
  }, [processedQuestionHtml, questionHasClozes, revealedClozes, isImageOcclusion])

  const clozeProcessedAnswer = useMemo(() => {
    if (isImageOcclusion) {
      // For image occlusion, the answer contains the revealed version
      return { html: processedAnswerHtml, clozes: [], allRevealed: true }
    } else if (answerHasClozes) {
      return processInteractiveClozes(processedAnswerHtml, revealedClozes)
    }
    return { html: processedAnswerHtml, clozes: [], allRevealed: true }
  }, [processedAnswerHtml, answerHasClozes, revealedClozes, isImageOcclusion])

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
          if (hasClozes && !clozeProcessedQuestion.allRevealed) {
            // Reveal next cloze
            const nextClozeIndex = [...questionClozes, ...answerClozes]
              .map(c => c.index)
              .find(index => !revealedClozes.has(index))
            if (nextClozeIndex !== undefined) {
              handleClozeClick(nextClozeIndex)
            } else {
              // All clozes revealed, go to next card
              onNext?.()
            }
          } else if ((isImageOcclusion || isBasicCard) && !showAnswer && card.answer && card.answer.trim()) {
            // For basic cards: if the back is citation-only, skip showing it and go next
            if (isBasicCard && !basicHasNonCitationAnswer) {
              onNext?.()
            } else {
              toggleAnswer()
            }
          } else {
            // No answer content or answer already shown, go to next card
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
    hasClozes,
    clozeProcessedQuestion.allRevealed,
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
    resetClozes
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
    <div className={cn("w-full max-w-4xl mx-auto mb-8 pb-8", className)}>
      <Card className="w-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              {(() => {
                const ankomaTag = card.tags?.find(tag => tag.startsWith('#ANKOMA::'))
                if (ankomaTag) {
                  const tagParts = ankomaTag.replace('#ANKOMA::', '').split('::')
                  const formattedTag = tagParts.map(part => formatTagName(part)).join(' → ')
                  return (
                    <span className="text-sm font-semibold text-foreground">
                      {formattedTag}
                    </span>
                  )
                }
                return null
              })()}
            </div>
            <div className="text-sm font-semibold text-foreground font-mono">
              Card ID #{card.id}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pb-8 overflow-visible">

          {/* Question */}
          <div className="space-y-4">
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

            {/* Question images */}
            {questionImages.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {questionImages.map((image, index) => (
                  <div key={index} className="relative aspect-video rounded-lg overflow-hidden border">
                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      className="object-contain"
                      unoptimized={true}
                      onError={(e) => {
                        console.error(`Failed to load question image: ${image.src}`, e)
                      }}
                      onLoad={() => {
                        console.log(`Successfully loaded question image: ${image.src}`)
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          
          {/* Answer section - show when conditions met */}
          {(hasClozes ? clozeProcessedQuestion.allRevealed : showAnswer) && card.answer && card.answer.trim() && (
            <>
              <Separator />
              <div className="space-y-6">
                {/* Split answer into parts for better formatting */}
                {(() => {
                  const parts = card.answer.split('<br><br>')
                  const referencesIndex = parts.findIndex(part => 
                    part.toLowerCase().includes('gupta') || 
                    part.toLowerCase().includes('citation') ||
                    part.toLowerCase().includes('reference')
                  )
                  
                  const contentParts = referencesIndex >= 0 ? parts.slice(0, referencesIndex) : parts
                  const referencesPart = referencesIndex >= 0 ? parts.slice(referencesIndex) : []
                  
                  return (
                    <>
                      {/* Main content (Extra, Personal Notes, Textbook) */}
                      {contentParts.length > 0 && (
                        <div className="prose prose-sm max-w-none">
                          <div 
                            className={cn(
                              "text-foreground leading-relaxed",
                              isImageOcclusion ? "io-wrapper" : "cursor-pointer"
                            )}
                            dangerouslySetInnerHTML={{ __html: processedAnswerHtml }}
                            onClick={isImageOcclusion ? () => toggleAnswer() : handleContentClick}
                          />
                        </div>
                      )}
                      
                      {/* References section */}
                      {referencesPart.length > 0 && (
                        <div className="border-t pt-4">
                          <div className="text-sm text-gray-600 leading-relaxed p-3">
                            <div dangerouslySetInnerHTML={{ 
                              __html: referencesPart.join('<br><br>')
                                .replace(/<br>/g, ' ')
                                .replace(/&nbsp;/g, ' ')
                                .replace(/<img[^>]*>/gi, '[IMAGE REMOVED]')
                                .trim()
                            }} />
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}
                
                {/* Answer images */}
                {answerImages.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    {answerImages.map((image, index) => (
                      <div key={index} className="relative aspect-video rounded-lg overflow-hidden border">
                        <Image
                          src={image.src}
                          alt={image.alt}
                          fill
                          className="object-contain"
                          unoptimized={true}
                          onError={(e) => {
                            console.error(`Failed to load answer image: ${image.src}`, e)
                          }}
                          onLoad={() => {
                            console.log(`Successfully loaded answer image: ${image.src}`)
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4">
            <Button
              variant="outline"
              onClick={onPrevious}
              disabled={!onPrevious}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="text-center">
              {/* Navigation placeholder - instructions moved below */}
            </div>

            <Button
              variant="outline"
              onClick={onNext}
              disabled={!onNext}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>

          {/* Instructions below card */}
          <div className="text-center mt-4">
            <div className="text-sm text-muted-foreground">
              {!isImageOcclusion && hasClozes && !clozeProcessedQuestion.allRevealed ? (
                "Use arrow keys to navigate • Space/Enter to reveal next"
              ) : (
                "Use arrow keys to navigate • Space/Enter for next card"
              )}
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
        .textbook-section,
        .citation-section {
          margin: 16px 0;
          padding: 0;
        }
        
        .personal-notes-section h4,
        .textbook-section h4,
        .citation-section h4 {
          margin: 16px 0 8px 0;
          font-size: 0.875rem;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        @media (prefers-color-scheme: dark) {
          .cloze-hidden {
            background-color: #92400e;
            border-color: #d97706;
            color: #fef3c7;
          }
          
          .cloze-hidden:hover {
            background-color: #d97706;
            border-color: #f59e0b;
            color: white;
          }
          
          .cloze-revealed {
            background-color: #14532d;
            border-color: #22c55e;
            color: #dcfce7;
          }
          
          .cloze-revealed:hover {
            background-color: #166534;
            border-color: #16a34a;
          }
          
          .personal-notes-section h4,
          .textbook-section h4,
          .citation-section h4 {
            color: #9ca3af;
          }
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
        .io-wrapper img, .prose img {
          max-width: 100%;
          height: auto;
          display: inline-block;
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