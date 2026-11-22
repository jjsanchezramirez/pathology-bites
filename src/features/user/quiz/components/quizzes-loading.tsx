"use client";

import { Card, CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { PageHeader } from "@/shared/components/ui/page-header";
import {
  PageContainer,
  SectionCard,
  StatCardSkeleton,
  StatGrid,
  Toolbar,
} from "@/shared/components/ui/page-layout";

export function QuizzesLoading() {
  return (
    <PageContainer>
      <PageHeader
        title="My Quizzes"
        description="Loading your quiz history..."
        actions={<Skeleton className="h-10 w-28" />}
      />

      {/* Stats Skeleton — mirrors QuizStatsCards */}
      <StatGrid className="lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <StatCardSkeleton key={i} className={i === 0 ? "col-span-2 lg:col-span-1" : undefined} />
        ))}
      </StatGrid>

      {/* Filters Skeleton — mirrors QuizFilters */}
      <SectionCard>
        <Toolbar>
          <Skeleton className="h-10 w-full sm:min-w-[12rem] sm:flex-1" />
          <Skeleton className="h-10 w-full sm:w-48" />
          <Skeleton className="h-10 w-full sm:w-48" />
        </Toolbar>
      </SectionCard>

      {/* Quiz List Skeleton — mirrors the full-width QuizCard rows */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center justify-between gap-2 md:justify-start">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <Skeleton key={j} className="h-3.5 w-16" />
                    ))}
                  </div>
                </div>
                <Skeleton className="h-9 w-full shrink-0 md:w-[180px]" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
