// src/features/achievements/services/achievement-service.server.ts
// SERVER-SIDE ONLY - Do not import in client components
import { createClient } from "@/shared/services/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  UserStats,
  AchievementDefinition,
  checkAchievements,
  ACHIEVEMENT_DEFINITIONS,
} from "./achievement-checker";

/**
 * Create a Supabase client with service role for bypassing RLS
 * Used for achievement insertion which needs to bypass user RLS policies
 */
function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables for service role");
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Get user stats from the database
 * SERVER-SIDE ONLY
 */
export async function getUserStats(userId: string): Promise<UserStats> {
  const supabase = await createClient();

  // OPTIMIZATION: Fetch ALL quiz sessions once for multiple calculations
  // This single query replaces 5 separate queries:
  // 1. totalQuizzes count
  // 2. perfectScores count
  // 3. recent quizzes for accuracy metrics
  // 4. all quizzes for streak calculation
  // 5. perfect quizzes for speed records
  const { data: allQuizSessions } = await supabase
    .from("quiz_sessions")
    .select("score, created_at, completed_at, total_questions, total_time_spent")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  // Count total completed quizzes and perfect scores
  const totalQuizzes = allQuizSessions?.length || 0;
  const perfectScores = allQuizSessions?.filter((q) => (q.score || 0) >= 100).length || 0;

  // Calculate accuracy over recent N quizzes (already sorted by created_at DESC)
  const calculateAccuracy = (quizzes: typeof allQuizSessions, n: number): number => {
    if (!quizzes || quizzes.length < n) return -1; // Not enough quizzes
    return quizzes.slice(0, n).reduce((sum, q) => sum + (q.score || 0), 0) / n;
  };

  const accuracyOver3 = calculateAccuracy(allQuizSessions, 3);
  const accuracyOver5 = calculateAccuracy(allQuizSessions, 5);
  const accuracyOver8 = calculateAccuracy(allQuizSessions, 8);
  const accuracyOver10 = calculateAccuracy(allQuizSessions, 10);
  const accuracyOver12 = calculateAccuracy(allQuizSessions, 12);
  const accuracyOver15 = calculateAccuracy(allQuizSessions, 15);

  console.log("Accuracy calculations:", {
    accuracyOver3,
    accuracyOver5,
    accuracyOver8,
    accuracyOver10,
    accuracyOver12,
    accuracyOver15,
  });

  // Get correct answers grouped by subject (for differential diagnosis achievements)
  // OPTIMIZATION: Use nested select to get category_id in single query (JOIN)
  const { data: correctAttempts } = await supabase
    .from("quiz_attempts")
    .select("questions!inner(category_id)")
    .eq("user_id", userId)
    .eq("is_correct", true);

  // Count correct answers per subject
  const subjectCounts = new Map<string, number>();
  correctAttempts?.forEach((attempt) => {
    const categoryId = (attempt.questions as unknown as { category_id: string | null })
      ?.category_id;
    if (categoryId) {
      subjectCounts.set(categoryId, (subjectCounts.get(categoryId) || 0) + 1);
    }
  });

  const subjectsWith10Questions = Array.from(subjectCounts.values()).filter(
    (count) => count >= 10
  ).length;
  const subjectsWith25Questions = Array.from(subjectCounts.values()).filter(
    (count) => count >= 25
  ).length;
  const subjectsWith50Questions = Array.from(subjectCounts.values()).filter(
    (count) => count >= 50
  ).length;
  const subjectsWith100Questions = Array.from(subjectCounts.values()).filter(
    (count) => count >= 100
  ).length;

  // Get total number of categories that have questions
  const { data: categoriesWithQuestions } = await supabase
    .from("questions")
    .select("category_id")
    .not("category_id", "is", null);

  const totalCategories = new Set(categoriesWithQuestions?.map((q) => q.category_id) || []).size;

  // Calculate streaks from quiz_sessions dates (reusing allQuizSessions)
  let currentStreak = 0;
  let longestStreak = 0;

  if (allQuizSessions && allQuizSessions.length > 0) {
    // Get unique dates (days) when quizzes were completed
    const uniqueDates = new Set(
      allQuizSessions.map((q) => {
        const date = new Date(q.completed_at || q.created_at);
        // Normalize to start of day in UTC
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
          .toISOString()
          .split("T")[0];
      })
    );

    const sortedDates = Array.from(uniqueDates).sort();

    // Calculate current streak (working from today)
    const today = new Date();
    const todayStr = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    )
      .toISOString()
      .split("T")[0];

    const checkDate = new Date(todayStr);
    currentStreak = 0;

    while (true) {
      const checkDateStr = checkDate.toISOString().split("T")[0];
      if (sortedDates.includes(checkDateStr)) {
        currentStreak++;
        // Move to previous day
        checkDate.setUTCDate(checkDate.getUTCDate() - 1);
      } else {
        break;
      }
    }

    // Calculate longest streak
    let tempStreak = 1;
    longestStreak = 1;

    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1] as string);
      const currDate = new Date(sortedDates[i] as string);

      // Calculate difference in days
      const diffTime = currDate.getTime() - prevDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Consecutive day
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        // Streak broken
        tempStreak = 1;
      }
    }
  }

  console.log("Streak calculation - current:", currentStreak, "longest:", longestStreak);

  const stats = {
    totalQuizzes: totalQuizzes || 0,
    perfectScores: perfectScores || 0,
    currentStreak,
    longestStreak,
    accuracyOver3,
    accuracyOver5,
    accuracyOver8,
    accuracyOver10,
    accuracyOver12,
    accuracyOver15,
    subjectsWith10Questions,
    subjectsWith25Questions,
    subjectsWith50Questions,
    subjectsWith100Questions,
    totalCategories,
  };

  console.log("User stats calculated:", JSON.stringify(stats, null, 2));

  return stats;
}

