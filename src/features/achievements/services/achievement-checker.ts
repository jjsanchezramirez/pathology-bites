// src/features/achievements/services/achievement-checker.ts

export interface UserStats {
  totalQuizzes: number;
  perfectScores: number;
  currentStreak: number;
  longestStreak: number;
  speedRecords5min: number; // 10 questions in 5 min
  speedRecords2min: number; // 10 questions in 2 min
  speedRecords25in5min: number; // 25 questions in 5 min
  speedRecords25in2min: number; // 25 questions in 2 min
  recentAccuracy: number;
  uniqueSubjects: number;
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
    title: "First Steps",
    description: "Complete your first quiz",
    category: "quiz",
    requirement: 1,
    animationType: "medal",
  },
  {
    id: "quiz-5",
    title: "Emerging Diagnostician",
    description: "Complete 5 quizzes",
    category: "quiz",
    requirement: 5,
    animationType: "medal",
  },
  {
    id: "quiz-10",
    title: "Dedicated Learner",
    description: "Complete 10 quizzes",
    category: "quiz",
    requirement: 10,
    animationType: "medal",
  },
  {
    id: "quiz-25",
    title: "Quiz Enthusiast",
    description: "Complete 25 quizzes",
    category: "quiz",
    requirement: 25,
    animationType: "medal",
  },
  {
    id: "quiz-50",
    title: "Quiz Expert",
    description: "Complete 50 quizzes",
    category: "quiz",
    requirement: 50,
    animationType: "medal",
  },
  {
    id: "quiz-100",
    title: "Quiz Legend",
    description: "Complete 100 quizzes",
    category: "quiz",
    requirement: 100,
    animationType: "medal",
  },

  // Perfectionist (Perfect Scores)
  {
    id: "perfect-1",
    title: "Flawless Victory",
    description: "Get a perfect score on 1 quiz",
    category: "perfect",
    requirement: 1,
    animationType: "star_medal",
  },
  {
    id: "perfect-5",
    title: "Perfection Streak",
    description: "Get perfect scores on 5 quizzes",
    category: "perfect",
    requirement: 5,
    animationType: "star_medal",
  },
  {
    id: "perfect-10",
    title: "Master of Perfection",
    description: "Get perfect scores on 10 quizzes",
    category: "perfect",
    requirement: 10,
    animationType: "star_medal",
  },

  // Daily Sign-Out (Streaks)
  {
    id: "streak-1",
    title: "Day One",
    description: "Maintain a 1-day streak",
    category: "streak",
    requirement: 1,
    animationType: "badge",
  },
  {
    id: "streak-3",
    title: "Three Days Strong",
    description: "Maintain a 3-day streak",
    category: "streak",
    requirement: 3,
    animationType: "badge",
  },
  {
    id: "streak-5",
    title: "Five Day Fire",
    description: "Maintain a 5-day streak",
    category: "streak",
    requirement: 5,
    animationType: "badge",
  },
  {
    id: "streak-7",
    title: "Week Warrior",
    description: "Maintain a 7-day streak",
    category: "streak",
    requirement: 7,
    animationType: "badge",
  },
  {
    id: "streak-10",
    title: "Ten Days Blazing",
    description: "Maintain a 10-day streak",
    category: "streak",
    requirement: 10,
    animationType: "badge",
  },
  {
    id: "streak-14",
    title: "Two Week Champion",
    description: "Maintain a 14-day streak",
    category: "streak",
    requirement: 14,
    animationType: "badge",
  },
  {
    id: "streak-30",
    title: "Monthly Master",
    description: "Maintain a 30-day streak",
    category: "streak",
    requirement: 30,
    animationType: "badge",
  },
  {
    id: "streak-45",
    title: "Unstoppable Force",
    description: "Maintain a 45-day streak",
    category: "streak",
    requirement: 45,
    animationType: "badge",
  },
  {
    id: "streak-60",
    title: "Two Month Legend",
    description: "Maintain a 60-day streak",
    category: "streak",
    requirement: 60,
    animationType: "badge",
  },
  {
    id: "streak-90",
    title: "Three Month Titan",
    description: "Maintain a 90-day streak",
    category: "streak",
    requirement: 90,
    animationType: "badge",
  },
  {
    id: "streak-100",
    title: "Century of Learning",
    description: "Maintain a 100-day streak",
    category: "streak",
    requirement: 100,
    animationType: "badge",
  },

  // Pattern Recognition (Speed)
  {
    id: "speed-10in5",
    title: "Lightning Fast",
    description: "Answer 10 questions correctly in 5 minutes or less",
    category: "speed",
    requirement: 1,
    animationType: "star_badge",
  },
  {
    id: "speed-10in2",
    title: "Rapid Diagnosis",
    description: "Answer 10 questions correctly in 2 minutes or less",
    category: "speed",
    requirement: 1,
    animationType: "star_badge",
  },
  {
    id: "speed-25in5",
    title: "Pattern Master",
    description: "Answer 25 questions correctly in 5 minutes or less",
    category: "speed",
    requirement: 1,
    animationType: "star_badge",
  },
  {
    id: "speed-25in2",
    title: "Instant Pattern Recognition",
    description: "Answer 25 questions correctly in 2 minutes or less",
    category: "speed",
    requirement: 1,
    animationType: "star_badge",
  },

  // Diagnostic Accuracy (Overall Accuracy)
  {
    id: "accuracy-50",
    title: "Half Way There",
    description: "Achieve 50% or higher accuracy over last 10 quizzes",
    category: "accuracy",
    requirement: 50,
    animationType: "crown",
  },
  {
    id: "accuracy-60",
    title: "Competent Clinician",
    description: "Achieve 60% or higher accuracy over last 10 quizzes",
    category: "accuracy",
    requirement: 60,
    animationType: "crown",
  },
  {
    id: "accuracy-70",
    title: "Reliable Diagnostician",
    description: "Achieve 70% or higher accuracy over last 10 quizzes",
    category: "accuracy",
    requirement: 70,
    animationType: "crown",
  },
  {
    id: "accuracy-80",
    title: "Expert Consultant",
    description: "Achieve 80% or higher accuracy over last 10 quizzes",
    category: "accuracy",
    requirement: 80,
    animationType: "crown",
  },
  {
    id: "accuracy-90",
    title: "Master Diagnostician",
    description: "Achieve 90% or higher accuracy over last 10 quizzes",
    category: "accuracy",
    requirement: 90,
    animationType: "crown",
  },

  // Differential Diagnosis (Subject Variety)
  {
    id: "differential-3",
    title: "Broad Exposure",
    description: "Answer questions from 3 different subjects",
    category: "differential",
    requirement: 3,
    animationType: "trophy_large",
  },
  {
    id: "differential-10",
    title: "Community Pathologist",
    description: "Answer questions from 10 different subjects",
    category: "differential",
    requirement: 10,
    animationType: "trophy_large",
  },
  {
    id: "differential-all",
    title: "Multidisciplinary",
    description: "Answer questions from all subjects",
    category: "differential",
    requirement: 999,
    animationType: "trophy_large",
  }, // 999 as a placeholder, will be dynamic
];

