"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { BookOpen, Target, TrendingUp, Calendar } from "lucide-react";

interface StudentStatsCardsProps {
  stats: {
    needsReview?: number;
    mastered?: number;
    unused?: number;
    completedQuestions: number;
  };
}

export function StudentStatsCards({ stats }: StudentStatsCardsProps) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
          <BookOpen className="h-4 w-4 text-[hsl(var(--chart-5))]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[hsl(var(--chart-5))]">
            {stats.needsReview || 0}
          </div>
          <p className="text-xs text-muted-foreground">Questions to practice more</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Mastered</CardTitle>
          <Target className="h-4 w-4 text-[hsl(var(--chart-1))]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[hsl(var(--chart-1))]">{stats.mastered || 0}</div>
          <p className="text-xs text-muted-foreground">Questions answered correctly</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Unused</CardTitle>
          <TrendingUp className="h-4 w-4 text-[hsl(var(--chart-2))]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[hsl(var(--chart-2))]">{stats.unused || 0}</div>
          <p className="text-xs text-muted-foreground">Questions to explore</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completed</CardTitle>
          <Calendar className="h-4 w-4 text-[hsl(var(--chart-3))]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[hsl(var(--chart-3))]">
            {stats.completedQuestions || 0}
          </div>
          <p className="text-xs text-muted-foreground">Questions attempted</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function StudentStatsCardsLoading() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
