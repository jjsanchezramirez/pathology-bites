// src/shared/types/achievements.ts
// This file is kept for legacy type compatibility only.
// The active achievement system uses ACHIEVEMENT_DEFINITIONS in achievement-checker.ts

export type AchievementCategory =
  | "quiz_completion"
  | "accuracy"
  | "streak"
  | "speed"
  | "mastery"
  | "special";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  icon: string;
  requirement: {
    type: string;
    value: number;
    metadata?: Record<string, unknown>;
  };
  points: number;
  unlocked: boolean;
  unlockedAt?: string;
  progress?: number;
  total?: number;
}

// Helper function to get category label
export function getCategoryLabel(category: AchievementCategory): string {
  switch (category) {
    case "quiz_completion":
      return "Quiz Completion";
    case "accuracy":
      return "Accuracy";
    case "streak":
      return "Streak";
    case "speed":
      return "Speed";
    case "mastery":
      return "Mastery";
    case "special":
      return "Special";
  }
}
