// Unified Performance API - Single endpoint for all performance data
// Consolidates: timeline, category-details, activity-heatmap, dashboard stats, and achievements
//
// This file owns auth + data fetching + response assembly. All calculation
// logic lives in pure, unit-testable modules under
// src/features/user/dashboard/services/performance/.

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/shared/services/service-role-client";
import { createClient } from "@/shared/services/server";
import { requireUser } from "@/shared/utils/api/api-guard";
import { ACHIEVEMENT_DEFINITIONS } from "@/features/user/achievements/services/achievement-checker";
import {
  buildQuizInit,
  buildRecentActivity,
  calculateAchievementProgress,
  calculateAchievementStats,
  calculateCategoryPerformance,
  calculateHeatmap,
  calculateScoreSummary,
  calculateTimeline,
  flattenSessionAttempts,
  getSubcategoryIds,
  mapAchievementDefinitions,
  resolvePercentile,
  type CategoryBasic,
  type QuestionBasic,
  type UnifiedPerformanceResponse,
} from "@/features/user/dashboard/services/performance";
import { log } from "@/shared/utils/logging";

/**
 * @swagger
 * /api/user/performance-data:
 *   get:
 *     summary: Get unified user performance data
 *     description: Retrieve comprehensive user performance data including summary statistics, category performance, timeline, activity heatmap, achievements, dashboard metrics, and quiz initialization data. This unified endpoint consolidates multiple data sources into a single optimized call. Requires authentication.
 *     tags:
 *       - User - Dashboard
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Performance data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: object
 *                       description: Overall performance summary
 *                       properties:
 *                         overallScore:
 *                           type: integer
 *                         completedQuizzes:
 *                           type: integer
 *                         totalAttempts:
 *                           type: integer
 *                         correctAttempts:
 *                           type: integer
 *                         userPercentile:
 *                           type: integer
 *                         peerRank:
 *                           type: integer
 *                         totalUsers:
 *                           type: integer
 *                     subjects:
 *                       type: object
 *                       properties:
 *                         needsImprovement:
 *                           type: array
 *                           items:
 *                             type: object
 *                         mastered:
 *                           type: array
 *                           items:
 *                             type: object
 *                     timeline:
 *                       type: array
 *                       description: Performance timeline for last 30 days
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                           accuracy:
 *                             type: number
 *                           quizzes:
 *                             type: integer
 *                     categories:
 *                       type: array
 *                       description: Detailed category performance with trends
 *                       items:
 *                         type: object
 *                         properties:
 *                           category_id:
 *                             type: string
 *                           category_name:
 *                             type: string
 *                           total_attempts:
 *                             type: integer
 *                           correct_attempts:
 *                             type: integer
 *                           accuracy:
 *                             type: integer
 *                           average_time:
 *                             type: integer
 *                           last_attempt_at:
 *                             type: string
 *                             format: date-time
 *                           recent_performance:
 *                             type: array
 *                             items:
 *                               type: object
 *                           trend:
 *                             type: string
 *                             enum: [up, down, stable]
 *                     heatmap:
 *                       type: object
 *                       description: Activity heatmap for last 365 days
 *                       properties:
 *                         data:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               date:
 *                                 type: string
 *                                 format: date
 *                               quizzes:
 *                                 type: integer
 *                               questions:
 *                                 type: integer
 *                         stats:
 *                           type: object
 *                           properties:
 *                             avgQuestionsPerDay:
 *                               type: integer
 *                             avgQuizzesPerDay:
 *                               type: string
 *                             longestStreak:
 *                               type: integer
 *                             currentStreak:
 *                               type: integer
 *                             totalQuestions:
 *                               type: integer
 *                             totalQuizzes:
 *                               type: integer
 *                             daysWithActivity:
 *                               type: integer
 *                     achievements:
 *                       type: object
 *                       description: Achievement progress and unlocked achievements
 *                       properties:
 *                         stats:
 *                           type: object
 *                           description: Statistics used for achievement calculation
 *                         definitions:
 *                           type: array
 *                           description: All available achievements
 *                           items:
 *                             type: object
 *                         progress:
 *                           type: array
 *                           description: User progress towards each achievement
 *                           items:
 *                             type: object
 *                     dashboard:
 *                       type: object
 *                       description: Dashboard-specific metrics
 *                       properties:
 *                         allQuestions:
 *                           type: integer
 *                         needsReview:
 *                           type: integer
 *                         mastered:
 *                           type: integer
 *                         unused:
 *                           type: integer
 *                         totalQuestions:
 *                           type: integer
 *                         completedQuestions:
 *                           type: integer
 *                         averageScore:
 *                           type: integer
 *                         studyStreak:
 *                           type: integer
 *                         recentQuizzes:
 *                           type: integer
 *                         weeklyGoal:
 *                           type: integer
 *                         currentWeekProgress:
 *                           type: integer
 *                         recentActivity:
 *                           type: array
 *                           items:
 *                             type: object
 *                     quizInit:
 *                       type: object
 *                       description: Data for quiz initialization page
 *                       properties:
 *                         sessionTitles:
 *                           type: array
 *                           items:
 *                             type: string
 *                         categories:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               shortName:
 *                                 type: string
 *                               parent:
 *                                 type: string
 *                                 enum: [AP, CP]
 *                               questionStats:
 *                                 type: object
 *                         questionTypeStats:
 *                           type: object
 *       401:
 *         description: Unauthorized - missing authentication
 *       500:
 *         description: Internal server error
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get user ID from headers (set by middleware)
    const auth = requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    // Fetch user's quiz sessions (optimized with limit).
    // NOTE: This `sessions` array is used for heavy per-session/per-attempt calculations
    // and is intentionally capped at the 100 most recent rows. It is NOT the source of
    // truth for the lifetime "completed quizzes" count — see lifetimeCompletedQuizzes below.
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
      log.error("Error fetching sessions:", sessionsResult.error);
      return NextResponse.json({ error: "Failed to fetch performance data" }, { status: 500 });
    }

    const sessions = sessionsResult.data || [];

    // Unfiltered lifetime count of completed quizzes — separate cheap COUNT query so the
    // dashboard's "completed quizzes" stat isn't capped at 100 or skewed by the inner join.
    // This is the canonical value reported as both `summary.completedQuizzes` and
    // `achievements.stats.totalQuizzes` below; matches what getUserStats() returns server-side.
    const { count: lifetimeCompletedQuizzesRaw } = await supabase
      .from("quiz_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed");
    const lifetimeCompletedQuizzes = lifetimeCompletedQuizzesRaw ?? 0;

    // Flatten all attempts with session context
    const allAttempts = flattenSessionAttempts(sessions);

    // Resolve each attempted question's category
    const questionIds = [...new Set(allAttempts.map((a) => a.question_id))];

    const { data: questions } = await supabase
      .from("questions")
      .select("id, category_id")
      .in("id", questionIds);

    const questionCategoryMap = new Map<string, string | null>(
      (questions || []).map((q: QuestionBasic) => [q.id, q.category_id])
    );

    // Fetch ALL categories (for quiz init data), not just ones user has attempted
    const { data: allCategories } = await supabase
      .from("categories")
      .select("id, name, short_form, parent_id, level")
      .order("name")
      .limit(100);

    const categoryMap = new Map<string, string>(
      (allCategories || []).map((cat: CategoryBasic) => [cat.id, cat.name])
    );

    // Overall + average scores from the windowed sessions
    const completedSessions = sessions.filter((s) => s.status === "completed");
    const { totalAttempts, correctAttempts, overallScore, avgScore } = calculateScoreSummary(
      allAttempts,
      completedSessions
    );

    // Calculate percentile and peer ranking using optimized database function.
    // get_user_percentile is SECURITY DEFINER by necessity — it aggregates across
    // all users' quiz_sessions, which RLS would otherwise scope to the caller alone.
    // It is INTENTIONALLY not callable by the `authenticated` role (no /rest/v1/rpc/
    // exposure to signed-in users); we invoke it here through a service-role client
    // because the parameters are already trusted (userId from middleware JWT,
    // avgScore computed server-side from the caller's own RLS-filtered sessions).
    const adminSupabase = createServiceRoleClient();
    const { data: percentileData } = await adminSupabase.rpc("get_user_percentile", {
      p_user_id: userId,
      p_avg_score: avgScore,
    });

    // ?? semantics (0 is a legit percentile/rank) enforced inside resolvePercentile
    const { userPercentile, peerRank, totalUsers } = resolvePercentile(percentileData);

    // Per-category stats, needs-improvement / mastered buckets, trends
    const { categoryDetails, needsImprovement, mastered } = calculateCategoryPerformance(
      allAttempts,
      questionCategoryMap,
      categoryMap
    );

    // All-time daily timeline. Separate query so we don't reuse the 100-row
    // `sessions` window — the timeline chart now offers a timeframe selector
    // (1w/1m/3m/6m/1y/all) and needs the full history. We fetch just the two
    // fields we need; the row is sparse (only days with completed sessions).
    const { data: allCompletedSessionsForTimeline } = await supabase
      .from("quiz_sessions")
      .select("completed_at, score")
      .eq("user_id", userId)
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: true });

    const timeline = calculateTimeline(allCompletedSessionsForTimeline);

    // Get 365-day activity heatmap using optimized database function
    // This replaces JavaScript processing with database-side aggregation
    const { data: rawHeatmapData } = await supabase.rpc("get_user_activity_heatmap", {
      p_user_id: userId,
      days_back: 365,
    });

    const heatmap = calculateHeatmap(rawHeatmapData);

    // ===== ACHIEVEMENTS CALCULATION =====
    // Calculate achievement stats (reusing data already fetched)
    const achievementStats = calculateAchievementStats({
      completedSessions,
      categoryDetails,
      lifetimeCompletedQuizzes,
      currentStreak: heatmap.stats.currentStreak,
      longestStreak: heatmap.stats.longestStreak,
    });

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

    const achievementProgress = calculateAchievementProgress(
      definitions,
      unlockedAchievements,
      achievementStats
    );

    // ===== DASHBOARD DATA CALCULATION =====
    const pendingSessions = sessions.filter((s) => s.status === "in_progress");
    const recentActivity = buildRecentActivity({
      completedSessions,
      pendingSessions,
      unlockedAchievements,
    });

    // Weekly goal progress (simple calculation)
    const weeklyGoal = 50;
    const currentWeekProgress = completedSessions.length; // Simplified

    // ===== QUIZ INITIALIZATION DATA =====
    // Fetch user stats for ALL subcategories using optimized database function
    const allCategoryIds = getSubcategoryIds(allCategories);
    const { data: allUserStatsData, error: statsError } = await supabase.rpc(
      "get_user_category_stats",
      {
        p_user_id: userId,
        p_category_ids: allCategoryIds,
      }
    );

    if (statsError) {
      log.error("Error fetching user category stats:", statsError);
      // Continue with empty stats rather than failing the whole request
    }

    const quizInit = buildQuizInit({
      sessions,
      allCategories,
      userCategoryStats: allUserStatsData,
    });

    const response: UnifiedPerformanceResponse = {
      success: true,
      data: {
        summary: {
          overallScore,
          completedQuizzes: lifetimeCompletedQuizzes,
          totalAttempts,
          correctAttempts,
          userPercentile,
          peerRank,
          totalUsers,
        },
        subjects: {
          // Up to 12 items each — the dashboard cards grow to up to 3 inner columns
          // based on item count, so allow enough room without truncating prematurely.
          needsImprovement: needsImprovement.slice(0, 12),
          mastered: mastered.slice(0, 12),
        },
        timeline,
        categories: categoryDetails,
        heatmap,
        achievements: {
          stats: achievementStats,
          definitions: mapAchievementDefinitions(definitions),
          progress: achievementProgress,
        },
        dashboard: {
          // Canonical bucket counts from get_user_category_stats (published-only).
          // Definitions match /dashboard/quiz/new:
          //   Mastered     = last 2 consecutive attempts correct
          //   Needs Review = most recent attempt incorrect
          //   Unused       = never attempted (published pool)
          allQuestions: quizInit.overallQuizStats.all,
          needsReview: quizInit.overallQuizStats.needsReview,
          mastered: quizInit.overallQuizStats.mastered,
          unused: quizInit.overallQuizStats.unused,
          totalQuestions: quizInit.overallQuizStats.all,
          completedQuestions: Math.max(
            0,
            quizInit.overallQuizStats.all - quizInit.overallQuizStats.unused
          ),
          averageScore: overallScore,
          studyStreak: heatmap.stats.currentStreak,
          recentQuizzes: completedSessions.length,
          weeklyGoal,
          currentWeekProgress,
          recentActivity,
        },
        quizInit: {
          sessionTitles: quizInit.sessionTitles,
          categories: quizInit.categories,
          questionTypeStats: quizInit.questionTypeStats,
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    log.error("Error in unified performance API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
