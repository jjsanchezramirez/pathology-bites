// src/features/performance/components/category-performance-card.tsx

import { SectionCard } from "@/shared/components/ui/page-layout";
import { Progress } from "@/shared/components/ui/progress";
import { TrendingUp, TrendingDown, MoveRight, BarChart3 } from "lucide-react";
import { getCategoryByName } from "@/shared/config/categories";

interface CategoryDetail {
  category_id: string;
  category_name: string;
  total_attempts: number;
  correct_attempts: number;
  accuracy: number;
  average_time: number;
  last_attempt_at: string;
  recent_performance: Array<{
    date: string;
    accuracy: number;
    questions_answered: number;
  }>;
  trend?: "up" | "down" | "stable";
}

interface CategoryPerformanceCardProps {
  categoryDetails: CategoryDetail[];
}

const getTrendInfo = (trend?: string) => {
  switch (trend) {
    case "up":
      return {
        icon: <TrendingUp className="h-4 w-4" />,
        text: "Improving",
        color: "text-green-600 dark:text-green-400",
      };
    case "down":
      return {
        icon: <TrendingDown className="h-4 w-4" />,
        text: "Declining",
        color: "text-red-600 dark:text-red-400",
      };
    default:
      return {
        icon: <MoveRight className="h-4 w-4" />,
        text: "Stable",
        color: "text-muted-foreground",
      };
  }
};

const getAccuracyColor = (accuracy: number) => {
  if (accuracy >= 80) return "text-green-600 dark:text-green-400";
  if (accuracy >= 70) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
};

export function CategoryPerformanceCard({ categoryDetails }: CategoryPerformanceCardProps) {
  if (categoryDetails.length === 0) {
    return (
      <SectionCard title="Category Performance" icon={BarChart3}>
        <div className="space-y-2 py-8 text-center text-sm text-muted-foreground">
          <p>No category performance data available yet.</p>
          <p>Start taking quizzes to see your performance by category!</p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Category Performance" icon={BarChart3}>
      <div className="space-y-2">
        {categoryDetails.map((category, index) => {
          const trendInfo = getTrendInfo(category.trend);

          return (
            <div
              key={category.category_id || index}
              className="space-y-2 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center justify-between gap-3 sm:gap-4">
                {/* Category Name - short form on mobile, full on sm+ */}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-medium">
                    <span className="sm:hidden">
                      {getCategoryByName(category.category_name)?.shortForm ||
                        category.category_name}
                    </span>
                    <span className="hidden sm:inline">{category.category_name}</span>
                  </h3>
                </div>

                {/* Stats */}
                <div className="flex shrink-0 items-center gap-3 sm:gap-6">
                  {/* Score */}
                  <div className="text-right">
                    <div className="hidden text-xs text-muted-foreground sm:block">Score</div>
                    <span
                      className={`text-lg font-bold tabular-nums sm:text-2xl ${getAccuracyColor(category.accuracy)}`}
                    >
                      {category.accuracy}%
                    </span>
                  </div>

                  {/* Questions - hidden on mobile */}
                  <div className="hidden sm:block text-right">
                    <div className="text-xs text-muted-foreground">Questions</div>
                    <div className="text-sm font-medium tabular-nums">
                      {category.correct_attempts} / {category.total_attempts}
                    </div>
                  </div>

                  {/* Trend - icon only on mobile, full on sm+ */}
                  <div className="text-right">
                    <div className="hidden text-xs text-muted-foreground sm:block">Trend</div>
                    <div
                      className={`flex items-center gap-1 justify-end font-medium ${trendInfo.color}`}
                    >
                      {trendInfo.icon}
                      <span className="hidden sm:inline text-sm">{trendInfo.text}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <Progress value={category.accuracy} className="h-1.5 sm:h-2" />
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
