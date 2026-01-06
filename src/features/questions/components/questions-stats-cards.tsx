// src/features/questions/components/questions-stats-cards.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { FileQuestion, BookOpen, Users, CheckCircle } from "lucide-react";

export function QuestionsStatsCards() {
  // Simple placeholder cards - no data fetching
  const cards = [
    {
      title: "Questions",
      value: "—",
      icon: FileQuestion,
      description: "See table below",
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Question Sets",
      value: "—",
      icon: BookOpen,
      description: "Filter to view",
      color: "text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Categories",
      value: "—",
      icon: Users,
      description: "Multiple available",
      color: "text-purple-600 dark:text-purple-400",
    },
    {
      title: "Status",
      value: "—",
      icon: CheckCircle,
      description: "Filter to view",
      color: "text-orange-600 dark:text-orange-400",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <Icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
