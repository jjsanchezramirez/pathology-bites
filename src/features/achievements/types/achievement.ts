// src/features/achievements/types/achievement.ts

import { LucideIcon } from 'lucide-react'

export interface Achievement {
  id: string
  title: string
  description: string
  icon: LucideIcon
  iconColor: string
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

