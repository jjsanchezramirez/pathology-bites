"use client";

import { Card, CardContent } from "@/shared/components/ui/card";

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
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Total Quizzes</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Completed</div>
          <div className="text-2xl font-bold text-primary">{stats.completed}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">In Progress</div>
          <div className="text-2xl font-bold text-secondary-foreground">{stats.inProgress}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Avg Score</div>
          <div className="text-2xl font-bold">{stats.averageScore}%</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Total Time</div>
          <div className="text-2xl font-bold">{formatTimeSpent(stats.totalTimeSpent)}</div>
        </CardContent>
      </Card>
    </div>
  );
}
