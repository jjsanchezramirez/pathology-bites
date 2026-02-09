// src/app/(dashboard)/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import { toast } from "@/shared/utils/ui/toast";
import {
  WelcomeMessage,
  V1ReleaseMessage,
  PerformanceAnalytics,
  StudentStatsCards,
  StudentStatsCardsLoading,
  StudentRecentActivity,
  StudentRecentActivityLoading,
  StudentQuickActions,
  StudentQuickActionsLoading,
} from "@/features/user/dashboard/components";
import { useAuthContext } from "@/features/auth/components/auth-provider";
import { useUserSettings } from "@/shared/hooks/use-user-settings";
import { PageErrorBoundary, FeatureErrorBoundary, ScrollReveal } from "@/shared/components/common";
import { useUnifiedData } from "@/shared/hooks/use-unified-data";

interface DashboardStats {
  // New meaningful categories
  allQuestions?: number;
  needsReview?: number;
  mastered?: number;
  unused?: number;
  completedQuestions: number;

  // Other stats
  averageScore: number;
  studyStreak: number;
  recentQuizzes: number;
  weeklyGoal: number;
  currentWeekProgress: number;
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    timestamp: string;
    timeGroup?: string;
    score?: number;
    navigationUrl?: string;
  }>;

  // Performance analytics
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

export default function DashboardPage() {
  const { user } = useAuthContext();
  const { data: unifiedData } = useUnifiedData();
  const { data: userSettings } = useUserSettings();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [showWelcomeMessage, setShowWelcomeMessage] = useState(false);
  const [showV1ReleaseMessage, setShowV1ReleaseMessage] = useState(false);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState(false);

  // Check for notification messages from SWR cache (no direct API calls)
  useEffect(() => {
    if (!user || !userSettings) return;

    const hasSeenWelcome = userSettings.ui_settings?.welcome_message_seen ?? false;
    setShowWelcomeMessage(!hasSeenWelcome);

    const hasDismissedV1 = userSettings.ui_settings?.v1_release_dismissed ?? false;
    setShowV1ReleaseMessage(!hasDismissedV1);
  }, [user, userSettings]);

  // Fetch dashboard stats on component mount
  useEffect(() => {
    // Don't fetch until user is loaded
    if (!user) {
      return;
    }

    const fetchData = async () => {
      try {
        // Wait for unified data to load
        if (!unifiedData) return;

        // Use unified API data directly (all data is now in one call!)
        const mergedStats = {
          ...unifiedData.dashboard,
          completedQuestions: unifiedData.dashboard.completedQuestions || 0,
          performance: {
            userPercentile: unifiedData.summary.userPercentile,
            peerRank: unifiedData.summary.peerRank,
            totalUsers: unifiedData.summary.totalUsers,
            completedQuizzes: unifiedData.summary.completedQuizzes,
            subjectsForImprovement: unifiedData.subjects.needsImprovement,
            subjectsMastered: unifiedData.subjects.mastered,
            overallScore: unifiedData.summary.overallScore,
          },
        };

        setStats(mergedStats);

        // Determine user status based on activity
        const isFirstTime = !showWelcomeMessage && mergedStats.recentQuizzes === 0;
        setIsFirstTimeUser(isFirstTime);

        // Check if user is returning after 7+ days (based on recent activity)
        const hasRecentActivity =
          mergedStats.recentActivity && mergedStats.recentActivity.length > 0;
        if (hasRecentActivity && !isFirstTime) {
          // If they have activity but the most recent is more than 7 days old
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

          // This is a simplified check - in a real implementation you'd parse the timestamp
          setIsReturningUser(!hasRecentActivity || mergedStats.recentQuizzes === 0);
        }
      } catch (error) {
        // Provide more specific error messages
        if (error instanceof Error) {
          if (error.message.includes("JSON")) {
            toast.error("Dashboard data format error. Please refresh the page.");
          } else if (error.message.includes("401") || error.message.includes("Unauthorized")) {
            toast.error("Please log in again to view your dashboard.");
          } else {
            toast.error(`Failed to load dashboard: ${error.message}`);
          }
        } else {
          toast.error("Failed to load dashboard data");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, unifiedData, showWelcomeMessage]);

  return (
    <PageErrorBoundary pageName="Dashboard" showHomeButton={false} showBackButton={false}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {isFirstTimeUser
              ? "Nice to meet you! Let's get you started with a quick quiz."
              : isReturningUser
                ? "Good to see you again! Ready to pick up where you left off?"
                : "Welcome back! Ready to continue your learning journey?"}
          </p>
        </div>

        {/* Welcome Message for First-Time Users */}
        {showWelcomeMessage && <WelcomeMessage onDismiss={() => setShowWelcomeMessage(false)} />}

        {/* V1.0 Release Announcement */}
        {showV1ReleaseMessage && (
          <V1ReleaseMessage onDismiss={() => setShowV1ReleaseMessage(false)} />
        )}

        {/* Show loading state for everything until data is ready */}
        {loading || !stats ? (
          <>
            <StudentStatsCardsLoading />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <StudentRecentActivityLoading />
              <StudentQuickActionsLoading />
            </div>
          </>
        ) : (
          <>
            {/* Stats Cards */}
            <ScrollReveal animation="fade-up">
              <StudentStatsCards stats={stats} />
            </ScrollReveal>

            {/* Recent Activity Section */}
            <ScrollReveal animation="fade-up">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <StudentRecentActivity activities={stats.recentActivity} />
                <StudentQuickActions />
              </div>
            </ScrollReveal>

            {/* Performance Analytics */}
            {stats?.performance && (
              <ScrollReveal animation="fade-up">
                <FeatureErrorBoundary featureName="Performance Analytics">
                  <PerformanceAnalytics data={stats.performance} />
                </FeatureErrorBoundary>
              </ScrollReveal>
            )}
          </>
        )}
      </div>
    </PageErrorBoundary>
  );
}
