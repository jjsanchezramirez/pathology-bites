import { Skeleton } from "@/shared/components/ui/skeleton";
import { SectionCard, StatCardSkeleton, StatGrid } from "@/shared/components/ui/page-layout";

// Mirrors QuizResultsSummary: header, hero score card, StatGrid, category table,
// per-question list, actions. Width comes from the page's PageContainer.
export function QuizResultsSkeleton() {
  return (
    <div className="w-full space-y-6">
      {/* Header Skeleton */}
      <div className="space-y-1 text-center">
        <Skeleton className="mx-auto h-8 w-48 sm:h-9" />
        <Skeleton className="mx-auto h-5 w-64 max-w-full" />
      </div>

      {/* Main Score Display Skeleton */}
      <SectionCard contentClassName="text-center">
        <div className="flex justify-center">
          <div className="relative">
            <Skeleton className="h-40 w-40 rounded-full" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <Skeleton className="mx-auto h-8 w-64 max-w-full" />
          <Skeleton className="mx-auto h-5 w-48 max-w-full" />
        </div>
      </SectionCard>

      {/* Metrics Grid Skeleton */}
      <StatGrid>
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </StatGrid>

      {/* Category Breakdown Skeleton */}
      <SectionCard flush title="Performance by Category">
        <div className="divide-y">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
              <Skeleton className="h-5 w-28" />
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-6" />
                <Skeleton className="h-4 w-6" />
                <Skeleton className="hidden h-4 w-6 md:block" />
                <Skeleton className="hidden h-4 w-10 md:block" />
                <Skeleton className="h-4 w-10" />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Question Breakdown Skeleton */}
      <SectionCard title="Performance by Question">
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
              <Skeleton className="h-8 w-8 shrink-0" />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Action Buttons Skeleton */}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Skeleton className="h-10 w-full sm:w-[200px]" />
        <Skeleton className="h-10 w-full sm:w-[200px]" />
      </div>
    </div>
  );
}
