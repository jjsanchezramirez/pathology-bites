// src/features/anki/components/interactive-anki-viewer.tsx

"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Separator } from "@/shared/components/ui/separator";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { AnkiCard, AnkiCardViewerProps } from "@/features/anki/types/anki-card";
import {
  processInteractiveClozes,
  extractClozes,
  hasInteractiveClozes,
} from "@/features/anki/utils/interactive-cloze-processor";
import {
  extractImagesFromHtml,
  replaceImagePlaceholders,
} from "@/shared/utils/html-image-extractor";
import { cn } from "@/shared/utils";

interface InteractiveAnkiViewerProps extends Omit<
  AnkiCardViewerProps,
  "showAnswer" | "onAnswerToggle"
> {
  card: AnkiCard;
  onNext?: () => void;
  onPrevious?: () => void;
  className?: string;
  currentCardIndex?: number;
  totalCards?: number;
  categoryName?: string;
  subcategoryName?: string;
}

export function InteractiveAnkiViewer({
  card,
  onNext,
  onPrevious,
  className,
  currentCardIndex,
  totalCards,
  categoryName,
  subcategoryName,
}: InteractiveAnkiViewerProps) {
  const [revealedClozes, setRevealedClozes] = useState<Set<number>>(new Set());
  const [showAnswer, setShowAnswer] = useState(false);
  const [imageOcclusionRevealed, setImageOcclusionRevealed] = useState(false);

  // Check if this is an image occlusion card (strict check; do NOT infer from presence of <img>)
  const isImageOcclusion =
    card.modelName === "Image Occlusion Enhanced+" ||
    card.modelName === "Image Occlusion Enhanced+++" ||
    card.modelName.includes("Image Occlusion Enhanced") ||
    card.tags.some((tag) => tag.toLowerCase().includes("image-occlusion"));

  // Check if this is a multiple images card (handled specially by the parser)
  const isMultipleImagesCard =
    card.modelName === "Cloze (Multiple Images)" ||
    card.tags.some((tag) => tag === "#multiple-images");

  // Check if the card has clozes (only for non-image occlusion cards)
  const questionHasClozes = !isImageOcclusion && hasInteractiveClozes(card.question);
  const answerHasClozes = !isImageOcclusion && hasInteractiveClozes(card.answer);
  const hasClozes = questionHasClozes || answerHasClozes;

  // Check if this is a basic front/back card (no clozes, no image occlusion, no multiple images)
  const isBasicCard = !hasClozes && !isImageOcclusion && !isMultipleImagesCard;

  // Extract clozes for reference
  const questionClozes = useMemo(
    () => (questionHasClozes ? extractClozes(card.question) : []),
    [card.question, questionHasClozes]
  );
  const answerClozes = useMemo(
    () => (answerHasClozes ? extractClozes(card.answer) : []),
    [card.answer, answerHasClozes]
  );

  // Reset revealed clozes and answer state when card changes
  useEffect(() => {
    setRevealedClozes(new Set());
    setShowAnswer(false);
    setImageOcclusionRevealed(false);
  }, [card.id]);

  // Extract images from question and answer HTML
  // For multiple images cards (already processed by parser), skip complex extraction
  const { processedQuestionHtml, hasMultipleImages } = useMemo(() => {
    // Multiple images cards are already processed by the parser - use as-is
    if (isMultipleImagesCard) {
      return {
        processedQuestionHtml: card.question,
        hasMultipleImages: true,
      };
    }

    const extracted = extractImagesFromHtml(card.question, true);

    // Replace [IMAGE_#] placeholders with actual inline image tags
    const htmlWithImages = replaceImagePlaceholders(extracted.cleanHtml, (index) => {
      const image = extracted.images[index];
      if (image && image.src) {
        // Check if it's an arrow or small icon (should stay small)
        const hasSmallKeyword =
          image.alt?.toLowerCase().includes("arrow") ||
          image.src?.toLowerCase().includes("arrow") ||
          image.alt?.toLowerCase().includes("icon") ||
          image.src?.toLowerCase().includes("symbol") ||
          image.src?.toLowerCase().includes("emoji");

        const width = image.width ? parseInt(image.width) : null;
        const height = image.height ? parseInt(image.height) : null;
        const isSmallByDimensions =
          (width !== null && width < 50) || (height !== null && height < 50);

        const filename = image.src.split("/").pop() || "";
        const filenameWithoutExt = filename.replace(/\.[^.]+$/, "");
        const isShortFilename =
          filenameWithoutExt.length <= 3 && /\.(png|svg|gif)$/i.test(filename);

        const isSmallIcon = hasSmallKeyword || isSmallByDimensions || isShortFilename;
        const className = isSmallIcon ? "inline-image-small" : "inline-image";
        return `<img src="${image.src}" alt="${image.alt || "Image"}" class="${className}" loading="lazy" />`;
      }
      return `<span class="text-muted-foreground text-sm italic">[Image ${index + 1} not available]</span>`;
    });

    return {
      processedQuestionHtml: htmlWithImages,
      hasMultipleImages: false,
    };
  }, [card.question, isMultipleImagesCard]);

  const { processedAnswerHtml } = useMemo(() => {
    const extracted = extractImagesFromHtml(card.answer, true);

    // Replace [IMAGE_#] placeholders with actual inline image tags
    const htmlWithImages = replaceImagePlaceholders(extracted.cleanHtml, (index) => {
      const image = extracted.images[index];
      if (image && image.src) {
        // Check if it's an arrow or small icon (should stay small)
        // Check by keywords in alt/src
        const hasSmallKeyword =
          image.alt?.toLowerCase().includes("arrow") ||
          image.src?.toLowerCase().includes("arrow") ||
          image.alt?.toLowerCase().includes("icon") ||
          image.src?.toLowerCase().includes("symbol") ||
          image.src?.toLowerCase().includes("emoji");

        // Check by dimensions (if width or height is specified and < 50px)
        const width = image.width ? parseInt(image.width) : null;
        const height = image.height ? parseInt(image.height) : null;
        const isSmallByDimensions =
          (width !== null && width < 50) || (height !== null && height < 50);

        // Check for very short filenames (likely icons/arrows like BO.png, BS.png)
        // Extract filename from src (after last slash)
        const filename = image.src.split("/").pop() || "";
        const filenameWithoutExt = filename.replace(/\.[^.]+$/, ""); // Remove extension
        const isShortFilename =
          filenameWithoutExt.length <= 3 && /\.(png|svg|gif)$/i.test(filename);

        const isSmallIcon = hasSmallKeyword || isSmallByDimensions || isShortFilename;
        const className = isSmallIcon ? "inline-image-small" : "inline-image";
        return `<img src="${image.src}" alt="${image.alt || "Image"}" class="${className}" loading="lazy" />`;
      }
      // Show placeholder text if image is missing
      return `<span class="text-muted-foreground text-sm italic">[Image ${index + 1} not available]</span>`;
    });

    return {
      processedAnswerHtml: htmlWithImages,
    };
  }, [card.answer]);

  // Process content with interactive clozes or handle image occlusion
  const clozeProcessedQuestion = useMemo(() => {
    if (isImageOcclusion) {
      return { html: processedQuestionHtml, clozes: [], allRevealed: true };
    }
    if (questionHasClozes) {
      return processInteractiveClozes(processedQuestionHtml, revealedClozes);
    }
    return { html: processedQuestionHtml, clozes: [], allRevealed: true };
  }, [processedQuestionHtml, questionHasClozes, revealedClozes, isImageOcclusion]);

  const clozeProcessedAnswer = useMemo(() => {
    if (isImageOcclusion) {
      return { html: processedAnswerHtml, clozes: [], allRevealed: true };
    }
    if (answerHasClozes) {
      return processInteractiveClozes(processedAnswerHtml, revealedClozes);
    }
    return { html: processedAnswerHtml, clozes: [], allRevealed: true };
  }, [processedAnswerHtml, answerHasClozes, revealedClozes, isImageOcclusion]);

  // Combined cloze state across question and answer
  const hasAnyClozes =
    hasClozes &&
    (clozeProcessedQuestion.clozes?.length || 0) + (clozeProcessedAnswer.clozes?.length || 0) > 0;
  const allClozesRevealed =
    hasAnyClozes &&
    [
      ...new Set(
        [...(clozeProcessedQuestion.clozes || []), ...(clozeProcessedAnswer.clozes || [])].map(
          (c) => c.index
        )
      ),
    ].every((idx) => revealedClozes.has(idx));

  // Handle cloze click
  const handleClozeClick = useCallback((clozeIndex: number) => {
    setRevealedClozes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(clozeIndex)) {
        newSet.delete(clozeIndex);
      } else {
        newSet.add(clozeIndex);
      }
      return newSet;
    });
  }, []);

  // Reset all clozes
  const resetClozes = useCallback(() => {
    setRevealedClozes(new Set());
  }, []);

  // Toggle answer visibility
  const toggleAnswer = useCallback(() => {
    if (isImageOcclusion) {
      // For image occlusion, toggle the occlusion overlay
      setImageOcclusionRevealed((prev) => !prev);
    } else {
      setShowAnswer((prev) => !prev);
    }
  }, [isImageOcclusion]);

  // For Basic cards, only show the back if there is more than a citation
  const basicHasNonCitationAnswer = useMemo(() => {
    const ans = card.answer || "";
    if (!ans.trim()) return false;

    // Remove HTML tags and check if there's actual content
    const textContent = ans.replace(/<[^>]*>/g, "").trim();
    if (!textContent) return false;

    // Check for meaningful sections (Extra/Personal Notes/Textbook)
    const hasMeaningfulSections =
      ans.includes("extra-section") ||
      ans.includes("personal-notes-section") ||
      ans.includes("textbook-section");

    // Check if answer has substantial text content (more than just a citation)
    const hasSubstantialContent = textContent.length > 50;

    // Check if answer has images
    const hasImages = ans.includes("<img") || ans.includes("[IMAGE_");

    return hasMeaningfulSections || hasSubstantialContent || hasImages;
  }, [card.answer]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't interfere with input fields
      if (["INPUT", "TEXTAREA"].includes((event.target as HTMLElement).tagName)) {
        return;
      }

      switch (event.code) {
        case "Space":
        case "Enter":
        case "NumpadEnter":
          event.preventDefault();
          if (hasAnyClozes && !allClozesRevealed) {
            // Reveal next cloze in numerical order (c1, c2, c3, etc.)
            const nextClozeIndex = [...questionClozes, ...answerClozes]
              .map((c) => c.index)
              .sort((a, b) => a - b)
              .find((index) => !revealedClozes.has(index));
            if (nextClozeIndex !== undefined) {
              handleClozeClick(nextClozeIndex);
              // For multiple images cards, also reveal the answer when revealing cloze
              // This makes it a 2-step flow: reveal cloze+answer → next card
              if (hasMultipleImages) {
                setShowAnswer(true);
              }
            } else {
              onNext?.();
            }
          } else if (isImageOcclusion && !imageOcclusionRevealed) {
            // For image occlusion, toggle the overlay
            toggleAnswer();
          } else if (hasMultipleImages && !showAnswer) {
            // For multiple images without clozes, reveal all images and answer
            setShowAnswer(true);
          } else if (isBasicCard && !showAnswer && card.answer && card.answer.trim()) {
            if (!basicHasNonCitationAnswer) {
              onNext?.();
            } else {
              toggleAnswer();
            }
          } else {
            onNext?.();
          }
          break;
        case "ArrowLeft":
          event.preventDefault();
          onPrevious?.();
          break;
        case "ArrowRight":
          event.preventDefault();
          onNext?.();
          break;
        case "KeyR":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            resetClozes();
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    hasAnyClozes,
    allClozesRevealed,
    questionClozes,
    answerClozes,
    revealedClozes,
    isImageOcclusion,
    imageOcclusionRevealed,
    hasMultipleImages,
    isBasicCard,
    basicHasNonCitationAnswer,
    showAnswer,
    handleClozeClick,
    toggleAnswer,
    onNext,
    onPrevious,
    resetClozes,
    card.answer,
  ]);

  // Handle click events on processed content
  const handleContentClick = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement;

      // Check if clicked element or its parent has cloze classes
      const clozeElement = target.closest(".cloze-hidden") as HTMLElement;
      if (clozeElement) {
        event.preventDefault();
        event.stopPropagation();
        const clozeIndex = parseInt(clozeElement.dataset.clozeIndex || "0", 10);
        handleClozeClick(clozeIndex);
        return;
      }
    },
    [handleClozeClick]
  );

  return (
    <div className={cn("max-w-[95%] md:max-w-3xl mx-auto mb-2 md:mb-4 pb-2 md:pb-4", className)}>
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
        <div className="mb-3 md:mb-4 px-2 md:px-0 text-center">
          {categoryName && (
            <h2 className="text-lg md:text-xl font-semibold text-foreground">{categoryName}</h2>
          )}
          {subcategoryName && (
            <p className="text-sm md:text-base text-muted-foreground mt-0.5">{subcategoryName}</p>
          )}
        </div>
      )}

      <Card className="w-full shadow-none">
        <CardHeader className="pb-2 px-4 md:px-6 border-b">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs md:text-sm text-muted-foreground font-mono">
              Card ID #{card.id}
            </div>
            {currentCardIndex !== undefined && totalCards !== undefined && (
              <div className="text-xs md:text-sm font-semibold text-foreground">
                Card {currentCardIndex + 1}/{totalCards}
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
                  isImageOcclusion ? "io-wrapper" : "cursor-pointer",
                  isImageOcclusion && imageOcclusionRevealed ? "io-revealed" : ""
                )}
                dangerouslySetInnerHTML={{ __html: clozeProcessedQuestion.html }}
                onClick={isImageOcclusion ? () => toggleAnswer() : handleContentClick}
              />
            </div>
          </div>

          {/* Answer section - show when conditions met */}
          {(hasAnyClozes ? allClozesRevealed : showAnswer || imageOcclusionRevealed) &&
            card.answer &&
            card.answer.trim() && (
              <>
                {/* For image occlusion, only show extra info (remarks, sources, etc.) - not the image again */}
                {isImageOcclusion ? (
                  (() => {
                    // Extract only the extra wrapper content (remarks, sources, etc.)
                    const extraMatch = card.answer.match(
                      /<div id="io-extra-wrapper">([\s\S]*?)<\/div>\s*$/
                    );
                    const extraContent = extraMatch ? extraMatch[1] : "";

                    if (extraContent.trim()) {
                      return (
                        <>
                          <Separator />
                          <div className="space-y-3">
                            <div className="prose prose-sm max-w-none">
                              <div
                                className="text-foreground leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: extraContent }}
                              />
                            </div>
                          </div>
                        </>
                      );
                    }
                    return null;
                  })()
                ) : (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      {/* Answer content - let ankoma parser CSS classes handle styling */}
                      <div className="prose prose-sm max-w-none">
                        <div
                          className="text-foreground leading-relaxed cursor-pointer"
                          dangerouslySetInnerHTML={{
                            __html: clozeProcessedAnswer.html
                              .replace(/\[IMAGE_\d+\]/gi, "") // Remove any remaining image placeholders
                              .trim(),
                          }}
                          onClick={handleContentClick}
                        />
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

          {/* Navigation Controls - Mobile only */}
          <div className="md:hidden pt-3 space-y-2">
            {/* Reveal button when needed */}
            {((!isImageOcclusion && hasAnyClozes && !allClozesRevealed) ||
              (isImageOcclusion && !imageOcclusionRevealed) ||
              (hasMultipleImages && !showAnswer) ||
              (isBasicCard &&
                !showAnswer &&
                card.answer &&
                card.answer.trim() &&
                basicHasNonCitationAnswer)) && (
              <Button
                variant="default"
                onClick={() => {
                  if (!isImageOcclusion && hasAnyClozes && !allClozesRevealed) {
                    const nextClozeIndex = questionClozes
                      .concat(answerClozes)
                      .map((c) => c.index)
                      .find((idx) => !revealedClozes.has(idx));
                    if (nextClozeIndex !== undefined) {
                      handleClozeClick(nextClozeIndex);
                      // For multiple images cards, also reveal the answer when revealing cloze
                      if (hasMultipleImages) {
                        setShowAnswer(true);
                      }
                    }
                  } else if (isImageOcclusion && !imageOcclusionRevealed) {
                    toggleAnswer();
                  } else if (hasMultipleImages && !showAnswer) {
                    setShowAnswer(true);
                  } else if (isBasicCard && !showAnswer) {
                    toggleAnswer();
                  }
                }}
                className="w-full"
              >
                <Eye className="h-4 w-4 mr-2" />
                Reveal
              </Button>
            )}
            {/* Navigation buttons - always visible */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onPrevious}
                disabled={!onPrevious}
                className="flex-1"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              <Button variant="default" onClick={onNext} disabled={!onNext} className="flex-1">
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>

          {/* Instructions - Desktop only */}
          <div className="border-t pt-6 mt-4 hidden md:block">
            <div className="text-center">
              <div className="text-xs text-muted-foreground">
                {!isImageOcclusion && hasAnyClozes && !allClozesRevealed ? (
                  <p>
                    <strong>Instructions:</strong> Use{" "}
                    <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">
                      ◀
                    </kbd>{" "}
                    <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">
                      ▶
                    </kbd>{" "}
                    to navigate •{" "}
                    <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">
                      Space
                    </kbd>{" "}
                    or{" "}
                    <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">
                      Enter
                    </kbd>{" "}
                    to reveal next
                  </p>
                ) : (
                  <p>
                    <strong>Instructions:</strong> Use{" "}
                    <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">
                      ◀
                    </kbd>{" "}
                    <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">
                      ▶
                    </kbd>{" "}
                    to navigate •{" "}
                    <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">
                      Space
                    </kbd>{" "}
                    or{" "}
                    <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">
                      Enter
                    </kbd>{" "}
                    for next card
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
          max-height: 600px;
          height: auto;
          display: inline-block;
          object-fit: contain;
        }

        /* Center all prose images except small icons */
        .prose img:not(.inline-image-small) {
          max-width: 100% !important;
          max-height: 600px !important;
          height: auto !important;
          display: block !important;
          margin: 0.5rem auto !important;
          object-fit: contain !important;
        }

        /* Ensure small icons stay inline */
        .prose .inline-image-small {
          max-width: 2rem !important;
          height: auto !important;
          display: inline !important;
          margin: 0 0.25rem !important;
          vertical-align: middle !important;
        }

        /* Support inline SVG overlays and IMG-wrapped SVG overlays */
        #io-wrapper {
          position: relative;
          width: 100%;
        }
        #io-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          z-index: 3;
          pointer-events: none;
        }
        #io-original {
          position: relative;
          top: 0;
          width: 100%;
          z-index: 2;
        }

        .io-wrapper svg,
        #io-overlay svg {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          pointer-events: none;
        }

        /* Default state for overlays - fully opaque (not see-through) with smooth transition */
        .io-wrapper .io-overlay,
        .io-wrapper svg rect[fill],
        .io-wrapper svg path[fill],
        .io-wrapper svg polygon[fill],
        .io-wrapper #io-overlay,
        .io-wrapper #io-overlay *,
        .io-wrapper svg rect,
        .io-wrapper svg path,
        .io-wrapper svg polygon,
        .io-wrapper svg circle,
        .io-wrapper svg ellipse {
          opacity: 1 !important;
          visibility: visible !important;
          transition:
            opacity 0.25s ease-out,
            visibility 0.25s ease-out;
        }

        /* When io-revealed class is on the wrapper, hide all overlays smoothly */
        .io-revealed .io-overlay,
        .io-revealed svg rect[fill],
        .io-revealed svg path[fill],
        .io-revealed svg polygon[fill],
        .io-revealed #io-overlay,
        .io-revealed #io-overlay *,
        .io-revealed #io-overlay svg,
        .io-revealed #io-overlay img,
        .io-revealed svg rect,
        .io-revealed svg path,
        .io-revealed svg polygon,
        .io-revealed svg circle,
        .io-revealed svg ellipse {
          opacity: 0 !important;
          visibility: hidden !important;
        }

        /* Ensure the original image stays visible */
        .io-wrapper #io-original,
        .io-wrapper #io-original *,
        .io-revealed #io-original,
        .io-revealed #io-original * {
          opacity: 1 !important;
          visibility: visible !important;
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
  );
}