/**
 * Check which achievements a user should unlock based on their stats
 */
export function checkAchievements(stats: UserStats): AchievementDefinition[] {
  const newAchievements: AchievementDefinition[] = [];

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
        if (achievement.id === "speed-10in5") {
          shouldUnlock = stats.speedRecords5min >= achievement.requirement;
        } else if (achievement.id === "speed-10in2") {
          shouldUnlock = stats.speedRecords2min >= achievement.requirement;
        } else if (achievement.id === "speed-25in5") {
          shouldUnlock = stats.speedRecords25in5min >= achievement.requirement;
        } else if (achievement.id === "speed-25in2") {
          shouldUnlock = stats.speedRecords25in2min >= achievement.requirement;
        }
        break;
      case "accuracy":
        shouldUnlock = stats.recentAccuracy >= achievement.requirement;
        break;
      case "differential":
        // For the "all subjects" achievement, compare against total categories
        if (achievement.id === "differential-all" && stats.totalCategories) {
          shouldUnlock = stats.uniqueSubjects >= stats.totalCategories;
        } else {
          shouldUnlock = stats.uniqueSubjects >= achievement.requirement;
        }
        break;
    }

    if (shouldUnlock) {
      newAchievements.push(achievement);
    }
  }

  return newAchievements;
}
