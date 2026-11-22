"use client";

import { CheckCircle2, Clock, Hash, Timer, Trophy } from "lucide-react";

import { StatCard, StatGrid } from "@/shared/components/ui/page-layout";

interface QuizStatsCardsProps {
  stats: {
    total: number;
    completed: number;
    inProgress: number;
    averageScore: number;
    totalTimeSpent: number;
  };
  formatTimeSpent: (seconds: number) => string;
}

export function QuizStatsCards({ stats, formatTimeSpent }: QuizStatsCardsProps) {
  return (
    // Five stats: two per row on phones, all five in one row from `lg`.
    <StatGrid className="lg:grid-cols-5">
      <StatCard
        label="Total Quizzes"
        value={stats.total}
        icon={Hash}
        className="col-span-2 lg:col-span-1"
      />
      <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} tone="success" />
      <StatCard label="In Progress" value={stats.inProgress} icon={Clock} tone="warning" />
      <StatCard label="Avg Score" value={`${stats.averageScore}%`} icon={Trophy} tone="info" />
      <StatCard label="Total Time" value={formatTimeSpent(stats.totalTimeSpent)} icon={Timer} />
    </StatGrid>
  );
}
