"use client";

import { Layers } from "lucide-react";
import { AnkiCategoryList } from "./anki-category-list";
import type { CategorySidebarItem } from "./anki-data";

interface AnkiCategorySidebarProps {
  categories: CategorySidebarItem[];
  selectedDeckName: string | undefined;
  selectedSubcategory: string | null;
  expandedCategoryId: string | null;
  expanded: boolean;
  isAnimating: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onCategoryClick: (categoryId: string, hasSubcategories: boolean) => void;
  onSubcategoryClick: (subcategory: string) => void;
}

export function AnkiCategorySidebar({
  categories,
  selectedDeckName,
  selectedSubcategory,
  expandedCategoryId,
  expanded,
  isAnimating,
  onExpandedChange,
  onCategoryClick,
  onSubcategoryClick,
}: AnkiCategorySidebarProps) {
  return (
    <aside
      className="hidden md:flex h-full shrink-0 bg-card border-r border-border overflow-hidden flex-col"
      style={{
        width: expanded ? "300px" : "64px",
        transition: "width 300ms ease-in-out",
      }}
      onMouseEnter={() => !isAnimating && onExpandedChange(true)}
      onMouseLeave={() => !isAnimating && onExpandedChange(false)}
    >
      {expanded ? (
        <div className="h-full w-full flex flex-col min-w-[300px]">
          <div className="p-5 border-b border-border shrink-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground mb-1">
              CATEGORIES
            </div>
            <div className="text-[13px] text-muted-foreground">
              {selectedDeckName || "Select a deck"}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {categories.length > 0 ? (
              <AnkiCategoryList
                categories={categories}
                expandedCategoryId={expandedCategoryId}
                selectedSubcategory={selectedSubcategory}
                onCategoryClick={onCategoryClick}
                onSubcategoryClick={onSubcategoryClick}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground text-center">
                  Select a deck to view categories
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="h-full w-full flex flex-col items-center pt-5 px-2 gap-6">
          <Layers className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="flex flex-col items-center gap-4">
            <div className="writing-mode-vertical-rl rotate-180 text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground">
              CATEGORIES
            </div>
            <div className="writing-mode-vertical-rl rotate-180 text-[13px] text-muted-foreground">
              {selectedDeckName || "Select a deck"}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
