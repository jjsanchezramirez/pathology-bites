"use client";

import { Button } from "@/shared/components/ui/button";
import { Microscope } from "lucide-react";

interface NoResultsSectionProps {
  hasActiveFilters: boolean;
  hasAnyFilterOrSearch: boolean;
  onClearFilters: () => void;
}

export function NoResultsSection({
  hasActiveFilters,
  hasAnyFilterOrSearch,
  onClearFilters,
}: NoResultsSectionProps) {
  return (
    <section className="relative py-16">
      <div className="container px-4 mx-auto max-w-4xl text-center">
        <div className="space-y-4">
          <Microscope className="h-16 w-16 text-muted-foreground mx-auto" />
          <h3 className="text-xl font-semibold">No slides found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search terms
            {hasActiveFilters && " or filters"} to find more results.
          </p>
          {hasAnyFilterOrSearch && (
            <Button onClick={onClearFilters} variant="outline">
              Clear All Filters
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
