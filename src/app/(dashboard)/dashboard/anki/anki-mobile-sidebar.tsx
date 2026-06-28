"use client";

import { cn } from "@/shared/utils";
import { Button } from "@/shared/components/ui/button";
import { X } from "lucide-react";
import { AnkiCategoryList } from "./anki-category-list";
import type { DeckSidebarItem, CategorySidebarItem } from "./anki-data";

interface AnkiMobileSidebarProps {
  open: boolean;
  onClose: () => void;
  decks: DeckSidebarItem[];
  categories: CategorySidebarItem[];
  selectedDeckId: string | null;
  selectedSubcategory: string | null;
  expandedCategoryId: string | null;
  onDeckSelect: (deckId: string) => void;
  onCategoryClick: (categoryId: string, hasSubcategories: boolean) => void;
  onSubcategoryClick: (subcategory: string) => void;
}

export function AnkiMobileSidebar({
  open,
  onClose,
  decks,
  categories,
  selectedDeckId,
  selectedSubcategory,
  expandedCategoryId,
  onDeckSelect,
  onCategoryClick,
  onSubcategoryClick,
}: AnkiMobileSidebarProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/20 backdrop-blur-md z-40 transition-all duration-300 ease-in-out",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      {/* Sidebar Panel */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-background transition-transform duration-300 ease-in-out flex flex-col",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <span className="text-sm font-semibold">Browse Decks</span>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Decks Section */}
          <div className="p-3 border-b border-border">
            <div className="text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground mb-2 px-1">
              DECKS
            </div>
            <div className="space-y-1">
              {decks.map((deck) => {
                const isActive = selectedDeckId === deck.id;
                return (
                  <button
                    key={deck.id}
                    onClick={() => onDeckSelect(deck.id)}
                    className={cn(
                      "w-full px-3 py-2.5 rounded-lg transition-all duration-200 ease-in-out flex items-center justify-between text-left cursor-pointer",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-transparent hover:bg-muted"
                    )}
                  >
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
                  </button>
                );
              })}
            </div>
          </div>

          {/* Categories Section */}
          {categories.length > 0 && (
            <div className="p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground mb-2 px-1">
                CATEGORIES
              </div>
              <AnkiCategoryList
                categories={categories}
                expandedCategoryId={expandedCategoryId}
                selectedSubcategory={selectedSubcategory}
                onCategoryClick={onCategoryClick}
                onSubcategoryClick={onSubcategoryClick}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
