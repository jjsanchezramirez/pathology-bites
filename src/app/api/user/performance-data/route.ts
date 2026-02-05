// Unified Performance API - Single endpoint for all performance data
// Consolidates: timeline, category-details, activity-heatmap, dashboard stats, and achievements

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { getUserIdFromHeaders } from "@/shared/utils/auth/auth-helpers";
import {
  ACHIEVEMENT_DEFINITIONS,
  type UserStats,
} from "@/features/user/achievements/services/achievement-checker";
import type { AchievementProgress } from "@/features/user/achievements/types/achievement";

interface _UserCategoryStats {
  category_id: string;
  all_count: number;
  unused_count: number;
  incorrect_count: number;
  marked_count: number;
  correct_count: number;
}

interface UnifiedPerformanceResponse {
  success: boolean;
  data: {
    // Summary statistics
    summary: {
      overallScore: number;
      completedQuizzes: number;
      totalAttempts: number;
      correctAttempts: number;
      userPercentile: number;
      peerRank: number;
      totalUsers: number;
    };

    // Subjects for improvement and mastered
    subjects: {
      needsImprovement: Array<{
        name: string;
        score: number;
        attempts: number;
      }>;
      mastered: Array<{
        name: string;
        score: number;
        attempts: number;
      }>;
    };

    // Timeline data (last 30 days)
    timeline: Array<{
      date: string;
      accuracy: number;
      quizzes: number;
    }>;

    // Category details (for radar chart and category breakdown)
    categories: Array<{
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
    }>;

    // Activity heatmap (last 365 days)
    heatmap: {
      data: Array<{
        date: string;
        quizzes: number;
        questions: number;
      }>;
      stats: {
        avgQuestionsPerDay: number;
        avgQuizzesPerDay: string;
        longestStreak: number;
        currentStreak: number;
        totalQuestions: number;
        totalQuizzes: number;
        daysWithActivity: number;
      };
    };

    // Achievements data
    achievements: {
      stats: UserStats;
      definitions: Array<{
        id: string;
        title: string;
        description: string;
        category: string;
        requirement: number;
        animation_type: string;
      }>;
      progress: Array<{
        id: string;
        requirement: number;
        isUnlocked: boolean;
        progress: number;
        unlockedDate?: string;
      }>;
    };

    // Dashboard-specific data
    dashboard: {
      allQuestions: number;
      needsReview: number;
      mastered: number;
      unused: number;
      totalQuestions: number;
      completedQuestions: number;
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
    };

    // Quiz initialization data (for /dashboard/quiz/new page)
    quizInit: {
      sessionTitles: string[];
      categories: Array<{
        id: string;
        name: string;
        shortName: string;
        parent: "AP" | "CP";
        questionStats: {
          all: number;
          unused: number;
          needsReview: number;
          marked: number;
          mastered: number;
        };
      }>;
      questionTypeStats: {
        all: { all: number; unused: number; needsReview: number; marked: number; mastered: number };
        ap_only: {
          all: number;
          unused: number;
          needsReview: number;
          marked: number;
          mastered: number;
        };
        cp_only: {
          all: number;
          unused: number;
          needsReview: number;
          marked: number;
          mastered: number;
        };
      };
    };
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get user ID from headers (set by middleware)
    const userId = getUserIdFromHeaders(request);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's quiz sessions (optimized with limit)
    const sessionsResult = await supabase
      .from("quiz_sessions")
      .select(
        `
        id,
        title,
        created_at,
        completed_at,
        score,
        status,
        total_questions,
        total_time_spent,
        quiz_attempts!inner(
          question_id,
          is_correct,
          time_spent,
          attempted_at
        )
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (sessionsResult.error) {
      console.error("Error fetching sessions:", sessionsResult.error);
      return NextResponse.json({ error: "Failed to fetch performance data" }, { status: 500 });
    }

    const sessions = sessionsResult.data || [];

    // Flatten all attempts with proper typing
    interface QuizAttemptItem {
      question_id: string;
      is_correct: boolean | null;
      time_spent: number | null;
      attempted_at: string;
    }

    const allAttempts = sessions.flatMap((s) =>
      (s.quiz_attempts || []).map((a: QuizAttemptItem) => ({
        ...a,
        session_id: s.id,
        session_created_at: s.created_at,
        session_completed_at: s.completed_at,
        session_score: s.score,
        session_status: s.status,
      }))
    );

    // Get all unique question IDs
    const questionIds = [...new Set(allAttempts.map((a) => a.question_id))];

    const { data: questions } = await supabase
      .from("questions")
      .select("id, category_id")
      .in("id", questionIds);

    // Get category names with proper typing
    interface QuestionBasic {
      id: string;
      category_id: string | null;
    }
    const questionCategoryMap = new Map<string, string | null>(
      (questions || []).map((q: QuestionBasic) => [q.id, q.category_id])
    );

    // categoryIds removed - not used in this implementation

    // Fetch ALL categories (for quiz init data), not just ones user has attempted
    interface CategoryBasic {
      id: string;
      name: string;
    }
    const { data: allCategories } = await supabase
      .from("categories")
      .select("id, name, short_form, parent_id, level")
      .order("name")
      .limit(100);

    const categoryMap = new Map<string, string>(
      (allCategories || []).map((cat: CategoryBasic) => [cat.id, cat.name])
    );

    // Calculate completed sessions
    const completedSessions = sessions.filter((s) => s.status === "completed");
    const totalAttempts = allAttempts.length;
    const correctAttempts = allAttempts.filter((a) => a.is_correct).length;
    const overallScore =
      totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

    // Calculate average score from completed sessions
    const avgScore =
      completedSessions.length > 0
        ? Math.round(
            completedSessions.reduce((sum, s) => sum + (s.score || 0), 0) / completedSessions.length
          )
        : 0;

    // Calculate percentile and peer ranking using optimized database function
    // This replaces fetching all users' scores (entire database) with a single aggregation query
    const { data: percentileData } = await supabase.rpc("get_user_percentile", {
      p_user_id: userId,
      p_avg_score: avgScore,
    });

    const userPercentile = percentileData?.[0]?.percentile || 50;
    const peerRank = percentileData?.[0]?.rank || 50;
    const totalUsers = Number(percentileData?.[0]?.total_users || 100);

    // Group attempts by category
    const categoryStatsMap = new Map<
      string,
      {
        total_attempts: number;
        correct_attempts: number;
        total_time: number;
        last_attempt_at: string;
        attempts: Array<{ is_correct: boolean; attempted_at: string; time_spent: number | null }>;
      }
    >();

    interface AttemptItem {
      question_id: string;
      is_correct: boolean;
      attempted_at: string;
      time_spent: number | null;
    }

    allAttempts.forEach((attempt: AttemptItem) => {
      const categoryId = questionCategoryMap.get(attempt.question_id);
      if (!categoryId) return;

      const stats = categoryStatsMap.get(categoryId) || {
        total_attempts: 0,
        correct_attempts: 0,
        total_time: 0,
        last_attempt_at: attempt.attempted_at,
        attempts: [],
      };

      stats.total_attempts++;
      if (attempt.is_correct) stats.correct_attempts++;
      stats.total_time += attempt.time_spent || 0;

      if (new Date(attempt.attempted_at) > new Date(stats.last_attempt_at)) {
        stats.last_attempt_at = attempt.attempted_at;
      }

      stats.attempts.push({
        is_correct: attempt.is_correct,
        attempted_at: attempt.attempted_at,
        time_spent: attempt.time_spent,
      });

      categoryStatsMap.set(categoryId, stats);
    });

    // Calculate needs improvement and mastered subjects
    const needsImprovement: Array<{ name: string; score: number; attempts: number }> = [];
    const mastered: Array<{ name: string; score: number; attempts: number }> = [];

    // Calculate category details with recent performance
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const categoryDetails = Array.from(categoryStatsMap.entries()).map(([categoryId, stats]) => {
      const accuracy =
        stats.total_attempts > 0
          ? Math.round((stats.correct_attempts / stats.total_attempts) * 100)
          : 0;

      const avgTime =
        stats.total_attempts > 0 ? Math.round(stats.total_time / stats.total_attempts) : 0;

      // Add to needs improvement or mastered
      if (accuracy < 70 && stats.total_attempts >= 3) {
        needsImprovement.push({
          name: categoryMap.get(categoryId) || "Unknown",
          score: accuracy,
          attempts: stats.total_attempts,
        });
      }

      if (accuracy >= 85 && stats.total_attempts >= 5) {
        mastered.push({
          name: categoryMap.get(categoryId) || "Unknown",
          score: accuracy,
          attempts: stats.total_attempts,
        });
      }

      // Calculate recent performance
      const recentAttempts = stats.attempts.filter(
        (a) => new Date(a.attempted_at) >= thirtyDaysAgo
      );

      const dailyStats = new Map<string, { correct: number; total: number }>();
      recentAttempts.forEach((attempt) => {
        const date = new Date(attempt.attempted_at).toISOString().split("T")[0];
        const dayStats = dailyStats.get(date) || { correct: 0, total: 0 };
        dayStats.total++;
        if (attempt.is_correct) dayStats.correct++;
        dailyStats.set(date, dayStats);
      });

      const recentPerformance = Array.from(dailyStats.entries())
        .map(([date, dayStats]) => ({
          date,
          accuracy: Math.round((dayStats.correct / dayStats.total) * 100),
          questions_answered: dayStats.total,
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 7);

      // Calculate trend
      let trend: "up" | "down" | "stable" = "stable";
      if (recentPerformance.length >= 2) {
        const recentAccuracies = recentPerformance.slice(0, 3).map((p) => p.accuracy);
        const avgRecent =
          recentAccuracies.reduce((sum, acc) => sum + acc, 0) / recentAccuracies.length;

        if (avgRecent > accuracy + 5) {
          trend = "up";
        } else if (avgRecent < accuracy - 5) {
          trend = "down";
        }
      }

      return {
        category_id: categoryId,
        category_name: categoryMap.get(categoryId) || "Unknown Category",
        total_attempts: stats.total_attempts,
        correct_attempts: stats.correct_attempts,
        accuracy,
        average_time: avgTime,
        last_attempt_at: stats.last_attempt_at,
        recent_performance: recentPerformance,
        trend,
      };
    });

    // Sort categories by last attempt (most recent first)
    categoryDetails.sort(
      (a, b) => new Date(b.last_attempt_at).getTime() - new Date(a.last_attempt_at).getTime()
    );

    // Sort needs improvement and mastered
    needsImprovement.sort((a, b) => a.score - b.score);
    mastered.sort((a, b) => b.score - a.score);

    // Calculate timeline (last 30 days)
    const completedSessionsLast30Days = completedSessions.filter(
      (s) => s.completed_at && new Date(s.completed_at) >= thirtyDaysAgo
    );

    const dailyData: Record<string, { scores: number[]; count: number }> = {};
    completedSessionsLast30Days.forEach((session) => {
      if (!session.completed_at) return;
      const date = new Date(session.completed_at).toISOString().split("T")[0];
      if (!dailyData[date]) {
        dailyData[date] = { scores: [], count: 0 };
      }
      dailyData[date].scores.push(session.score || 0);
      dailyData[date].count++;
    });

    const timeline = Object.entries(dailyData)
      .map(([date, stats]) => ({
        date,
        accuracy: stats.scores.reduce((sum, score) => sum + score, 0) / stats.scores.length,
        quizzes: stats.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get 365-day activity heatmap using optimized database function
    // This replaces JavaScript processing with database-side aggregation
    const { data: rawHeatmapData } = await supabase.rpc("get_user_activity_heatmap", {
      p_user_id: userId,
      days_back: 365,
    });

    // Convert bigint to number and ensure date is string
    const heatmapData = (rawHeatmapData || []).map((day) => ({
      date: day.date,
      quizzes: Number(day.quizzes),
      questions: Number(day.questions),
    }));

    // Calculate heatmap statistics
    const daysWithActivity = heatmapData.filter((d) => d.questions > 0).length;
    const totalQuestions = heatmapData.reduce((sum, d) => sum + d.questions, 0);
    const totalQuizzes = heatmapData.reduce((sum, d) => sum + d.quizzes, 0);

    const avgQuestionsPerDay =
      daysWithActivity > 0 ? Math.round(totalQuestions / daysWithActivity) : 0;
    const avgQuizzesPerDay =
      daysWithActivity > 0 ? (totalQuizzes / daysWithActivity).toFixed(1) : "0";

    // Calculate streaks
    let longestStreak = 0;
    let currentStreak = 0;
    let tempStreak = 0;

    for (let i = heatmapData.length - 1; i >= 0; i--) {
      if (heatmapData[i].questions > 0) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);

        if (i === heatmapData.length - 1 || currentStreak > 0 || i === heatmapData.length - 2) {
          currentStreak = tempStreak;
        }
      } else {
        if (i >= heatmapData.length - 2) {
          currentStreak = 0;
        }
        tempStreak = 0;
      }
    }

    // ===== ACHIEVEMENTS CALCULATION =====
    // Calculate achievement stats (reusing data already fetched)

    // Perfect scores (already have completedSessions)
    const perfectScores = completedSessions.filter((s) => s.score === 100).length;

    // Recent accuracy (last 10 quizzes) - using completedSessions
    const last10Quizzes = completedSessions
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    const _recentAccuracy =
      last10Quizzes.length > 0
        ? last10Quizzes.reduce((sum, s) => sum + (s.score || 0), 0) / last10Quizzes.length
        : 0;

    // Unique subjects (already have categoryDetails)
    const _uniqueSubjects = categoryDetails.length;
    const _totalCategories = categoryDetails.length; // Total categories user has interacted with

    // Calculate accuracy over different quiz counts
    const sortedCompletedSessions = completedSessions.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const accuracyOver3 =
      sortedCompletedSessions.length >= 3
        ? Math.round(
            sortedCompletedSessions.slice(0, 3).reduce((sum, s) => sum + (s.score || 0), 0) / 3
          )
        : 0;

    const accuracyOver5 =
      sortedCompletedSessions.length >= 5
        ? Math.round(
            sortedCompletedSessions.slice(0, 5).reduce((sum, s) => sum + (s.score || 0), 0) / 5
          )
        : 0;

    const accuracyOver8 =
      sortedCompletedSessions.length >= 8
        ? Math.round(
            sortedCompletedSessions.slice(0, 8).reduce((sum, s) => sum + (s.score || 0), 0) / 8
          )
        : 0;

    const accuracyOver10 =
      sortedCompletedSessions.length >= 10
        ? Math.round(
            sortedCompletedSessions.slice(0, 10).reduce((sum, s) => sum + (s.score || 0), 0) / 10
          )
        : 0;

    const accuracyOver12 =
      sortedCompletedSessions.length >= 12
        ? Math.round(
            sortedCompletedSessions.slice(0, 12).reduce((sum, s) => sum + (s.score || 0), 0) / 12
          )
        : 0;

    const accuracyOver15 =
      sortedCompletedSessions.length >= 15
        ? Math.round(
            sortedCompletedSessions.slice(0, 15).reduce((sum, s) => sum + (s.score || 0), 0) / 15
          )
        : 0;

    // Subjects with 100 questions answered correctly
    const subjectsWith100Questions = categoryDetails.filter(
      (cat) => cat.correct_attempts >= 100
    ).length;

    // Build UserStats object
    const achievementStats: UserStats = {
      totalQuizzes: completedSessions.length,
      perfectScores,
      currentStreak,
      longestStreak,
      accuracyOver3,
      accuracyOver5,
      accuracyOver8,
      accuracyOver10,
      accuracyOver12,
      accuracyOver15,
      subjectsWith10Questions: categoryDetails.filter((cat) => cat.correct_attempts >= 10).length,
      subjectsWith25Questions: categoryDetails.filter((cat) => cat.correct_attempts >= 25).length,
      subjectsWith50Questions: categoryDetails.filter((cat) => cat.correct_attempts >= 50).length,
      subjectsWith100Questions,
      totalCategories: categoryDetails.length,
    };

    // Get achievement definitions from database (source of truth)
    const { data: achievementDefinitions } = await supabase
      .from("achievements")
      .select("*")
      .order("category, requirement");

    // Fallback to hardcoded definitions if database fetch fails
    const definitions = achievementDefinitions || ACHIEVEMENT_DEFINITIONS;

    // Get unlocked achievements from database
    const { data: unlockedAchievements } = await supabase
      .from("user_achievements")
      .select("id, achievement_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const unlockedIds = new Set((unlockedAchievements || []).map((a) => a.achievement_id));

    // Calculate progress for all achievements
    const achievementProgress: AchievementProgress[] = definitions.map((def) => {
      const isUnlocked = unlockedIds.has(def.id);
      const userAchievement = unlockedAchievements?.find((a) => a.achievement_id === def.id);

      let progress = 0;
      let requirement = def.requirement;

      switch (def.category) {
        case "quiz":
          progress = Math.min(achievementStats.totalQuizzes, def.requirement);
          break;
        case "perfect":
          progress = Math.min(achievementStats.perfectScores, def.requirement);
          break;
        case "streak":
          progress = Math.min(achievementStats.longestStreak, def.requirement);
          break;
        case "speed":
          // Speed achievements are binary: unlocked or not
          // Progress is 1 if unlocked, 0 otherwise
          progress = isUnlocked ? 1 : 0;
          break;
        case "accuracy":
          // Show current accuracy as progress
          if (def.id === "accuracy-50-3") {
            progress = Math.min(achievementStats.accuracyOver3, def.requirement);
          } else if (def.id === "accuracy-60-5") {
            progress = Math.min(achievementStats.accuracyOver5, def.requirement);
          } else if (def.id === "accuracy-70-8") {
            progress = Math.min(achievementStats.accuracyOver8, def.requirement);
          } else if (def.id === "accuracy-80-10") {
            progress = Math.min(achievementStats.accuracyOver10, def.requirement);
          } else if (def.id === "accuracy-90-12") {
            progress = Math.min(achievementStats.accuracyOver12, def.requirement);
          } else if (def.id === "accuracy-100-15") {
            progress = Math.min(achievementStats.accuracyOver15, def.requirement);
          }
          break;
        case "differential":
          if (def.id === "differential-10-3") {
            progress = Math.min(achievementStats.subjectsWith10Questions, def.requirement);
          } else if (def.id === "differential-25-10") {
            progress = Math.min(achievementStats.subjectsWith25Questions, def.requirement);
          } else if (def.id === "differential-50-20") {
            progress = Math.min(achievementStats.subjectsWith50Questions, def.requirement);
          } else if (def.id === "differential-100-all") {
            if (achievementStats.totalCategories) {
              requirement = achievementStats.totalCategories;
              progress = achievementStats.subjectsWith100Questions;
            } else {
              progress = 0;
            }
          } else {
            progress = Math.min(achievementStats.subjectsWith100Questions, def.requirement);
          }
          break;
      }

      return {
        id: def.id,
        requirement,
        isUnlocked,
        progress,
        unlockedDate: userAchievement?.created_at,
      };
    });

    // ===== DASHBOARD DATA CALCULATION =====
    // Calculate dashboard-specific stats

    // Get total questions count
    const { count: allQuestionsCount } = await supabase
      .from("questions")
      .select("*", { count: "exact", head: true });

    // Calculate mastered/needs review from attempts
    const questionAttempts = new Map<string, { correct: number; incorrect: number }>();

    allAttempts.forEach((attempt: AttemptItem) => {
      const existing = questionAttempts.get(attempt.question_id) || { correct: 0, incorrect: 0 };
      if (attempt.is_correct) {
        existing.correct++;
      } else {
        existing.incorrect++;
      }
      questionAttempts.set(attempt.question_id, existing);
    });

    // Mastered: 2+ correct, no incorrect
    // Needs review: any incorrect
    let masteredCount = 0;
    let needsReviewCount = 0;

    questionAttempts.forEach((counts) => {
      if (counts.correct >= 2 && counts.incorrect === 0) {
        masteredCount++;
      } else if (counts.incorrect > 0) {
        needsReviewCount++;
      }
    });

    const completedQuestionsCount = questionAttempts.size;
    const unusedCount = Math.max(0, (allQuestionsCount || 0) - completedQuestionsCount);

    // Recent activity from sessions
    const recentActivity: Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      timestamp: string;
      timeGroup?: string;
      score?: number;
      navigationUrl?: string;
    }> = [];

    interface CompletedSessionItem {
      id: string;
      status: string;
      completed_at: string | null;
      created_at: string;
      title: string | null;
      score: number | null;
    }

    // Add completed quiz sessions
    completedSessions.forEach((session: CompletedSessionItem) => {
      const isCompleted = session.status === "completed";
      recentActivity.push({
        id: `session-${session.id}`,
        type: isCompleted ? "quiz_completed" : "quiz_started",
        title: isCompleted ? "Completed Quiz" : "Started Quiz",
        description: isCompleted ? "View detailed results" : "Continue where you left off",
        timestamp: session.completed_at || session.created_at,
        score: session.score,
        navigationUrl: isCompleted
          ? `/dashboard/quiz/${session.id}/results`
          : `/dashboard/quiz/${session.id}`,
      });
    });

    // Add pending quizzes (in-progress sessions)
    interface PendingSessionItem {
      id: string;
      status: string;
      created_at: string;
      title: string | null;
    }
    const pendingSessions = sessions.filter((s) => s.status === "in_progress");
    pendingSessions.forEach((session: PendingSessionItem) => {
      recentActivity.push({
        id: `pending-${session.id}`,
        type: "quiz_started",
        title: "Quiz In Progress",
        description: session.title || "Continue where you left off",
        timestamp: session.created_at,
        navigationUrl: `/dashboard/quiz/${session.id}`,
      });
    });

    // Add recently unlocked achievements
    interface AchievementItem {
      id: string;
      achievement_id: string;
      created_at: string;
    }
    const recentAchievements = (unlockedAchievements || []).slice(0, 10);
    recentAchievements.forEach((achievement: AchievementItem) => {
      const achievementDef = ACHIEVEMENT_DEFINITIONS.find(
        (def) => def.id === achievement.achievement_id
      );
      if (achievementDef) {
        recentActivity.push({
          id: `achievement-${achievement.id}`,
          type: "achievement_unlocked",
          title: `Achievement Unlocked: ${achievementDef.title}`,
          description: achievementDef.description,
          timestamp: achievement.created_at,
          navigationUrl: "/dashboard/progress#achievements",
        });
      }
    });

    // Sort all activities by timestamp (most recent first) and limit to 10
    recentActivity.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const limitedActivity = recentActivity.slice(0, 10);

    // If no activity, add welcome message
    if (limitedActivity.length === 0) {
      limitedActivity.push({
        id: "welcome-1",
        type: "welcome",
        title: "Start Your First Quiz",
        description: "Take a quick starter quiz to see how we track your progress.",
        timestamp: new Date().toISOString(),
      });
    }

    // Weekly goal progress (simple calculation)
    const weeklyGoal = 50;
    const currentWeekProgress = completedSessions.length; // Simplified

    // ===== QUIZ INITIALIZATION DATA =====
    // Build quiz init data (for /dashboard/quiz/new page)

    // Helper function to extract short name
    const extractShortName = (name: string): string => {
      const match = name.match(/\(([^)]+)\)/);
      return match
        ? match[1]
        : name
            .split(" ")
            .map((word) => word[0])
            .join("")
            .toUpperCase();
    };

    // Extract session titles (last 100 sessions)
    // Sessions data already includes title field from the initial query
    interface SessionTitleItem {
      title: string | null;
    }
    const sessionTitles = sessions.slice(0, 100).map((s: SessionTitleItem) => s.title || "");

    // Process categories for quiz init
    interface CategoryItem {
      id: string;
      name: string;
      short_form: string | null;
      parent_id: string | null;
      level: number;
    }
    const subcategories = (allCategories || []).filter((cat: CategoryItem) => cat.level === 2);
    const parentCategories = (allCategories || []).filter((cat: CategoryItem) => cat.level === 1);

    // Create parent lookup
    interface _ParentCategory {
      id: string;
      name: string;
    }
    const parentLookup = new Map<string, string>();
    for (const parent of parentCategories) {
      parentLookup.set(parent.id, parent.name);
    }

    // Get category IDs for stats calculation
    const allCategoryIds = subcategories.map((cat: CategoryItem) => cat.id);

    // Fetch user stats for ALL categories using optimized database function
    const { data: allUserStatsData, error: statsError } = await supabase.rpc(
      "get_user_category_stats",
      {
        p_user_id: userId,
        p_category_ids: allCategoryIds,
      }
    );

    if (statsError) {
      console.error("Error fetching user category stats:", statsError);
      // Continue with empty stats rather than failing the whole request
    }

    // Create stats lookup map with proper property names
    interface QuizQuestionStats {
      all: number;
      unused: number;
      needsReview: number;
      marked: number;
      mastered: number;
    }
    interface UserStatItem {
      category_id: string;
      all_count: number;
      unused_count: number;
      incorrect_count: number;
      marked_count: number;
      correct_count: number;
    }
    const allStatsMap = new Map<string, QuizQuestionStats>();
    for (const stat of (allUserStatsData || []) as UserStatItem[]) {
      const categoryId =
        typeof stat.category_id === "string" ? stat.category_id : String(stat.category_id);
      allStatsMap.set(categoryId, {
        all: stat.all_count,
        unused: stat.unused_count,
        needsReview: stat.incorrect_count,
        marked: stat.marked_count,
        mastered: stat.correct_count,
      });
    }

    // Build categories with user stats for quiz init
    const categoriesForQuizInit = subcategories.map((category: CategoryItem) => {
      const stats = allStatsMap.get(category.id) || {
        all: 0,
        unused: 0,
        needsReview: 0,
        marked: 0,
        mastered: 0,
      };

      // Determine parent type
      const parentName = parentLookup.get(category.parent_id || "");
      const parent =
        parentName === "Anatomic Pathology"
          ? "AP"
          : parentName === "Clinical Pathology"
            ? "CP"
            : "AP";

      return {
        id: category.id,
        name: category.name,
        shortName: category.short_form || extractShortName(category.name),
        parent: parent as "AP" | "CP",
        questionStats: stats,
      };
    });

    // Calculate overall statistics for quiz init
    const overallQuizStats = categoriesForQuizInit.reduce(
      (acc, cat) => ({
        all: acc.all + cat.questionStats.all,
        unused: acc.unused + cat.questionStats.unused,
        needsReview: acc.needsReview + cat.questionStats.needsReview,
        marked: acc.marked + cat.questionStats.marked,
        mastered: acc.mastered + cat.questionStats.mastered,
      }),
      { all: 0, unused: 0, needsReview: 0, marked: 0, mastered: 0 }
    );

    const apQuizStats = categoriesForQuizInit
      .filter((cat) => cat.parent === "AP")
      .reduce(
        (acc, cat) => ({
          all: acc.all + cat.questionStats.all,
          unused: acc.unused + cat.questionStats.unused,
          needsReview: acc.needsReview + cat.questionStats.needsReview,
          marked: acc.marked + cat.questionStats.marked,
          mastered: acc.mastered + cat.questionStats.mastered,
        }),
        { all: 0, unused: 0, needsReview: 0, marked: 0, mastered: 0 }
      );

    const cpQuizStats = categoriesForQuizInit
      .filter((cat) => cat.parent === "CP")
      .reduce(
        (acc, cat) => ({
          all: acc.all + cat.questionStats.all,
          unused: acc.unused + cat.questionStats.unused,
          needsReview: acc.needsReview + cat.questionStats.needsReview,
          marked: acc.marked + cat.questionStats.marked,
          mastered: acc.mastered + cat.questionStats.mastered,
        }),
        { all: 0, unused: 0, needsReview: 0, marked: 0, mastered: 0 }
      );

    const questionTypeStats = {
      all: overallQuizStats,
      ap_only: apQuizStats,
      cp_only: cpQuizStats,
    };

    const response: UnifiedPerformanceResponse = {
      success: true,
      data: {
        summary: {
          overallScore,
          completedQuizzes: completedSessions.length,
          totalAttempts,
          correctAttempts,
          userPercentile,
          peerRank,
          totalUsers,
        },
        subjects: {
          needsImprovement: needsImprovement.slice(0, 5),
          mastered: mastered.slice(0, 5),
        },
        timeline,
        categories: categoryDetails,
        heatmap: {
          data: heatmapData,
          stats: {
            avgQuestionsPerDay,
            avgQuizzesPerDay,
            longestStreak,
            currentStreak,
            totalQuestions,
            totalQuizzes,
            daysWithActivity,
          },
        },
        achievements: {
          stats: achievementStats,
          definitions: definitions.map((d) => ({
            id: d.id,
            title: d.title,
            description: d.description,
            category: d.category,
            requirement: d.requirement,
            animation_type: d.animation_type || d.animationType, // Handle both snake_case and camelCase
          })),
          progress: achievementProgress,
        },
        dashboard: {
          allQuestions: allQuestionsCount || 0,
          needsReview: needsReviewCount,
          mastered: masteredCount,
          unused: unusedCount,
          totalQuestions: allQuestionsCount || 0,
          completedQuestions: completedQuestionsCount,
          averageScore: overallScore,
          studyStreak: currentStreak,
          recentQuizzes: completedSessions.length,
          weeklyGoal,
          currentWeekProgress,
          recentActivity: limitedActivity,
        },
        quizInit: {
          sessionTitles,
          categories: categoriesForQuizInit,
          questionTypeStats,
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in unified performance API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