/**
 * Award achievements to a user (called after quiz completion)
 * SERVER-SIDE ONLY
 *
 * @param userId - User ID
 * @param achievementIdsToUnlock - Array of achievement IDs to unlock (from client)
 * @returns Object containing new achievements and stats metadata for cache validation
 */
export async function awardAchievements(
  userId: string,
  achievementIdsToUnlock: string[] = []
): Promise<{
  newAchievements: AchievementDefinition[];
  metadata: {
    totalQuizzes: number;
    lastQuizTimestamp: string;
  };
}> {
  const supabase = await createClient();

  // Get user stats for validation
  const stats = await getUserStats(userId);

  // Get already unlocked achievements
  const { data: existingAchievements } = await supabase
    .from("user_achievements")
    .select("achievement_id")
    .eq("user_id", userId);

  const existingIds = new Set(existingAchievements?.map((a) => a.achievement_id) || []);

  // Server-side validation: re-check all achievements to ensure they're valid
  const qualified = checkAchievements(stats);

  // BACKFILL MODE: Check if user is missing any achievements they qualify for
  // This happens when achievements were skipped (e.g., quiz-20 when user goes from quiz-10 to quiz-30)
  const qualifiedIds = new Set(qualified.map((a) => a.id));
  const missingAchievements = qualified.filter((a) => !existingIds.has(a.id));

  // For backfilling, we need to unlock ALL qualified achievements, not just sequential
  // But still respect sequential order within each category
  const achievementsToUnlock: AchievementDefinition[] = [];

  // Group missing achievements by category
  const categories = ["quiz", "perfect", "streak", "accuracy", "differential"] as const;

  for (const category of categories) {
    const categoryAchievements = missingAchievements
      .filter((a) => a.category === category)
      .sort((a, b) => a.requirement - b.requirement);

    // Unlock all qualified achievements in order for this category
    for (const achievement of categoryAchievements) {
      achievementsToUnlock.push(achievement);
    }
  }

  // Add speed achievements (non-sequential, can unlock multiple)
  const speedAchievements = missingAchievements.filter((a) => a.category === "speed");
  achievementsToUnlock.push(...speedAchievements);

  const validIds = new Set(achievementsToUnlock.map((a) => a.id));

  // Filter client-provided IDs to only include valid ones
  // Speed achievements bypass qualifiedIds check since they're validated per-quiz, not by stats
  const clientRequestedValid = achievementIdsToUnlock.filter((id) => {
    // Speed achievements: trust client validation (already checked per-quiz)
    if (id.startsWith("speed-")) {
      return !existingIds.has(id);
    }
    // Other achievements: validate against server stats
    return qualifiedIds.has(id) && !existingIds.has(id);
  });

  // Combine client-requested and backfilled achievements
  const filteredIds = [...new Set([...clientRequestedValid, ...validIds])];

  console.log("Client requested achievements:", achievementIdsToUnlock);
  console.log("Server validated achievements:", filteredIds);

  const newAchievements: AchievementDefinition[] = [];

  // Insert new achievements using new schema
  if (filteredIds.length > 0) {
    const achievementsToInsert = filteredIds.map((id) => ({
      user_id: userId,
      achievement_id: id,
    }));

    console.log("Attempting to insert achievements:", achievementsToInsert.length);

    // Use service client to bypass RLS for achievement insertion
    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient
      .from("user_achievements")
      .insert(achievementsToInsert)
      .select("achievement_id");

    if (error) {
      console.error("Error inserting achievements:", error);
      throw new Error(`Failed to insert achievements: ${error.message}`);
    }

    console.log("Successfully inserted achievements:", data);

    // Get achievement definitions for return value
    for (const id of filteredIds) {
      const def = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === id);
      if (def) {
        newAchievements.push(def);
      }
    }
  } else {
    console.log("No new achievements to insert");
  }

  // Get last quiz timestamp for cache validation
  const { data: lastQuiz } = await supabase
    .from("quiz_sessions")
    .select("completed_at, created_at")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();

  const lastQuizTimestamp =
    lastQuiz?.completed_at || lastQuiz?.created_at || new Date().toISOString();

  return {
    newAchievements,
    metadata: {
      totalQuizzes: stats.totalQuizzes,
      lastQuizTimestamp,
    },
  };
}

/**
 * Get recently unlocked achievements that haven't been shown yet
 * Used for displaying achievements on quiz results page
 */
export async function getRecentUnshownAchievements(
  userId: string,
  sinceTimestamp?: string
): Promise<AchievementDefinition[]> {
  const supabase = await createClient();

  // Get achievements unlocked in the last 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const since = sinceTimestamp || fiveMinutesAgo;

  const { data: recentAchievements, error } = await supabase
    .from("user_achievements")
    .select("achievement_id")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching recent achievements:", error);
    return [];
  }

  console.log(
    `[Achievements] Found ${recentAchievements?.length || 0} recent unshown achievements`
  );

  // Get achievement definitions for the IDs
  const achievementDefs: AchievementDefinition[] = [];
  for (const ach of recentAchievements || []) {
    const def = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === ach.achievement_id);
    if (def) {
      achievementDefs.push(def);
    }
  }

  return achievementDefs;
}
