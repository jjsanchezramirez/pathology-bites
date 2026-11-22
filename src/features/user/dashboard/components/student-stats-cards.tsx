"use client";

import { StatCard, StatCardSkeleton, StatGrid } from "@/shared/components/ui/page-layout";
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
    <StatGrid>
      <StatCard
        label="Needs Review"
        value={stats.needsReview || 0}
        icon={BookOpen}
        tone="danger"
        hint="Questions to practice more"
      />
      <StatCard
        label="Mastered"
        value={stats.mastered || 0}
        icon={Target}
        tone="success"
        hint="Questions answered correctly"
      />
      <StatCard
        label="Unused"
        value={stats.unused || 0}
        icon={TrendingUp}
        tone="info"
        hint="Questions to explore"
      />
      <StatCard
        label="Completed"
        value={stats.completedQuestions || 0}
        icon={Calendar}
        hint="Questions attempted"
      />
    </StatGrid>
  );
}

export function StudentStatsCardsLoading() {
  return (
    <StatGrid>
      {Array.from({ length: 4 }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </StatGrid>
  );
}
