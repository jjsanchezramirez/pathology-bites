"use client";

import { Skeleton } from "@/shared/components/ui/skeleton";
import { Separator } from "@/shared/components/ui/separator";
import { PageHeader } from "@/shared/components/ui/page-header";
import { PageContainer, SectionCard } from "@/shared/components/ui/page-layout";

// Mirrors the New Quiz page: narrow PageContainer, PageHeader, one SectionCard
// whose sections are split by separators.
export function NewQuizLoading() {
  return (
    <PageContainer width="narrow">
      <PageHeader title="New Quiz" description="Loading quiz options..." />

      <SectionCard contentClassName="space-y-6">
        {/* Quiz Name Skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>

        <Separator />

        {/* Question Count Skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-4 w-32" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>

        <Separator />

        {/* Mode & Timing Skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-4 w-32" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-4">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Question Type and Category Selection Skeleton */}
        <div className="space-y-6">
          <div className="space-y-4">
            <Skeleton className="h-4 w-24" />
            <div className="grid grid-cols-1 gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-1 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
        </div>

        <Separator />

        {/* Start Button Skeleton */}
        <Skeleton className="h-10 w-full" />
      </SectionCard>
    </PageContainer>
  );
}
