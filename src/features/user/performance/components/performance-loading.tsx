// src/features/performance/components/performance-loading.tsx

import { PageHeader } from "@/shared/components/ui/page-header";
import { ContentGrid, PageContainer, SectionCard } from "@/shared/components/ui/page-layout";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/utils";

// Inline placeholder for SectionCard title/description slots (they render inside
// <h2>/<p>, so this must be a span rather than Skeleton's div).
function HeadingSkeleton({ className }: { className: string }) {
  return <span className={cn("block animate-pulse rounded-md bg-muted", className)} />;
}

// Mirrors the loaded performance page: header, overview cards, timeline + radar,
// activity calendar, then the category breakdown.
export function PerformanceLoading() {
  return (
    <PageContainer>
      <PageHeader
        title="Performance Analytics"
        description="Detailed insights into your learning progress and areas for improvement."
      />

      {/* Performance Overview Skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SectionCard
            key={i}
            title={<HeadingSkeleton className="h-5 w-32" />}
            contentClassName="flex flex-col items-center justify-center"
          >
            <Skeleton className="h-[120px] w-[120px] rounded-full" />
            <Skeleton className="h-3 w-40" />
          </SectionCard>
        ))}
      </div>

      {/* Performance Charts Skeleton */}
      <ContentGrid>
        {Array.from({ length: 2 }).map((_, i) => (
          <SectionCard
            key={i}
            title={<HeadingSkeleton className="h-5 w-40" />}
            description={<HeadingSkeleton className="h-4 w-56" />}
          >
            <Skeleton className="h-[400px] w-full" />
          </SectionCard>
        ))}
      </ContentGrid>

      {/* Activity Calendar Skeleton */}
      <SectionCard
        title={<HeadingSkeleton className="h-5 w-40" />}
        description={<HeadingSkeleton className="h-4 w-32" />}
      >
        <Skeleton className="h-[120px] w-full" />
      </SectionCard>

      {/* Category Breakdown Skeleton */}
      <SectionCard title={<HeadingSkeleton className="h-5 w-48" />}>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-24" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      </SectionCard>
    </PageContainer>
  );
}
