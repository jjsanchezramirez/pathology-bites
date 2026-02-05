// src/features/achievements/types/achievement.ts

export type AnimationType =
  | "badge"
  | "medal"
  | "star_badge"
  | "star_medal"
  | "crown"
  | "trophy_large";

// Full achievement with display metadata (used client-side for rendering)
export interface Achievement {
  id: string;
  title: string;
  description: string;
  animationType: AnimationType;
  category: "quiz" | "perfect" | "streak" | "speed" | "accuracy" | "differential";
  requirement: number;
  isUnlocked: boolean;
  progress: number;
  unlockedDate?: string;
}

// Optimized achievement progress (used in API responses and cache)
export interface AchievementProgress {
  id: string;
  requirement: number;
  isUnlocked: boolean;
  progress: number;
  unlockedDate?: string;
}

export interface AchievementCategory {
  id: string;
  title: string;
  description: string;
  achievements: Achievement[];
}
