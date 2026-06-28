"use client";

import { cn } from "@/shared/utils";
import { BookOpen } from "lucide-react";
import type { DeckSidebarItem } from "./anki-data";

interface AnkiDeckSidebarProps {
  decks: DeckSidebarItem[];
  selectedDeckId: string | null;
  isLoading: boolean;
  expanded: boolean;
  isAnimating: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onDeckSelect: (deckId: string) => void;
}

export function AnkiDeckSidebar({
  decks,
  selectedDeckId,
  isLoading,
  expanded,
  isAnimating,
  onExpandedChange,
  onDeckSelect,
}: AnkiDeckSidebarProps) {
  return (
    <aside
      className="hidden md:flex h-full shrink-0 bg-secondary border-r border-border overflow-hidden flex-col"
      style={{
        width: expanded ? "240px" : "64px",
        transition: "width 300ms ease-in-out",
      }}
      onMouseEnter={() => !isAnimating && onExpandedChange(true)}
      onMouseLeave={() => !isAnimating && onExpandedChange(false)}
    >
      {expanded ? (
        <div className="h-full w-full flex flex-col min-w-[240px]">
          <div className="p-5 border-b border-border shrink-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground mb-1">
              DECKS
            </div>
            <div className="text-[13px] text-muted-foreground">Select a deck</div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {decks.length > 0 ? (
              <div className="space-y-1">
                {decks.map((deck) => {
                  const isActive = selectedDeckId === deck.id;
                  return (
                    <button
                      key={deck.id}
                      onClick={() => onDeckSelect(deck.id)}
                      className={cn(
                        "w-full px-3 py-2.5 rounded-lg transition-all duration-200 ease-in-out flex flex-col text-left cursor-pointer gap-1",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-transparent hover:bg-muted"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            "flex-1 text-[14px] font-medium truncate",
                            isActive ? "text-primary-foreground" : "text-foreground"
                          )}
                        >
                          {deck.name}
                        </span>
                        <span
                          className={cn(
                            "text-[13px] shrink-0 ml-2 font-mono",
                            isActive ? "text-primary-foreground/90" : "text-muted-foreground"
                          )}
                        >
                          {deck.totalCards}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "text-[12px]",
                          isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                        )}
                      >
                        {deck.categoryCount} categories
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground text-center">
                  {isLoading ? "Loading..." : "No decks available"}
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
  );
}
