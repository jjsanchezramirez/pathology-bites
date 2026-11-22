// src/features/questions/components/questions-stats-cards.tsx
"use client";

import { useEffect, useState } from "react";
import {
  StatCard,
  StatCardSkeleton,
  StatGrid,
  type StatTone,
} from "@/shared/components/ui/page-layout";
import { FileQuestion, BookOpen, FolderTree } from "lucide-react";
import { createClient } from "@/shared/services/client";
import { log } from "@/shared/utils/logging";

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
          log.error("Error fetching questions for stats:", error);
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
        log.error("Unexpected error fetching question statistics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [supabase]);

  if (loading) {
    return (
      <StatGrid columns={3}>
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </StatGrid>
    );
  }

  const cards: Array<{
    title: string;
    value: string;
    icon: typeof FileQuestion;
    description: string;
    tone: StatTone;
  }> = [
    {
      title: "Published Questions",
      value: stats.totalPublishedQuestions.toLocaleString(),
      icon: FileQuestion,
      description: "Total published",
      tone: "info",
    },
    {
      title: "Question Sets",
      value: stats.totalQuestionSetsWithQuestions.toLocaleString(),
      icon: BookOpen,
      description: "Sets with questions",
      tone: "success",
    },
    {
      title: "Categories",
      value: stats.totalCategoriesWithQuestions.toLocaleString(),
      icon: FolderTree,
      description: "Categories with questions",
      tone: "default",
    },
  ];

  return (
    <StatGrid columns={3}>
      {cards.map((card) => (
        <StatCard
          key={card.title}
          label={card.title}
          value={card.value}
          icon={card.icon}
          hint={card.description}
          tone={card.tone}
        />
      ))}
    </StatGrid>
  );
}
