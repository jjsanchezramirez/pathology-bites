"use client";

import { cn } from "@/shared/utils";
import { ChevronRight } from "lucide-react";
import type { CategorySidebarItem } from "./anki-data";

interface AnkiCategoryListProps {
  categories: CategorySidebarItem[];
  expandedCategoryId: string | null;
  selectedSubcategory: string | null;
  onCategoryClick: (categoryId: string, hasSubcategories: boolean) => void;
  onSubcategoryClick: (subcategory: string) => void;
}

/** The category + nested subcategory buttons, shared by the desktop + mobile sidebars. */
export function AnkiCategoryList({
  categories,
  expandedCategoryId,
  selectedSubcategory,
  onCategoryClick,
  onSubcategoryClick,
}: AnkiCategoryListProps) {
  return (
    <div className="space-y-1">
      {categories.map((category) => {
        const isCategoryExpanded = expandedCategoryId === category.id;
        const hasSubcategories = category.subcategories.length > 0;

        return (
          <div key={category.id}>
            <button
              onClick={() => onCategoryClick(category.id, hasSubcategories)}
              className={cn(
                "w-full px-3 py-2.5 rounded-lg transition-all duration-200 ease-in-out flex items-center text-left cursor-pointer gap-2 hover:bg-muted"
              )}
            >
              {hasSubcategories && (
                <ChevronRight
                  className={cn(
                    "w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ease-in-out",
                    isCategoryExpanded && "rotate-90"
                  )}
                />
              )}
              {!hasSubcategories && <div className="w-4" />}
              <span className="flex-1 text-[14px] font-medium text-foreground truncate">
                {category.name}
              </span>
              <span className="text-[13px] text-muted-foreground shrink-0 font-mono">
                {category.cardCount}
              </span>
            </button>

            {hasSubcategories && isCategoryExpanded && (
              <div className="ml-6 mt-1 space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                {category.subcategories.map((subcategory) => {
                  const isSubActive = selectedSubcategory === subcategory.name;
                  return (
                    <button
                      key={subcategory.name}
                      onClick={() => onSubcategoryClick(subcategory.name)}
                      className={cn(
                        "w-full py-2 px-3 rounded-lg transition-all duration-200 ease-in-out flex items-center justify-between cursor-pointer text-left",
                        isSubActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-transparent hover:bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "flex-1 text-[13px] truncate",
                          isSubActive ? "text-primary-foreground font-medium" : "text-foreground"
                        )}
                      >
                        {subcategory.name}
                      </span>
                      <span
                        className={cn(
                          "text-[12px] shrink-0 ml-2 font-mono",
                          isSubActive ? "text-primary-foreground/90" : "text-muted-foreground"
                        )}
                      >
                        {subcategory.cardCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
