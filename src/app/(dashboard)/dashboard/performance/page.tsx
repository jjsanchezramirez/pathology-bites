// src/app/(dashboard)/dashboard/performance/page.tsx
"use client";

import { useState, useEffect } from "react";

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

interface DashboardStats {
  performance?: {
    userPercentile: number;
    peerRank: number;
    totalUsers: number;
    completedQuizzes: number;
    subjectsForImprovement: Array<{
      name: string;
      score: number;
      attempts: number;
    }>;
    subjectsMastered: Array<{
      name: string;
      score: number;
      attempts: number;
    }>;
    overallScore: number;
  };
}

export default function PerformancePage() {
  const { data: unifiedData, isLoading } = useUnifiedData();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    if (!unifiedData) return;

    // Transform unified API response to match component expectations
    setStats({
      performance: {
        userPercentile: unifiedData.summary.userPercentile,
        peerRank: unifiedData.summary.peerRank,
        totalUsers: unifiedData.summary.totalUsers,
        completedQuizzes: unifiedData.summary.completedQuizzes,
        subjectsForImprovement: unifiedData.subjects.needsImprovement,
        subjectsMastered: unifiedData.subjects.mastered,
        overallScore: unifiedData.summary.overallScore,
      },
    });
  }, [unifiedData]);

  if (isLoading) {
    return <PerformanceLoading />;
  }

  if (!stats?.performance) {
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Performance Analytics</h1>
        <p className="text-muted-foreground">
          Detailed insights into your learning progress and areas for improvement.
        </p>
      </div>

      {/* Performance Overview Cards */}
      <ScrollReveal animation="fade-up">
        <PerformanceAnalytics data={stats.performance} />
      </ScrollReveal>

      {/* Interactive Charts - All data from single API call */}
      <ScrollReveal animation="fade-up">
        <div className="grid gap-6 lg:grid-cols-2">
          <PerformanceTimelineChart data={unifiedData?.timeline || []} loading={isLoading} />
          <CategoryRadarChart
            data={
              unifiedData?.categories.map((cat) => ({
                category_name: cat.category_name,
                accuracy: cat.accuracy,
              })) || []
            }
            loading={isLoading}
          />
        </div>
      </ScrollReveal>

      <ScrollReveal animation="fade-up">
        <ActivityHeatmap
          data={unifiedData?.heatmap.data || []}
          stats={unifiedData?.heatmap.stats || null}
          loading={isLoading}
        />
      </ScrollReveal>

      {/* Detailed Category Breakdown */}
      <ScrollReveal animation="fade-up">
        <CategoryPerformanceCard categoryDetails={unifiedData?.categories || []} />
      </ScrollReveal>
    </div>
  );
}
