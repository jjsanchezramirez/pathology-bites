"use client";

/**
 * One row, one implementation, phone to desktop.
 *
 * It used to be two trees — a horizontal desktop block and a stacked mobile one —
 * which is how they drifted apart: a control added to one was missing from the
 * other, and the two disagreed about labels. Everything here is a single flex
 * row; what changes with width is how much TEXT each control shows, not which
 * controls exist or where they sit.
 */

import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Loader2, Maximize2, RefreshCw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import {
  WSI_QUESTION_KINDS,
  type WsiQuestionKind,
} from "@/features/user/wsi-questions/utils/wsi-question-kinds";
import { cn } from "@/shared/utils";
import { type WsiLayout } from "@/features/user/wsi-questions/utils/wsi-layout";

interface WSIGeneratorControlsProps {
  showCategoryFilter: boolean;
  availableCategories: string[];
  /** Categories the enabled question types cannot draw from — offered, but inert. */
  unavailableCategories?: string[];
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  /** Every kind the reader has switched on; the generator picks per slide. */
  questionKinds: WsiQuestionKind[];
  onQuestionKindsChange: (value: WsiQuestionKind[]) => void;
  layout: WsiLayout;
  onLayoutChange: (value: WsiLayout) => void;
  isGenerating: boolean;
  onNewQuestion: () => void;
  /** Full screen docks this bar to the top of the overlay, where vertical space is scarce. */
  compact?: boolean;
}

export function WSIGeneratorControls({
  showCategoryFilter,
  availableCategories,
  unavailableCategories = [],
  selectedCategory,
  onCategoryChange,
  questionKinds,
  onQuestionKindsChange,
  layout,
  onLayoutChange,
  isGenerating,
  onNewQuestion,
  compact = false,
}: WSIGeneratorControlsProps) {
  const fullscreen = layout === "fullscreen";

  const toggleKind = (id: WsiQuestionKind) => {
    const on = questionKinds.includes(id);
    // Never let the last one off: an empty set can only generate nothing, and a
    // dead New Question button explains itself to nobody.
    if (on && questionKinds.length === 1) return;
    onQuestionKindsChange(on ? questionKinds.filter((k) => k !== id) : [...questionKinds, id]);
  };

  return (
    <div className={compact ? "" : "mb-6"}>
      <div className="flex items-center gap-2">
        {/* Category — the one control that can give up width, so it is the one
            that flexes. Truncates rather than wrapping the row.

            Inert mid-generation: picking a second category starts a second
            request, and the slower one used to win — leaving the reader on a
            slide from a category the dropdown no longer showed. */}
        {showCategoryFilter && availableCategories.length > 0 && (
          <Select value={selectedCategory} onValueChange={onCategoryChange} disabled={isGenerating}>
            <SelectTrigger className="h-9 min-w-0 flex-1 sm:max-w-52" aria-label="Category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {availableCategories.map((category) => {
                // Shown but disabled, not hidden: a category that vanishes reads
                // as missing content, while a greyed one with a reason tells the
                // reader which toggle to flip.
                const inert = unavailableCategories.includes(category);
                return (
                  <SelectItem key={category} value={category} disabled={inert}>
                    {category}
                    {inert && (
                      <span className="ml-1.5 text-xs text-muted-foreground">diagnosis only</span>
                    )}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}

        {/* Question types. Filled = on: over a light bar, two shades of white read
            as three identical chips and the state was invisible. */}
        <div className="flex flex-shrink-0 items-center gap-0.5 rounded-lg border bg-card p-0.5">
          {WSI_QUESTION_KINDS.map((k) => {
            const on = questionKinds.includes(k.id);
            const last = on && questionKinds.length === 1;
            return (
              <TooltipProvider key={k.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={k.label}
                      onClick={() => toggleKind(k.id)}
                      className={cn(
                        "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                        on
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        last && "cursor-default"
                      )}
                    >
                      {/* Same control, less text — never a different control. */}
                      <span className="hidden sm:inline">{k.short}</span>
                      <span className="sm:hidden">{k.tiny}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {k.blurb}
                    {last && " — at least one type stays on"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>

        {/* Full screen. The label is the hit target too, and it is the first thing
            to go when the row runs out of room. */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-shrink-0 items-center gap-2">
                <label
                  htmlFor="wsi-fullscreen"
                  className="hidden cursor-pointer text-sm font-medium whitespace-nowrap lg:inline"
                >
                  Full screen
                </label>
                <Maximize2 className="h-4 w-4 text-muted-foreground lg:hidden" aria-hidden />
                <Switch
                  id="wsi-fullscreen"
                  aria-label="Full screen"
                  checked={fullscreen}
                  onCheckedChange={(on) => onLayoutChange(on ? "fullscreen" : "classic")}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              Press <span className="font-semibold">F</span> to toggle
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* New question — icon-only until there is room for the words. */}
        <Button
          onClick={onNewQuestion}
          disabled={isGenerating}
          size="sm"
          className="h-9 flex-shrink-0 px-3"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="hidden whitespace-nowrap sm:ml-2 sm:inline">
            {isGenerating ? "Generating…" : "New question"}
          </span>
        </Button>
      </div>
    </div>
  );
}
