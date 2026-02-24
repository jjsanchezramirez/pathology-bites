// src/app/test/performance-charts/page.tsx
"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  PerformanceTimelineChart,
  CategoryRadarChart,
  ActivityHeatmap,
} from "@/features/user/performance/components/interactive-charts";
import { TrendingUp, Target, Award, Zap, Clock, CheckCircle2 } from "lucide-react";

// Mock data generators
function generateTimelineData() {
  const data = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Generate realistic accuracy that trends upward
    const baseAccuracy = 60 + (29 - i) * 1.2; // Starts at ~60%, improves over time
    const randomVariation = Math.random() * 15 - 7.5; // ±7.5% variation
    const accuracy = Math.min(100, Math.max(40, baseAccuracy + randomVariation));

    // Random number of quizzes per day (0-5)
    const quizzes = Math.floor(Math.random() * 6);

    data.push({
      date: date.toISOString().split("T")[0],
      accuracy: Math.round(accuracy * 10) / 10,
      quizzes,
    });
  }

  return data;
}

function generateCategoryData() {
  const categories = [
    "Hematopathology",
    "Surgical Pathology",
    "Cytopathology",
    "Clinical Chemistry",
    "Microbiology",
    "Molecular Diagnostics",
    "Immunology",
    "Transfusion Medicine",
  ];

  return categories.map((name) => ({
    category_name: name,
    accuracy: Math.round((60 + Math.random() * 35) * 10) / 10, // 60-95%
  }));
}

function generateHeatmapData() {
  const data = [];
  const today = new Date();

  // Generate last 90 days of activity
  for (let i = 89; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // More activity on weekdays, less on weekends
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const baseQuestions = isWeekend ? 5 : 25;
    const questions = Math.floor(Math.random() * baseQuestions);
    const quizzes = Math.floor(questions / 10); // ~10 questions per quiz

    data.push({
      date: date.toISOString().split("T")[0],
      questions,
      quizzes,
    });
  }

  return data;
}

function calculateHeatmapStats(data: Array<{ questions: number; quizzes: number }>) {
  const daysWithActivity = data.filter((d) => d.questions > 0).length;
  const totalQuestions = data.reduce((sum, d) => sum + d.questions, 0);
  const totalQuizzes = data.reduce((sum, d) => sum + d.quizzes, 0);

  // Calculate streaks
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i].questions > 0) {
      tempStreak++;
      if (i === data.length - 1 || currentStreak > 0) {
        currentStreak++;
      }
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 0;
      if (i === data.length - 1) {
        currentStreak = 0;
      }
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  return {
    avgQuestionsPerDay: Math.round(totalQuestions / data.length),
    avgQuizzesPerDay: (totalQuizzes / data.length).toFixed(1),
    longestStreak,
    currentStreak,
    totalQuestions,
    totalQuizzes,
    daysWithActivity,
  };
}

function StatCard({
  icon: Icon,
  title,
  value,
  description,
  trend,
}: {
  icon: any;
  title: string;
  value: string | number;
  description: string;
  trend?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {trend && (
          <p className="text-xs text-accent font-medium mt-1">{trend}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function PerformanceChartsTestPage() {
  // Generate all mock data
  const timelineData = useMemo(() => generateTimelineData(), []);
  const categoryData = useMemo(() => generateCategoryData(), []);
  const heatmapData = useMemo(() => generateHeatmapData(), []);
  const heatmapStats = useMemo(() => calculateHeatmapStats(heatmapData), [heatmapData]);

  // Calculate summary stats
  const overallAccuracy = useMemo(() => {
    const recentData = timelineData.filter((d) => d.quizzes > 0).slice(-7);
    const avg = recentData.reduce((sum, d) => sum + d.accuracy, 0) / recentData.length;
    return Math.round(avg * 10) / 10;
  }, [timelineData]);

  const totalQuizzes = useMemo(
    () => timelineData.reduce((sum, d) => sum + d.quizzes, 0),
    [timelineData]
  );

  const improvementRate = useMemo(() => {
    const firstWeek = timelineData.slice(0, 7).filter((d) => d.quizzes > 0);
    const lastWeek = timelineData.slice(-7).filter((d) => d.quizzes > 0);

    if (firstWeek.length === 0 || lastWeek.length === 0) return 0;

    const firstAvg = firstWeek.reduce((sum, d) => sum + d.accuracy, 0) / firstWeek.length;
    const lastAvg = lastWeek.reduce((sum, d) => sum + d.accuracy, 0) / lastWeek.length;

    return Math.round(((lastAvg - firstAvg) / firstAvg) * 100);
  }, [timelineData]);

  const strongestCategory = useMemo(() => {
    const sorted = [...categoryData].sort((a, b) => b.accuracy - a.accuracy);
    return sorted[0];
  }, [categoryData]);

  const weakestCategory = useMemo(() => {
    const sorted = [...categoryData].sort((a, b) => a.accuracy - b.accuracy);
    return sorted[0];
  }, [categoryData]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Performance Dashboard</h1>
        <p className="text-muted-foreground">
          Comprehensive analytics for your learning journey (Mock Data)
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Target}
          title="Overall Accuracy"
          value={`${overallAccuracy}%`}
          description="Last 7 days average"
          trend={improvementRate > 0 ? `↑ ${improvementRate}% improvement` : undefined}
        />
        <StatCard
          icon={CheckCircle2}
          title="Total Quizzes"
          value={totalQuizzes}
          description="Last 30 days"
        />
        <StatCard
          icon={Award}
          title="Strongest Category"
          value={`${strongestCategory.accuracy}%`}
          description={strongestCategory.category_name}
        />
        <StatCard
          icon={Zap}
          title="Current Streak"
          value={`${heatmapStats.currentStreak} days`}
          description={`Longest: ${heatmapStats.longestStreak} days`}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PerformanceTimelineChart data={timelineData} />
        <CategoryRadarChart data={categoryData} />
      </div>

      {/* Heatmap */}
      <ActivityHeatmap data={heatmapData} stats={heatmapStats} />

      {/* Insights Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Strengths
            </CardTitle>
            <CardDescription>Categories where you excel</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {categoryData
                .filter((c) => c.accuracy >= 80)
                .sort((a, b) => b.accuracy - a.accuracy)
                .slice(0, 3)
                .map((category, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{category.category_name}</span>
                    <span className="text-sm text-accent font-semibold">
                      {category.accuracy}%
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Focus Areas
            </CardTitle>
            <CardDescription>Categories needing more practice</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {categoryData
                .filter((c) => c.accuracy < 80)
                .sort((a, b) => a.accuracy - b.accuracy)
                .slice(0, 3)
                .map((category, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{category.category_name}</span>
                    <span className="text-sm text-muted-foreground">
                      {category.accuracy}%
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Debug Info */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-sm">Debug Info</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p>Timeline data points: {timelineData.length}</p>
          <p>Categories: {categoryData.length}</p>
          <p>Heatmap days: {heatmapData.length}</p>
          <p>Total questions (90 days): {heatmapStats.totalQuestions}</p>
          <p>Days with activity: {heatmapStats.daysWithActivity}</p>
        </CardContent>
      </Card>
    </div>
  );
}
