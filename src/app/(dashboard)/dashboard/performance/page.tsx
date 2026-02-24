// src/app/(dashboard)/dashboard/performance/page.tsx
"use client";

import { useMemo } from "react";

import { PerformanceAnalytics } from "@/features/user/dashboard/components";
import {
  PerformanceLoading,
  CategoryPerformanceCard,
} from "@/features/user/performance/components";
import {
  PerformanceTimelineChart,
  CategoryRadarChart,
  ActivityHeatmap,
} from "@/features/user/performance/components/interactive-charts";
import { useUnifiedData } from "@/shared/hooks/use-unified-data";
import { ScrollReveal } from "@/shared/components/common";

export default function PerformancePage() {
  const { data: unifiedData, isLoading } = useUnifiedData();

  // Memoize transformed data to prevent unnecessary recalculations
  const performanceData = useMemo(() => {
    if (!unifiedData) return null;

    return {
      userPercentile: unifiedData.summary.userPercentile,
      peerRank: unifiedData.summary.peerRank,
      totalUsers: unifiedData.summary.totalUsers,
      completedQuizzes: unifiedData.summary.completedQuizzes,
      subjectsForImprovement: unifiedData.subjects.needsImprovement,
      subjectsMastered: unifiedData.subjects.mastered,
      overallScore: unifiedData.summary.overallScore,
    };
  }, [unifiedData]);

  const radarChartData = useMemo(() => {
    if (!unifiedData?.categories) return [];

    return unifiedData.categories.map((cat) => ({
      category_name: cat.category_name,
      accuracy: cat.accuracy,
    }));
  }, [unifiedData?.categories]);

  // Handle loading state
  if (isLoading) {
    return <PerformanceLoading />;
  }

  // Handle empty state
  if (!performanceData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Performance Analytics</h1>
          <p className="text-muted-foreground">
            No performance data available yet. Start taking quizzes to see your analytics!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Performance Analytics</h1>
        <p className="text-muted-foreground">
          Detailed insights into your learning progress and areas for improvement.
        </p>
      </div>

      {/* Performance Overview Cards */}
      <ScrollReveal animation="fade-up">
        <PerformanceAnalytics data={performanceData} />
      </ScrollReveal>

      {/* Interactive Charts */}
      <ScrollReveal animation="fade-up">
        <div className="grid gap-6 lg:grid-cols-2">
          <PerformanceTimelineChart data={unifiedData.timeline} />
          <CategoryRadarChart data={radarChartData} />
        </div>
      </ScrollReveal>

      <ScrollReveal animation="fade-up">
        <ActivityHeatmap data={unifiedData.heatmap.data} stats={unifiedData.heatmap.stats} />
      </ScrollReveal>

      {/* Detailed Category Breakdown */}
      <ScrollReveal animation="fade-up">
        <CategoryPerformanceCard categoryDetails={unifiedData.categories} />
      </ScrollReveal>
    </div>
  );
}
