// src/features/achievements/services/achievement-checker.ts

export interface UserStats {
  totalQuizzes: number;
  perfectScores: number;
  currentStreak: number;
  longestStreak: number;
  accuracyOver3: number; // accuracy over last 3 quizzes
  accuracyOver5: number; // accuracy over last 5 quizzes
  accuracyOver8: number; // accuracy over last 8 quizzes
  accuracyOver10: number; // accuracy over last 10 quizzes
  accuracyOver12: number; // accuracy over last 12 quizzes
  accuracyOver15: number; // accuracy over last 15 quizzes
  subjectsWith10Questions: number; // subjects with >= 10 correct answers
  subjectsWith25Questions: number; // subjects with >= 25 correct answers
  subjectsWith50Questions: number; // subjects with >= 50 correct answers
  subjectsWith100Questions: number; // subjects with >= 100 correct answers
  totalCategories?: number; // Total number of categories with questions
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  category: "quiz" | "perfect" | "streak" | "speed" | "accuracy" | "differential";
  requirement: number;
  animationType: "badge" | "medal" | "star_badge" | "star_medal" | "crown" | "trophy_large";
}

// Define all achievements
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // Diagnostic Experience (Quiz Count)
  {
    id: "quiz-1",
    title: "First Case",
    description: "Complete 1 quiz",
    category: "quiz",
    requirement: 1,
    animationType: "medal",
  },
  {
    id: "quiz-5",
    title: "Junior Resident",
    description: "Complete 5 quizzes",
    category: "quiz",
    requirement: 5,
    animationType: "medal",
  },
  {
    id: "quiz-10",
    title: "Senior Resident",
    description: "Complete 10 quizzes",
    category: "quiz",
    requirement: 10,
    animationType: "medal",
  },
  {
    id: "quiz-20",
    title: "Pathology Fellow",
    description: "Complete 20 quizzes",
    category: "quiz",
    requirement: 20,
    animationType: "medal",
  },
  {
    id: "quiz-30",
    title: "Junior Attending",
    description: "Complete 30 quizzes",
    category: "quiz",
    requirement: 30,
    animationType: "medal",
  },
  {
    id: "quiz-50",
    title: "Attending Pathologist",
    description: "Complete 50 quizzes",
    category: "quiz",
    requirement: 50,
    animationType: "medal",
  },
  {
    id: "quiz-80",
    title: "Expert Pathologist",
    description: "Complete 80 quizzes",
    category: "quiz",
    requirement: 80,
    animationType: "medal",
  },
  {
    id: "quiz-100",
    title: "Legendary Pathologist",
    description: "Complete 100 quizzes",
    category: "quiz",
    requirement: 100,
    animationType: "medal",
  },

  // Perfectionist (Perfect Scores)
  {
    id: "perfect-1",
    title: "Flawless Victory",
    description: "Get 100% on 1 quiz",
    category: "perfect",
    requirement: 1,
    animationType: "star_medal",
  },
  {
    id: "perfect-5",
    title: "Fab Five",
    description: "Get 100% on 5 quizzes",
    category: "perfect",
    requirement: 5,
    animationType: "star_medal",
  },
  {
    id: "perfect-10",
    title: "Perfect Ten",
    description: "Get 100% on 10 quizzes",
    category: "perfect",
    requirement: 10,
    animationType: "star_medal",
  },
  {
    id: "perfect-25",
    title: "Beyond Compare",
    description: "Get 100% on 25 quizzes",
    category: "perfect",
    requirement: 25,
    animationType: "star_medal",
  },

  // Daily Sign-Out (Streaks)
  {
    id: "streak-1",
    title: "First Sign-Out",
    description: "Maintain a 1-day streak",
    category: "streak",
    requirement: 1,
    animationType: "badge",
  },
  {
    id: "streak-3",
    title: "Three Day Streak",
    description: "Maintain a 3-day streak",
    category: "streak",
    requirement: 3,
    animationType: "badge",
  },
  {
    id: "streak-5",
    title: "Five Day Streak",
    description: "Maintain a 5-day streak",
    category: "streak",
    requirement: 5,
    animationType: "badge",
  },
  {
    id: "streak-7",
    title: "One Week Streak",
    description: "Maintain a 7-day streak",
    category: "streak",
    requirement: 7,
    animationType: "badge",
  },
  {
    id: "streak-10",
    title: "Ten Day Streak",
    description: "Maintain a 10-day streak",
    category: "streak",
    requirement: 10,
    animationType: "badge",
  },
  {
    id: "streak-14",
    title: "Two Week Streak",
    description: "Maintain a 14-day streak",
    category: "streak",
    requirement: 14,
    animationType: "badge",
  },
  {
    id: "streak-30",
    title: "One Month Streak",
    description: "Maintain a 30-day streak",
    category: "streak",
    requirement: 30,
    animationType: "badge",
  },
  {
    id: "streak-45",
    title: "Unremitting",
    description: "Maintain a 45-day streak",
    category: "streak",
    requirement: 45,
    animationType: "badge",
  },
  {
    id: "streak-60",
    title: "Two Month Streak",
    description: "Maintain a 60-day streak",
    category: "streak",
    requirement: 60,
    animationType: "badge",
  },
  {
    id: "streak-75",
    title: "Unstoppable",
    description: "Maintain a 75-day streak",
    category: "streak",
    requirement: 75,
    animationType: "badge",
  },
  {
    id: "streak-90",
    title: "Three Month Streak",
    description: "Maintain a 90-day streak",
    category: "streak",
    requirement: 90,
    animationType: "badge",
  },
  {
    id: "streak-100",
    title: "100-Day Legend",
    description: "Maintain a 100-day streak",
    category: "streak",
    requirement: 100,
    animationType: "badge",
  },

  // Pattern Recognition (Speed)
  {
    id: "speed-10in6",
    title: "Quick Thinker",
    description: "Get 100% on 10 Qs in 6 minutes or less",
    category: "speed",
    requirement: 1,
    animationType: "star_badge",
  },
  {
    id: "speed-10in3",
    title: "Rapid Onset",
    description: "Get 100% on 10 Qs in 3 minutes or less",
    category: "speed",
    requirement: 1,
    animationType: "star_badge",
  },
  {
    id: "speed-25in12",
    title: "Lightning Fast",
    description: "Get 100% on 25 Qs in 12 minutes or less",
    category: "speed",
    requirement: 1,
    animationType: "star_badge",
  },
  {
    id: "speed-25in8",
    title: "Pattern Seeker",
    description: "Get 100% on 25 Qs in 8 minutes or less",
    category: "speed",
    requirement: 1,
    animationType: "star_badge",
  },
  {
    id: "speed-25in4",
    title: "Stat Diagnosis",
    description: "Get 100% on 25 Qs in 4 minutes or less",
    category: "speed",
    requirement: 1,
    animationType: "star_badge",
  },
  {
    id: "speed-50in14",
    title: "Biopsy Blitz",
    description: "Get 100% on 50 Qs in 14 minutes or less",
    category: "speed",
    requirement: 1,
    animationType: "star_badge",
  },
  {
    id: "speed-50in11",
    title: "Speed Demon",
    description: "Get 100% on 50 Qs in 11 minutes or less",
    category: "speed",
    requirement: 1,
    animationType: "star_badge",
  },
  {
    id: "speed-50in8",
    title: "Instant Pattern Recognition",
    description: "Get 100% on 50 Qs in 8 minutes or less",
    category: "speed",
    requirement: 1,
    animationType: "star_badge",
  },

  // Diagnostic Accuracy (Overall Accuracy)
  {
    id: "accuracy-50-3",
    title: "Building Foundations",
    description: "Score 50% or higher over last 3 quizzes",
    category: "accuracy",
    requirement: 50,
    animationType: "crown",
  },
  {
    id: "accuracy-60-5",
    title: "Competent Clinician",
    description: "Score 60% or higher over last 5 quizzes",
    category: "accuracy",
    requirement: 60,
    animationType: "crown",
  },
  {
    id: "accuracy-70-8",
    title: "Reliable Diagnostician",
    description: "Score 70% or higher over last 8 quizzes",
    category: "accuracy",
    requirement: 70,
    animationType: "crown",
  },
  {
    id: "accuracy-80-10",
    title: "Expert Consultant",
    description: "Score 80% or higher over last 10 quizzes",
    category: "accuracy",
    requirement: 80,
    animationType: "crown",
  },
  {
    id: "accuracy-90-12",
    title: "Master Diagnostician",
    description: "Score 90% or higher over last 12 quizzes",
    category: "accuracy",
    requirement: 90,
    animationType: "crown",
  },
  {
    id: "accuracy-100-15",
    title: "Flawless Diagnostician",
    description: "Score 100% over last 15 quizzes",
    category: "accuracy",
    requirement: 100,
    animationType: "crown",
  },

  // Differential Diagnosis (Subject Variety)
  {
    id: "differential-10-3",
    title: "Broad Exposure",
    description: "Reach 10 correct in 3 subjects",
    category: "differential",
    requirement: 3,
    animationType: "trophy_large",
  },
  {
    id: "differential-25-10",
    title: "Generalist",
    description: "Reach 25 correct in 10 subjects",
    category: "differential",
    requirement: 10,
    animationType: "trophy_large",
  },
  {
    id: "differential-50-20",
    title: "Community Pathologist",
    description: "Reach 50 correct in 20 subjects",
    category: "differential",
    requirement: 20,
    animationType: "trophy_large",
  },
  {
    id: "differential-100-all",
    title: "Jack Of All Trades",
    description: "Reach 100 correct in all subjects",
    category: "differential",
    requirement: 999, // Dynamic - checks all available subjects
    animationType: "trophy_large",
  },
];

