// src/features/questions/components/questions-stats-cards.tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { FileQuestion, FolderTree, Package, Image, Flag, TrendingUp } from "lucide-react";
import { toast } from "@/shared/utils/toast";

interface QuestionStats {
  totalQuestions: number;
  totalCategoriesWithQuestions: number;
  totalQuestionSetsWithQuestions: number;
  totalQuestionsWithImages: number;
  flaggedQuestions: number;
  recentQuestions: number;
  statusBreakdown: Record<string, number>;
}

export function QuestionsStatsCards() {
  const [stats, setStats] = useState<QuestionStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/admin/questions/stats", {
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch statistics");
      }
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      } else {
        throw new Error(data.error || "Failed to fetch statistics");
      }
    } catch (error) {
      console.error("Error fetching question statistics:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load statistics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading statistics...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const cards = [
    {
      title: "Total Questions",
      value: stats.totalQuestions.toLocaleString(),
      icon: FileQuestion,
      description: "Questions in database",
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Categories",
      value: stats.totalCategoriesWithQuestions.toLocaleString(),
      icon: FolderTree,
      description: "Categories with questions",
      color: "text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Question Sets",
      value: stats.totalQuestionSetsWithQuestions.toLocaleString(),
      icon: Package,
      description: "Sets with questions",
      color: "text-purple-600 dark:text-purple-400",
    },
    {
      title: "With Images",
      value: stats.totalQuestionsWithImages.toLocaleString(),
      icon: Image,
      description: "Questions with images",
      color: "text-orange-600 dark:text-orange-400",
    },
  ];

  // Add conditional cards
  if (stats.flaggedQuestions > 0) {
    cards.push({
      title: "Flagged",
      value: stats.flaggedQuestions.toLocaleString(),
      icon: Flag,
      description: "Questions flagged for review",
      color: "text-red-600 dark:text-red-400",
    });
  }

  if (stats.recentQuestions > 0) {
    cards.push({
      title: "Recent (7 days)",
      value: stats.recentQuestions.toLocaleString(),
      icon: TrendingUp,
      description: "Questions created recently",
      color: "text-cyan-600 dark:text-cyan-400",
    });
  }

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
