// src/features/achievements/types/achievement.ts

export type AnimationType = 'badge' | 'medal' | 'star_badge' | 'star_medal' | 'crown' | 'trophy_large'

export interface Achievement {
  id: string
  title: string
  description: string
  animationType: AnimationType
  category: 'quiz' | 'perfect' | 'streak' | 'speed' | 'accuracy'
  requirement: number
  isUnlocked: boolean
  progress: number
  unlockedDate?: string
}

export interface AchievementCategory {
  id: string
  title: string
  description: string
  achievements: Achievement[]
}

