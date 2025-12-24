// src/shared/types/achievements.ts

export type AchievementCategory =
  | 'quiz_completion'
  | 'accuracy'
  | 'streak'
  | 'speed'
  | 'mastery'
  | 'special'

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

export interface Achievement {
  id: string
  name: string
  description: string
  category: AchievementCategory
  tier: AchievementTier
  icon: string
  requirement: {
    type: string
    value: number
    metadata?: Record<string, any>
  }
  points: number
  unlocked: boolean
  unlockedAt?: string
  progress?: number
  total?: number
}

export interface BadgeDefinition {
  id: string
  name: string
  description: string
  category: AchievementCategory
  tier: AchievementTier
  icon: string
  requirement: {
    type: 'quiz_count' | 'accuracy' | 'streak_days' | 'category_mastery' | 'perfect_quiz' | 'speed'
    value: number
    categoryId?: string
    categoryName?: string
  }
  points: number
}

// All available badges
export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // Quiz Completion Badges
  {
    id: 'first_quiz',
    name: 'First Steps',
    description: 'Complete your first quiz',
    category: 'quiz_completion',
    tier: 'bronze',
    icon: 'Play',
    requirement: { type: 'quiz_count', value: 1 },
    points: 10
  },
  {
    id: 'quiz_enthusiast',
    name: 'Quiz Enthusiast',
    description: 'Complete 5 quizzes',
    category: 'quiz_completion',
    tier: 'bronze',
    icon: 'BookOpen',
    requirement: { type: 'quiz_count', value: 5 },
    points: 25
  },
  {
    id: 'dedicated_learner',
    name: 'Dedicated Learner',
    description: 'Complete 10 quizzes',
    category: 'quiz_completion',
    tier: 'silver',
    icon: 'GraduationCap',
    requirement: { type: 'quiz_count', value: 10 },
    points: 50
  },
  {
    id: 'quiz_master',
    name: 'Quiz Master',
    description: 'Complete 25 quizzes',
    category: 'quiz_completion',
    tier: 'gold',
    icon: 'Trophy',
    requirement: { type: 'quiz_count', value: 25 },
    points: 100
  },
  {
    id: 'quiz_legend',
    name: 'Quiz Legend',
    description: 'Complete 50 quizzes',
    category: 'quiz_completion',
    tier: 'platinum',
    icon: 'Crown',
    requirement: { type: 'quiz_count', value: 50 },
    points: 250
  },
  {
    id: 'quiz_champion',
    name: 'Quiz Champion',
    description: 'Complete 100 quizzes',
    category: 'quiz_completion',
    tier: 'diamond',
    icon: 'Award',
    requirement: { type: 'quiz_count', value: 100 },
    points: 500
  },

  // Accuracy Badges
  {
    id: 'accuracy_70',
    name: 'Getting There',
    description: 'Achieve 70% overall accuracy',
    category: 'accuracy',
    tier: 'bronze',
    icon: 'Target',
    requirement: { type: 'accuracy', value: 70 },
    points: 30
  },
  {
    id: 'accuracy_80',
    name: '80% Club',
    description: 'Achieve 80% overall accuracy',
    category: 'accuracy',
    tier: 'silver',
    icon: 'Target',
    requirement: { type: 'accuracy', value: 80 },
    points: 75
  },
  {
    id: 'accuracy_90',
    name: '90% Elite',
    description: 'Achieve 90% overall accuracy',
    category: 'accuracy',
    tier: 'gold',
    icon: 'Crosshair',
    requirement: { type: 'accuracy', value: 90 },
    points: 150
  },
  {
    id: 'accuracy_95',
    name: 'Near Perfect',
    description: 'Achieve 95% overall accuracy',
    category: 'accuracy',
    tier: 'platinum',
    icon: 'Sparkles',
    requirement: { type: 'accuracy', value: 95 },
    points: 300
  },

  // Perfect Quiz Badges
  {
    id: 'perfect_quiz',
    name: 'Perfectionist',
    description: 'Score 100% on a quiz',
    category: 'accuracy',
    tier: 'gold',
    icon: 'Star',
    requirement: { type: 'perfect_quiz', value: 1 },
    points: 100
  },

  // Streak Badges
  {
    id: 'streak_3',
    name: 'On a Roll',
    description: 'Maintain a 3-day study streak',
    category: 'streak',
    tier: 'bronze',
    icon: 'Flame',
    requirement: { type: 'streak_days', value: 3 },
    points: 20
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Maintain a 7-day study streak',
    category: 'streak',
    tier: 'silver',
    icon: 'Flame',
    requirement: { type: 'streak_days', value: 7 },
    points: 50
  },
  {
    id: 'streak_14',
    name: 'Two Week Champion',
    description: 'Maintain a 14-day study streak',
    category: 'streak',
    tier: 'gold',
    icon: 'Zap',
    requirement: { type: 'streak_days', value: 14 },
    points: 100
  },
  {
    id: 'streak_30',
    name: 'Monthly Master',
    description: 'Maintain a 30-day study streak',
    category: 'streak',
    tier: 'platinum',
    icon: 'Zap',
    requirement: { type: 'streak_days', value: 30 },
    points: 250
  },

  // Speed Badges
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Answer 10 questions correctly in under 30 seconds each',
    category: 'speed',
    tier: 'silver',
    icon: 'Rocket',
    requirement: { type: 'speed', value: 10 },
    points: 75
  }
]

// Helper function to get tier color
export function getTierColor(tier: AchievementTier): string {
  switch (tier) {
    case 'bronze':
      return 'text-orange-600 dark:text-orange-400'
    case 'silver':
      return 'text-gray-400 dark:text-gray-300'
    case 'gold':
      return 'text-yellow-500 dark:text-yellow-400'
    case 'platinum':
      return 'text-cyan-400 dark:text-cyan-300'
    case 'diamond':
      return 'text-purple-500 dark:text-purple-400'
  }
}

// Helper function to get tier background color
export function getTierBgColor(tier: AchievementTier): string {
  switch (tier) {
    case 'bronze':
      return 'bg-orange-100 dark:bg-orange-950'
    case 'silver':
      return 'bg-gray-100 dark:bg-gray-800'
    case 'gold':
      return 'bg-yellow-100 dark:bg-yellow-950'
    case 'platinum':
      return 'bg-cyan-100 dark:bg-cyan-950'
    case 'diamond':
      return 'bg-purple-100 dark:bg-purple-950'
  }
}

// Helper function to get category label
export function getCategoryLabel(category: AchievementCategory): string {
  switch (category) {
    case 'quiz_completion':
      return 'Quiz Completion'
    case 'accuracy':
      return 'Accuracy'
    case 'streak':
      return 'Streak'
    case 'speed':
      return 'Speed'
    case 'mastery':
      return 'Mastery'
    case 'special':
      return 'Special'
  }
}
