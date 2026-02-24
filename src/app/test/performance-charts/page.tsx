// src/app/test/performance-charts/page.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
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
import {
  LollipopChart,
  PolarAreaChart,
  TreemapChart,
  HeatmapMatrix,
  RadialBarChart,
  BulletChart,
} from "@/features/user/performance/components/alternative-charts";
import { TrendingUp, Target, Award, Zap, Clock, CheckCircle2 } from "lucide-react";

// Simple seeded random number generator for consistent results
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

// Mock data generators with seeded randomness
function generateTimelineData() {
  const data = [];
  const today = new Date("2024-03-15"); // Fixed date for consistency

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Generate realistic accuracy that trends upward (using seed based on day)
    const baseAccuracy = 60 + (29 - i) * 1.2;
    const randomVariation = seededRandom(i * 100) * 15 - 7.5;
    const accuracy = Math.min(100, Math.max(40, baseAccuracy + randomVariation));

    // Seeded random number of quizzes per day (0-5)
    const quizzes = Math.floor(seededRandom(i * 200) * 6);

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

  return categories.map((name, index) => ({
    category_name: name,
    accuracy: Math.round((60 + seededRandom(index * 300) * 35) * 10) / 10,
  }));
}

function generateHeatmapData() {
  const data = [];
  const today = new Date("2024-03-15"); // Fixed date for consistency

  // Generate last 90 days of activity
  for (let i = 89; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // More activity on weekdays, less on weekends
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const baseQuestions = isWeekend ? 5 : 25;
    const questions = Math.floor(seededRandom(i * 400) * baseQuestions);
    const quizzes = Math.floor(questions / 10);

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
  delay = 0,
}: {
  icon: any;
  title: string;
  value: string | number;
  description: string;
  trend?: string;
  delay?: number;
}) {
  return (
    <Card
      className="hover:shadow-lg transition-all duration-300 hover:scale-[1.02]"
      style={{
        animation: `fadeInUp 0.6s ease-out ${delay}s both`,
      }}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground transition-colors duration-300 group-hover:text-accent" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {trend && (
          <p className="text-xs text-accent font-medium mt-1 animate-pulse">{trend}</p>
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
      <div
        style={{
          animation: "fadeInUp 0.5s ease-out both",
        }}
      >
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
          delay={0.1}
        />
        <StatCard
          icon={CheckCircle2}
          title="Total Quizzes"
          value={totalQuizzes}
          description="Last 30 days"
          delay={0.2}
        />
        <StatCard
          icon={Award}
          title="Strongest Category"
          value={`${strongestCategory.accuracy}%`}
          description={strongestCategory.category_name}
          delay={0.3}
        />
        <StatCard
          icon={Zap}
          title="Current Streak"
          value={`${heatmapStats.currentStreak} days`}
          description={`Longest: ${heatmapStats.longestStreak} days`}
          delay={0.4}
        />
      </div>

      {/* Charts Row 1 */}
      <div
        className="grid gap-6 grid-cols-1 xl:grid-cols-2"
        style={{
          animation: "fadeInUp 0.6s ease-out 0.5s both",
        }}
      >
        <PerformanceTimelineChart data={timelineData} />
        <CategoryRadarChart data={categoryData} />
      </div>

      {/* Heatmap */}
      <div
        style={{
          animation: "fadeInUp 0.6s ease-out 0.6s both",
        }}
      >
        <ActivityHeatmap data={heatmapData} stats={heatmapStats} />
      </div>

      {/* Insights Cards */}
      <div
        className="grid gap-4 md:grid-cols-2"
        style={{
          animation: "fadeInUp 0.6s ease-out 0.7s both",
        }}
      >
        <Card className="hover:shadow-lg transition-all duration-300">
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
                  <div
                    key={i}
                    className="flex items-center justify-between hover:bg-accent/5 p-2 rounded-md transition-colors duration-200"
                    style={{
                      animation: `fadeIn 0.4s ease-out ${0.8 + i * 0.1}s both`,
                    }}
                  >
                    <span className="text-sm font-medium">{category.category_name}</span>
                    <span className="text-sm text-accent font-semibold tabular-nums">
                      {category.accuracy}%
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300">
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
                  <div
                    key={i}
                    className="flex items-center justify-between hover:bg-muted/50 p-2 rounded-md transition-colors duration-200"
                    style={{
                      animation: `fadeIn 0.4s ease-out ${0.8 + i * 0.1}s both`,
                    }}
                  >
                    <span className="text-sm font-medium">{category.category_name}</span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {category.accuracy}%
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alternative Chart Visualizations Section */}
      <div
        style={{
          animation: "fadeInUp 0.6s ease-out 0.8s both",
        }}
      >
        <h2 className="text-2xl font-bold tracking-tight mb-4">
          Alternative Visualizations
        </h2>
        <p className="text-muted-foreground mb-6">
          Different ways to visualize the same category performance data
        </p>
      </div>

      {/* Alternative Charts Grid */}
      <div
        className="grid gap-6 grid-cols-1 xl:grid-cols-2"
        style={{
          animation: "fadeInUp 0.6s ease-out 0.9s both",
        }}
      >
        <LollipopChart data={categoryData} />
        <PolarAreaChart data={categoryData} />
      </div>

      <div
        className="grid gap-6 grid-cols-1 xl:grid-cols-2"
        style={{
          animation: "fadeInUp 0.6s ease-out 1s both",
        }}
      >
        <TreemapChart data={categoryData} />
        <HeatmapMatrix data={categoryData} />
      </div>

      <div
        className="grid gap-6 grid-cols-1 xl:grid-cols-2"
        style={{
          animation: "fadeInUp 0.6s ease-out 1.1s both",
        }}
      >
        <RadialBarChart data={categoryData} />
        <BulletChart data={categoryData} />
      </div>

      {/* Debug Info */}
      <Card
        className="border-dashed hover:border-solid transition-all duration-300"
        style={{
          animation: "fadeIn 0.5s ease-out 1.2s both",
        }}
      >
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