/**
 * Check which achievements a user should unlock based on their stats
 * Returns ALL qualified achievements (not just the highest per category)
 * Sequential checking is now handled by checkSequentialAchievements
 */
export function checkAchievements(stats: UserStats): AchievementDefinition[] {
  const qualifiedAchievements: AchievementDefinition[] = [];

  for (const achievement of ACHIEVEMENT_DEFINITIONS) {
    let shouldUnlock = false;

    switch (achievement.category) {
      case "quiz":
        shouldUnlock = stats.totalQuizzes >= achievement.requirement;
        break;
      case "perfect":
        shouldUnlock = stats.perfectScores >= achievement.requirement;
        break;
      case "streak":
        shouldUnlock = stats.longestStreak >= achievement.requirement;
        break;
      case "speed":
        // Speed achievements are handled separately per quiz (not stat-based)
        // This function only checks stat-based achievements
        shouldUnlock = false;
        break;
      case "accuracy":
        // Handle different accuracy achievement types based on quiz count
        // Only unlock if user has enough quizzes for the requirement
        if (achievement.id === "accuracy-50-3") {
          shouldUnlock = stats.totalQuizzes >= 3 && stats.accuracyOver3 >= achievement.requirement;
        } else if (achievement.id === "accuracy-60-5") {
          shouldUnlock = stats.totalQuizzes >= 5 && stats.accuracyOver5 >= achievement.requirement;
        } else if (achievement.id === "accuracy-70-8") {
          shouldUnlock = stats.totalQuizzes >= 8 && stats.accuracyOver8 >= achievement.requirement;
        } else if (achievement.id === "accuracy-80-10") {
          shouldUnlock =
            stats.totalQuizzes >= 10 && stats.accuracyOver10 >= achievement.requirement;
        } else if (achievement.id === "accuracy-90-12") {
          shouldUnlock =
            stats.totalQuizzes >= 12 && stats.accuracyOver12 >= achievement.requirement;
        } else if (achievement.id === "accuracy-100-15") {
          shouldUnlock =
            stats.totalQuizzes >= 15 && stats.accuracyOver15 >= achievement.requirement;
        }
        break;
      case "differential":
        // Handle different differential achievement types based on question count per subject
        if (achievement.id === "differential-10-3") {
          shouldUnlock = stats.subjectsWith10Questions >= achievement.requirement;
        } else if (achievement.id === "differential-25-10") {
          shouldUnlock = stats.subjectsWith25Questions >= achievement.requirement;
        } else if (achievement.id === "differential-50-20") {
          shouldUnlock = stats.subjectsWith50Questions >= achievement.requirement;
        } else if (achievement.id === "differential-100-all") {
          // For "all subjects", check if user has 100+ questions from all available subjects
          shouldUnlock =
            stats.totalCategories !== undefined &&
            stats.totalCategories > 0 &&
            stats.subjectsWith100Questions >= stats.totalCategories;
        }
        break;
    }

    if (shouldUnlock) {
      qualifiedAchievements.push(achievement);
    }
  }

  return qualifiedAchievements;
}

