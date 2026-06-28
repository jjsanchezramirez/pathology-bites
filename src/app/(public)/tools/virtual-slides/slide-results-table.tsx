"use client";

import { Card, CardContent } from "@/shared/components/ui/card";
import { SlideRowUnified } from "@/features/public/tools/virtual-slides/components/slide-row-unified";
import { Pagination } from "@/features/public/tools/virtual-slides/components/pagination";
import { LoadingSkeleton } from "@/features/public/tools/virtual-slides/components/loading-skeleton";
import { getRelatedSlides } from "@/shared/hooks/use-client-virtual-slides";
import type { VirtualSlide } from "@/shared/types/virtual-slides";

interface SlideResultsTableProps {
  isInitialLoading: boolean;
  displaySlides: VirtualSlide[];
  mode: "search" | "study";
  showDiagnoses: boolean;
  revealedDiagnoses: Set<string>;
  onToggleReveal: (slideId: string) => void;
  onOpenViewer: (slide: VirtualSlide) => void;
  onOpenViewerAt: (slide: VirtualSlide, slideName: string) => void;
  onOpenRelated: (slide: VirtualSlide) => void;
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (n: number) => void;
}

export function SlideResultsTable({
  isInitialLoading,
  displaySlides,
  mode,
  showDiagnoses,
  revealedDiagnoses,
  onToggleReveal,
  onOpenViewer,
  onOpenViewerAt,
  onOpenRelated,
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
  onPageChange,
  onItemsPerPageChange,
}: SlideResultsTableProps) {
  if (isInitialLoading) {
    return (
      <section className="relative py-4 md:py-8">
        <div className="container px-4 mx-auto max-w-6xl">
          <Card className="shadow-lg">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left p-2 md:p-4 font-semibold w-20 md:w-24">Preview</th>
                      <th className="text-left p-2 md:p-4 font-semibold">Slide Info</th>
                      {/* Site column (Category + Organ) - visible on desktop (lg+) */}
                      <th className="text-left p-2 md:p-4 font-semibold w-32 md:w-40 hidden lg:table-cell">
                        Site
                      </th>
                      <th className="text-left p-2 md:p-4 font-semibold w-20 md:w-32 hidden md:table-cell">
                        Repository
                      </th>
                      <th className="text-left p-2 md:p-4 font-semibold w-16 md:w-40">Actions</th>
                    </tr>
                  </thead>
                  <LoadingSkeleton variant="table" />
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  if (displaySlides.length === 0) return null;

  return (
    <section className="relative py-4 md:py-8">
      <div className="container px-4 mx-auto max-w-6xl">
        <Card className="shadow-lg">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-2 md:p-4 font-semibold w-20 md:w-24">Preview</th>
                    <th className="text-left p-2 md:p-4 font-semibold">Slide Info</th>
                    <th className="text-left p-2 md:p-4 font-semibold w-20 md:w-32 hidden md:table-cell">
                      Repository
                    </th>
                    <th className="text-left p-2 md:p-4 font-semibold w-16 md:w-40">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displaySlides.map((slide, index) => (
                    <SlideRowUnified
                      key={`${slide.id}-${index}`}
                      slide={slide}
                      index={index}
                      showDiagnoses={showDiagnoses}
                      isRevealed={revealedDiagnoses.has(slide.id)}
                      onToggleReveal={() => onToggleReveal(slide.id)}
                      related={getRelatedSlides(slide)}
                      onOpenViewer={() => onOpenViewer(slide)}
                      onOpenViewerAt={(slideName) => onOpenViewerAt(slide, slideName)}
                      onOpenRelated={(r) => onOpenRelated(r)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {mode === "search" && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                totalItems={totalItems}
                onPageChange={onPageChange}
                onItemsPerPageChange={onItemsPerPageChange}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
