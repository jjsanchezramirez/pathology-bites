"use client";

import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Loader2, ExternalLink, RefreshCw, Info } from "lucide-react";
import { type GeneratedQuestion } from "@/shared/hooks/use-wsi-question-generator";

interface WSIGeneratorControlsProps {
  showCategoryFilter: boolean;
  availableCategories: string[];
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  currentQuestion: GeneratedQuestion;
  isGenerating: boolean;
  onNewQuestion: () => void;
}

export function WSIGeneratorControls({
  showCategoryFilter,
  availableCategories,
  selectedCategory,
  onCategoryChange,
  currentQuestion,
  isGenerating,
  onNewQuestion,
}: WSIGeneratorControlsProps) {
  return (
    <div className="mb-6 space-y-4">
      {/* Control Bar: Desktop horizontal, Mobile stacked */}
      <div className="space-y-4 md:space-y-0">
        {/* Desktop: Single horizontal line */}
        <div className="hidden md:flex md:items-center md:justify-between md:gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Category Filter */}
            {showCategoryFilter && availableCategories.length > 0 && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <label className="text-sm font-medium whitespace-nowrap">Category:</label>
                <Select value={selectedCategory} onValueChange={onCategoryChange}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {availableCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* View Original Link */}
            {currentQuestion && (
              <a
                href={currentQuestion.wsi.slide_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 transition-colors flex items-center gap-1 text-sm font-medium flex-shrink-0"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="whitespace-nowrap">View Original</span>
              </a>
            )}
          </div>

          {/* New Question Button - Desktop */}
          <Button
            onClick={onNewQuestion}
            disabled={isGenerating}
            className="min-w-[140px] flex-shrink-0"
            size="default"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                <span className="whitespace-nowrap">Generating...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                <span className="whitespace-nowrap">New Question</span>
              </>
            )}
          </Button>
        </div>

        {/* Mobile: Stacked layout */}
        <div className="md:hidden space-y-3">
          {/* Category Filter - Full width on mobile */}
          {showCategoryFilter && availableCategories.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium">Category:</label>
              <Select value={selectedCategory} onValueChange={onCategoryChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {availableCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Action buttons row */}
          <div className="flex gap-2">
            {/* New Question Button - Mobile */}
            <Button onClick={onNewQuestion} disabled={isGenerating} className="flex-1" size="sm">
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  <span className="whitespace-nowrap">Generating...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  <span className="whitespace-nowrap">New</span>
                </>
              )}
            </Button>

            {/* View Original Link - Mobile */}
            {currentQuestion && (
              <Button asChild variant="outline" size="sm" className="flex-1">
                <a href={currentQuestion.wsi.slide_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  <span className="whitespace-nowrap">View</span>
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Warning Disclaimer */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3">
        <div className="flex items-start gap-2 text-xs sm:text-sm text-red-700">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            AI-generated content without human oversight. May contain incorrect information.
          </span>
        </div>
      </div>
    </div>
  );
}
