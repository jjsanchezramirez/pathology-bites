// src/features/achievements/services/achievement-service.server.ts
// SERVER-SIDE ONLY - Do not import in client components
import { createClient } from "@/shared/services/server";
import { UserStats, AchievementDefinition, checkAchievements } from "./achievement-checker";

/**
 * Get user stats from the database
 * SERVER-SIDE ONLY
 */
export async function getUserStats(userId: string): Promise<UserStats> {
  const supabase = await createClient();

  // Get total completed quizzes
  const { count: totalQuizzes } = await supabase
    .from("quiz_sessions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "completed");

  // Get perfect scores (100% accuracy)
  const { count: perfectScores } = await supabase
    .from("quiz_sessions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("score", 100);

  // Get accuracy over different numbers of recent quizzes
  const getAccuracyOverLastN = async (n: number): Promise<number> => {
    const { data: quizzes } = await supabase
      .from("quiz_sessions")
      .select("score")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(n);

    if (!quizzes || quizzes.length < n) return -1; // Not enough quizzes

    return quizzes.reduce((sum, q) => sum + (q.score || 0), 0) / quizzes.length;
  };

  const accuracyOver3 = await getAccuracyOverLastN(3);
  const accuracyOver5 = await getAccuracyOverLastN(5);
  const accuracyOver8 = await getAccuracyOverLastN(8);
  const accuracyOver10 = await getAccuracyOverLastN(10);
  const accuracyOver12 = await getAccuracyOverLastN(12);
  const accuracyOver15 = await getAccuracyOverLastN(15);

  console.log("Accuracy calculations:", {
    accuracyOver3,
    accuracyOver5,
    accuracyOver8,
    accuracyOver10,
    accuracyOver12,
    accuracyOver15,
  });

  // Get correct answers grouped by subject (for differential diagnosis achievements)
  const { data: correctAttempts } = await supabase
    .from("quiz_attempts")
    .select("question_id")
    .eq("user_id", userId)
    .eq("is_correct", true);

  const questionIds = correctAttempts?.map((a) => a.question_id) || [];
  const { data: questionsData } = await supabase
    .from("questions")
    .select("category_id")
    .in("id", questionIds.length > 0 ? questionIds : ["00000000-0000-0000-0000-000000000000"]); // Dummy ID if no questions

  // Count correct answers per subject
  const subjectCounts = new Map<string, number>();
  questionsData?.forEach((q) => {
    if (q.category_id) {
      subjectCounts.set(q.category_id, (subjectCounts.get(q.category_id) || 0) + 1);
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

  // Calculate streaks from quiz_sessions dates
  const { data: allCompletedQuizzes } = await supabase
    .from("quiz_sessions")
    .select("created_at, completed_at")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("created_at", { ascending: true });

  let currentStreak = 0;
  let longestStreak = 0;

  if (allCompletedQuizzes && allCompletedQuizzes.length > 0) {
    // Get unique dates (days) when quizzes were completed
    const uniqueDates = new Set(
      allCompletedQuizzes.map((q) => {
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

  // Calculate speed records - check perfect score quizzes with sufficient questions
  const { data: perfectQuizzes } = await supabase
    .from("quiz_sessions")
    .select("id, total_questions, total_time_spent, score")
    .eq("user_id", userId)
    .eq("status", "completed")
    .eq("score", 100); // Perfect score only

  let speedRecords10in6min = 0; // 10 questions in 6 min
  let speedRecords10in3min = 0; // 10 questions in 3 min
  let speedRecords25in12min = 0; // 25 questions in 12 min
  let speedRecords25in8min = 0; // 25 questions in 8 min
  let speedRecords25in4min = 0; // 25 questions in 4 min
  let speedRecords50in14min = 0; // 50 questions in 14 min
  let speedRecords50in11min = 0; // 50 questions in 11 min
  let speedRecords50in8min = 0; // 50 questions in 8 min

  if (perfectQuizzes && perfectQuizzes.length > 0) {
    perfectQuizzes.forEach((quiz) => {
      const totalQuestions = quiz.total_questions;
      const totalTime = quiz.total_time_spent || 0;

      // Count each qualifying quiz
      if (totalQuestions >= 10) {
        if (totalTime <= 360) {
          // 6 minutes = 360 seconds
          speedRecords10in6min++;
        }
        if (totalTime <= 180) {
          // 3 minutes = 180 seconds
          speedRecords10in3min++;
        }
      }

      if (totalQuestions >= 25) {
        if (totalTime <= 720) {
          // 12 minutes = 720 seconds
          speedRecords25in12min++;
        }
        if (totalTime <= 480) {
          // 8 minutes = 480 seconds
          speedRecords25in8min++;
        }
        if (totalTime <= 240) {
          // 4 minutes = 240 seconds
          speedRecords25in4min++;
        }
      }

      if (totalQuestions >= 50) {
        if (totalTime <= 840) {
          // 14 minutes = 840 seconds
          speedRecords50in14min++;
        }
        if (totalTime <= 660) {
          // 11 minutes = 660 seconds
          speedRecords50in11min++;
        }
        if (totalTime <= 480) {
          // 8 minutes = 480 seconds
          speedRecords50in8min++;
        }
      }
    });
  }

  console.log("Speed records:", {
    speedRecords10in6min,
    speedRecords10in3min,
    speedRecords25in12min,
    speedRecords25in8min,
    speedRecords25in4min,
    speedRecords50in14min,
    speedRecords50in11min,
    speedRecords50in8min,
  });

  const stats = {
    totalQuizzes: totalQuizzes || 0,
    perfectScores: perfectScores || 0,
    currentStreak,
    longestStreak,
    speedRecords10in6min,
    speedRecords10in3min,
    speedRecords25in12min,
    speedRecords25in8min,
    speedRecords25in4min,
    speedRecords50in14min,
    speedRecords50in11min,
    speedRecords50in8min,
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
 */
export async function awardAchievements(userId: string): Promise<AchievementDefinition[]> {
  const supabase = await createClient();

  // Get user stats
  const stats = await getUserStats(userId);

  // Check which achievements should be unlocked
  const achievementsToUnlock = checkAchievements(stats);
  console.log(
    "Achievements to unlock:",
    achievementsToUnlock.length,
    achievementsToUnlock.map((a) => a.id)
  );

  // Get already unlocked achievements
  const { data: existingAchievements } = await supabase
    .from("user_achievements")
    .select("group_key")
    .eq("user_id", userId)
    .eq("type", "achievement");

  const existingIds = new Set(existingAchievements?.map((a) => a.group_key) || []);

  // Filter out already unlocked achievements
  const newAchievements = achievementsToUnlock.filter((a) => !existingIds.has(a.id));

  // Insert new achievements
  if (newAchievements.length > 0) {
    const achievementsToInsert = newAchievements.map((achievement) => ({
      user_id: userId,
      type: "achievement",
      title: achievement.title,
      description: achievement.description,
      group_key: achievement.id,
      data: {
        category: achievement.category,
        requirement: achievement.requirement,
        animationType: achievement.animationType,
      },
      is_read: false,
      priority: "medium",
    }));

    console.log("Attempting to insert achievements:", achievementsToInsert.length);

    const { data, error } = await supabase.from("user_achievements").insert(achievementsToInsert);

    if (error) {
      console.error("Error inserting achievements:", error);
      throw new Error(`Failed to insert achievements: ${error.message}`);
    }

    console.log("Successfully inserted achievements:", data);
  } else {
    console.log("No new achievements to insert");
  }

  return newAchievements;
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

  // Get achievements unlocked in the last 5 minutes that haven't been marked as read
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const since = sinceTimestamp || fiveMinutesAgo;

  const { data: recentAchievements, error } = await supabase
    .from("user_achievements")
    .select("*")
    .eq("user_id", userId)
    .eq("type", "achievement")
    .eq("is_read", false) // Only get achievements that haven't been shown
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching recent achievements:", error);
    return [];
  }

  console.log(
    `[Achievements] Found ${recentAchievements?.length || 0} recent unshown achievements`
  );

  // Transform database records to AchievementDefinition format
  return (
    recentAchievements?.map((ach) => ({
      id: ach.group_key,
      title: ach.title,
      description: ach.description,
      category: ach.data?.category || "general",
      requirement: ach.data?.requirement || { type: "quiz_count", value: 1 },
      animationType: ach.data?.animationType || "star_medal",
    })) || []
  );
}