/**
 * Filter qualified achievements to only include the next sequential one per category
 * Speed achievements are excluded (handled separately)
 */
export function checkSequentialAchievements(
  qualifiedAchievements: AchievementDefinition[],
  unlockedIds: Set<string>
): AchievementDefinition[] {
  const achievementsToUnlock: AchievementDefinition[] = [];

  // Group achievements by category
  const categories = ["quiz", "perfect", "streak", "accuracy", "differential"] as const;

  for (const category of categories) {
    const categoryAchievements = ACHIEVEMENT_DEFINITIONS.filter(
      (a) => a.category === category
    ).sort((a, b) => a.requirement - b.requirement);

    // Find the next one to unlock
    for (const achievement of categoryAchievements) {
      if (unlockedIds.has(achievement.id)) {
        continue; // Already unlocked, skip
      }

      // Check if it's qualified
      if (qualifiedAchievements.some((a) => a.id === achievement.id)) {
        achievementsToUnlock.push(achievement);
        break; // Only unlock one per category
      } else {
        break; // If not qualified, can't unlock higher ones
      }
    }
  }

  return achievementsToUnlock;
}

/**
 * Check if a quiz qualifies for speed achievements
 * Returns array of speed achievement IDs that should be unlocked
 */
export function checkSpeedAchievements(
  totalQuestions: number,
  totalTimeSpent: number,
  score: number,
  unlockedIds: Set<string>
): string[] {
  // Speed achievements only count for perfect scores
  if (score !== 100) {
    return [];
  }

  const unlockedSpeedAchievements: string[] = [];

  // Speed criteria mapping: [achievementId, minQuestions, maxSeconds]
  const speedCriteria: Array<[string, number, number]> = [
    ["speed-10in6", 10, 360], // 10 questions in 6 minutes (360 seconds)
    ["speed-10in3", 10, 180], // 10 questions in 3 minutes (180 seconds)
    ["speed-25in12", 25, 720], // 25 questions in 12 minutes (720 seconds)
    ["speed-25in8", 25, 480], // 25 questions in 8 minutes (480 seconds)
    ["speed-25in4", 25, 240], // 25 questions in 4 minutes (240 seconds)
    ["speed-50in14", 50, 840], // 50 questions in 14 minutes (840 seconds)
    ["speed-50in11", 50, 660], // 50 questions in 11 minutes (660 seconds)
    ["speed-50in8", 50, 480], // 50 questions in 8 minutes (480 seconds)
  ];

  for (const [achievementId, minQuestions, maxSeconds] of speedCriteria) {
    // Skip if already unlocked
    if (unlockedIds.has(achievementId)) {
      continue;
    }

    // Check if quiz meets criteria
    if (totalQuestions >= minQuestions && totalTimeSpent <= maxSeconds) {
      unlockedSpeedAchievements.push(achievementId);
    }
  }

  return unlockedSpeedAchievements;
}
