"use client";

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

interface WSIGeneratorSkeletonProps {
  className: string;
  showCategoryFilter: boolean;
  availableCategories: string[];
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  isWSIDataLoading: boolean;
  currentLoadingMessage: string;
}

export function WSIGeneratorSkeleton({
  className,
  showCategoryFilter,
  availableCategories,
  selectedCategory,
  onCategoryChange,
  isWSIDataLoading,
  currentLoadingMessage,
}: WSIGeneratorSkeletonProps) {
  return (
    <div className={`w-full max-w-4xl mx-auto ${className}`} style={{ minHeight: "600px" }}>
      {/* Category Filter */}
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

      <Card className="h-full animate-pulse">
        <CardContent className="space-y-4 pt-6">
          {/* Question text skeleton */}
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded-lg w-3/4" />
            <div className="h-4 bg-muted rounded-lg w-full" />
            <div className="h-4 bg-muted rounded-lg w-5/6" />
            <div className="h-4 bg-muted rounded-lg w-2/3" />
          </div>

          {/* Metadata skeleton */}
          <div className="h-4 bg-muted rounded-lg w-full max-w-md" />

          {/* WSI viewer skeleton */}
          <div className="relative w-full border rounded-lg" style={{ aspectRatio: "16/10" }}>
            <div className="absolute inset-0 bg-muted rounded-lg w-full h-full flex items-center justify-center">
              <div className="text-center space-y-3 max-w-md px-4">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {isWSIDataLoading ? "Loading WSI Data..." : "Generating WSI Question..."}
                  </p>
                  <p className="text-xs text-primary font-medium">
                    {isWSIDataLoading
                      ? "Loading virtual slide database..."
                      : "Preparing your pathology challenge..."}
                  </p>

                  <p className="text-xs text-muted-foreground italic leading-relaxed min-h-[2.5rem] flex items-center justify-center transition-opacity duration-500">
                    {isWSIDataLoading
                      ? "Connecting to virtual slide repository..."
                      : currentLoadingMessage ||
                        "Teaching AI the difference between normal and 'definitely not normal'..."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Options skeleton */}
          <div className="grid gap-2 pt-2">
            {[...Array(5)].map((_, index) => (
              <div
                key={index}
                className="p-2 rounded-md border border-muted flex items-center gap-2"
              >
                <div className="w-5 h-5 rounded-full bg-muted shrink-0" />
                <div className="h-4 bg-muted rounded w-3/4 grow" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
