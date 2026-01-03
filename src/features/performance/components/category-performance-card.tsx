// src/features/performance/components/category-performance-card.tsx

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Progress } from "@/shared/components/ui/progress";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";

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
        color: "text-green-600",
      };
    case "down":
      return {
        icon: <TrendingDown className="h-4 w-4" />,
        text: "Declining",
        color: "text-red-600",
      };
    default:
      return {
        icon: <Minus className="h-4 w-4" />,
        text: "Stable",
        color: "text-muted-foreground",
      };
  }
};

const getAccuracyColor = (accuracy: number) => {
  if (accuracy >= 80) return "text-green-600";
  if (accuracy >= 70) return "text-yellow-600";
  return "text-red-600";
};

export function CategoryPerformanceCard({ categoryDetails }: CategoryPerformanceCardProps) {
  if (categoryDetails.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Category Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>No category performance data available yet.</p>
            <p className="text-sm mt-2">
              Start taking quizzes to see your performance by category!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Category Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {categoryDetails.map((category, index) => {
            const trendInfo = getTrendInfo(category.trend);

            return (
              <div
                key={category.category_id || index}
                className="py-3 px-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  {/* Category Name */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{category.category_name}</h3>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 ml-4">
                    {/* Score */}
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Score</div>
                      <div className="flex items-baseline gap-1">
                        <span
                          className={`text-2xl font-bold tabular-nums ${getAccuracyColor(category.accuracy)}`}
                        >
                          {category.accuracy}%
                        </span>
                      </div>
                    </div>

                    {/* Questions */}
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Questions</div>
                      <div className="font-medium tabular-nums">
                        {category.correct_attempts} / {category.total_attempts}
                      </div>
                    </div>

                    {/* Trend */}
                    <div className="text-right min-w-[90px]">
                      <div className="text-sm text-muted-foreground">Trend</div>
                      <div
                        className={`flex items-center gap-1 justify-end font-medium ${trendInfo.color}`}
                      >
                        {trendInfo.icon}
                        <span className="text-sm">{trendInfo.text}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <Progress value={category.accuracy} className="h-2" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
