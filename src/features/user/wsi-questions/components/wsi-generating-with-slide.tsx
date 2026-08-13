"use client";

/**
 * Generating state for when the slide is already known.
 *
 * The slide is chosen client-side in ~0ms, but its tiles take seconds to load
 * and the question text takes seconds to generate. The plain skeleton hid both,
 * so those two waits ran back to back. Rendering the real viewer here starts
 * the tile fetch during generation instead of after it — the reader can begin
 * reading the histology while the stem is still being written.
 *
 * Only the question text is skeletonised, because only the question text is
 * actually still unknown.
 */

import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Loader2 } from "lucide-react";
import { WSIViewer } from "@/shared/components/common/wsi-viewer";
import { WSISlideCredits } from "./wsi-slide-credits";
import type { VirtualSlide } from "@/shared/types/virtual-slides";

interface WSIGeneratingWithSlideProps {
  className: string;
  slide: VirtualSlide;
  showCategoryFilter: boolean;
  availableCategories: string[];
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  currentLoadingMessage: string;
}

export function WSIGeneratingWithSlide({
  className,
  slide,
  showCategoryFilter,
  availableCategories,
  selectedCategory,
  onCategoryChange,
  currentLoadingMessage,
}: WSIGeneratingWithSlideProps) {
  return (
    <div className={`w-full max-w-4xl mx-auto ${className}`} style={{ minHeight: "600px" }}>
      {showCategoryFilter && availableCategories.length > 0 && (
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Category:</label>
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
          <Button disabled>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating...
          </Button>
        </div>
      )}

      <Card className="h-full">
        <CardContent className="space-y-3 sm:space-y-4 pt-4 sm:pt-6 px-3 sm:px-6">
          {/* Stem placeholder — the only part still unknown. */}
          <div className="space-y-2 animate-pulse" aria-hidden="true">
            <div className="h-4 bg-muted rounded-lg w-3/4" />
            <div className="h-4 bg-muted rounded-lg w-full" />
            <div className="h-4 bg-muted rounded-lg w-5/6" />
          </div>

          <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            {currentLoadingMessage || "Writing your question…"}
          </p>

          {/* The real viewer — tiles start loading now, not after generation. */}
          <div className="w-full">
            <WSIViewer slide={slide} showMetadata={false} />
            <WSISlideCredits wsi={slide} />
          </div>

          {/* Answer option placeholders. */}
          <div className="space-y-2 animate-pulse" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-muted rounded-lg w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
