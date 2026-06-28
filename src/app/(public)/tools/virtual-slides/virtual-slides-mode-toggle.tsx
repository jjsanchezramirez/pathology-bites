"use client";

import { Search, GraduationCap } from "lucide-react";

interface VirtualSlidesModeToggleProps {
  mode: "search" | "study";
  onSelectSearch: () => void;
  onSelectStudy: () => void;
}

/** Segmented Search/Study toggle above the search card. */
export function VirtualSlidesModeToggle({
  mode,
  onSelectSearch,
  onSelectStudy,
}: VirtualSlidesModeToggleProps) {
  return (
    <div className="flex items-center justify-center mb-4">
      <div className="inline-flex bg-muted/50 rounded-full p-1 gap-1">
        <button
          onClick={onSelectSearch}
          className={`flex items-center gap-2 px-4 md:px-6 py-2 rounded-full font-medium transition-all ${
            mode === "search"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Search className="h-4 w-4" />
          <span className="text-sm md:text-base">Search</span>
        </button>
        <button
          onClick={onSelectStudy}
          className={`flex items-center gap-2 px-4 md:px-6 py-2 rounded-full font-medium transition-all ${
            mode === "study"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <GraduationCap className="h-4 w-4" />
          <span className="text-sm md:text-base">Study</span>
        </button>
      </div>
    </div>
  );
}
