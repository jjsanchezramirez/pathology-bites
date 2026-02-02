// src/features/questions/components/questions-stats-cards.tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { FileQuestion, BookOpen, FolderTree } from "lucide-react";
import { createClient } from "@/shared/services/client";

interface QuestionStats {
  totalPublishedQuestions: number;
  totalQuestionSetsWithQuestions: number;
  totalCategoriesWithQuestions: number;
}

export function QuestionsStatsCards() {
  const [stats, setStats] = useState<QuestionStats>({
    totalPublishedQuestions: 0,
    totalQuestionSetsWithQuestions: 0,
    totalCategoriesWithQuestions: 0,
  });
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);

        // Get all questions
        const { data: questions, error } = await supabase
          .from("questions")
          .select("status, question_set_id, category_id");

        if (error) {
          console.error("Error fetching questions for stats:", error);
          return;
        }

        const questionsData = questions || [];

        // Calculate statistics
        const totalPublishedQuestions = questionsData.filter(
          (q) => q.status === "published"
        ).length;

        const uniqueQuestionSets = new Set(
          questionsData.filter((q) => q.question_set_id).map((q) => q.question_set_id)
        );
        const totalQuestionSetsWithQuestions = uniqueQuestionSets.size;

        const uniqueCategories = new Set(
          questionsData.filter((q) => q.category_id).map((q) => q.category_id)
        );
        const totalCategoriesWithQuestions = uniqueCategories.size;

        setStats({
          totalPublishedQuestions,
          totalQuestionSetsWithQuestions,
          totalCategoriesWithQuestions,
        });
      } catch (error) {
        console.error("Unexpected error fetching question statistics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [supabase]);

  if (loading) {
    return null;
  }

  const cards = [
    {
      title: "Published Questions",
      value: stats.totalPublishedQuestions.toLocaleString(),
      icon: FileQuestion,
      description: "Total published",
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Question Sets",
      value: stats.totalQuestionSetsWithQuestions.toLocaleString(),
      icon: BookOpen,
      description: "Sets with questions",
      color: "text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Categories",
      value: stats.totalCategoriesWithQuestions.toLocaleString(),
      icon: FolderTree,
      description: "Categories with questions",
      color: "text-purple-600 dark:text-purple-400",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
