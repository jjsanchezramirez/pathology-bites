"use client";

import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent } from "@/shared/components/ui/card";
import {
  Shuffle,
  RotateCcw,
  ChevronLeft,
  FileText,
  Info,
  ExternalLink,
  BookOpen,
  PanelLeft,
} from "lucide-react";
import { InteractiveAnkiViewer } from "@/features/user/anki/components/interactive-anki-viewer";
import { AnkiCard } from "@/features/user/anki/types/anki-card";
import type { CategoryData, DeckData } from "./anki-data";

interface AnkiCardAreaProps {
  selectedDeck: DeckData | undefined;
  selectedCategory: CategoryData | undefined;
  selectedSubcategory: string | null;
  currentCards: AnkiCard[];
  currentCard: AnkiCard | undefined;
  currentCardIndex: number;
  isShuffled: boolean;
  isMobile: boolean;
  onMobileSidebarOpen: () => void;
  onShuffle: () => void;
  onReset: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

export function AnkiCardArea({
  selectedDeck,
  selectedCategory,
  selectedSubcategory,
  currentCards,
  currentCard,
  currentCardIndex,
  isShuffled,
  isMobile,
  onMobileSidebarOpen,
  onShuffle,
  onReset,
  onPrevious,
  onNext,
}: AnkiCardAreaProps) {
  return (
    <main className="anki-main flex-1 min-w-0 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="anki-header shrink-0 border-b border-border bg-background p-3 md:p-5">
        <div className="flex items-center justify-between gap-2 md:gap-4">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <Button
              variant="outline"
              size="sm"
              className="md:hidden h-8 shrink-0 gap-1.5 px-2.5"
              onClick={onMobileSidebarOpen}
            >
              <PanelLeft className="h-4 w-4" />
              <span className="text-xs font-medium">Choose Deck</span>
            </Button>
            <div className="min-w-0 flex-1">
              <div className="hidden md:block text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground mb-1">
                {selectedCategory ? (
                  <>
                    {selectedCategory.name}
                    {selectedSubcategory && ` → ${selectedSubcategory}`}
                  </>
                ) : (
                  "ANKOMA VIEWER"
                )}
              </div>
              <div className="hidden md:block text-[13px] md:text-[14px] font-medium text-foreground truncate">
                {selectedDeck?.name || "Select a deck to begin"}
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
                onClick={onShuffle}
                disabled={currentCards.length <= 1}
                title="Shuffle cards"
                className="h-8 w-8 p-0"
              >
                <Shuffle className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onReset}
                disabled={currentCards.length === 0}
                title="Reset to first card"
                className="h-8 w-8 p-0"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onPrevious}
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
                  onNext={currentCardIndex < currentCards.length - 1 ? onNext : undefined}
                  onPrevious={currentCardIndex > 0 ? onPrevious : undefined}
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
                      This is a read-only viewer for educational review. For spaced repetition and
                      progress tracking, use the{" "}
                      <a
                        href={
                          isMobile
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
                        : "This category doesn't contain any cards to study."}
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
  );
}
