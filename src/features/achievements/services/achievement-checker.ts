// src/features/achievements/services/achievement-checker.ts

export interface UserStats {
  totalQuizzes: number;
  perfectScores: number;
  currentStreak: number;
  longestStreak: number;
  speedRecords10in6min: number; // 10 questions in 6 min
  speedRecords10in3min: number; // 10 questions in 3 min
  speedRecords25in12min: number; // 25 questions in 12 min
  speedRecords25in8min: number; // 25 questions in 8 min
  speedRecords25in4min: number; // 25 questions in 4 min
  speedRecords50in14min: number; // 50 questions in 14 min
  speedRecords50in11min: number; // 50 questions in 11 min
  speedRecords50in8min: number; // 50 questions in 8 min
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
    description: "Answer 10 Qs from 3 different subjects",
    category: "differential",
    requirement: 3,
    animationType: "trophy_large",
  },
  {
    id: "differential-25-10",
    title: "Generalist",
    description: "Answer 25 Qs from 10 different subjects",
    category: "differential",
    requirement: 10,
    animationType: "trophy_large",
  },
  {
    id: "differential-50-20",
    title: "Community Pathologist",
    description: "Answer 50 Qs from 20 different subjects",
    category: "differential",
    requirement: 20,
    animationType: "trophy_large",
  },
  {
    id: "differential-100-all",
    title: "Jack Of All Trades",
    description: "Answer 100 Qs from all subjects",
    category: "differential",
    requirement: 999, // Dynamic - checks all available subjects
    animationType: "trophy_large",
  },
];

/**
 * Check which achievements a user should unlock based on their stats
 * Only returns the highest achievement per category that the user qualifies for
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
        // Handle different speed achievement types
        if (achievement.id === "speed-10in6") {
          shouldUnlock = stats.speedRecords10in6min >= achievement.requirement;
        } else if (achievement.id === "speed-10in3") {
          shouldUnlock = stats.speedRecords10in3min >= achievement.requirement;
        } else if (achievement.id === "speed-25in12") {
          shouldUnlock = stats.speedRecords25in12min >= achievement.requirement;
        } else if (achievement.id === "speed-25in8") {
          shouldUnlock = stats.speedRecords25in8min >= achievement.requirement;
        } else if (achievement.id === "speed-25in4") {
          shouldUnlock = stats.speedRecords25in4min >= achievement.requirement;
        } else if (achievement.id === "speed-50in14") {
          shouldUnlock = stats.speedRecords50in14min >= achievement.requirement;
        } else if (achievement.id === "speed-50in11") {
          shouldUnlock = stats.speedRecords50in11min >= achievement.requirement;
        } else if (achievement.id === "speed-50in8") {
          shouldUnlock = stats.speedRecords50in8min >= achievement.requirement;
        }
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
            stats.subjectsWith100Questions >= stats.totalCategories;
        }
        break;
    }

    if (shouldUnlock) {
      qualifiedAchievements.push(achievement);
    }
  }

  // Group by category and keep only the highest requirement achievement per category
  const categoryMap = new Map<string, AchievementDefinition>();

  for (const achievement of qualifiedAchievements) {
    const existing = categoryMap.get(achievement.category);
    if (!existing || achievement.requirement > existing.requirement) {
      categoryMap.set(achievement.category, achievement);
    }
  }

  return Array.from(categoryMap.values());
}
