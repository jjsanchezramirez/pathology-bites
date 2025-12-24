// src/features/performance/services/achievement-service.ts

import { Achievement, BADGE_DEFINITIONS } from '@/shared/types/achievements'

interface UserStats {
  completedQuizzes: number
  overallScore: number
  currentStreak?: number
  perfectQuizzes?: number
  fastAnswers?: number
  categoryMastery?: Record<string, number>
}

/**
 * Calculate which achievements a user has earned and their progress
 */
export function calculateAchievements(stats: UserStats): Achievement[] {
  return BADGE_DEFINITIONS.map(badge => {
    let unlocked = false
    let progress = 0
    let total = badge.requirement.value

    switch (badge.requirement.type) {
      case 'quiz_count':
        progress = stats.completedQuizzes
        unlocked = stats.completedQuizzes >= badge.requirement.value
        break

      case 'accuracy':
        progress = Math.round(stats.overallScore)
        unlocked = stats.overallScore >= badge.requirement.value
        break

      case 'streak_days':
        progress = stats.currentStreak || 0
        unlocked = (stats.currentStreak || 0) >= badge.requirement.value
        break

      case 'perfect_quiz':
        progress = stats.perfectQuizzes || 0
        unlocked = (stats.perfectQuizzes || 0) >= badge.requirement.value
        break

      case 'speed':
        progress = stats.fastAnswers || 0
        unlocked = (stats.fastAnswers || 0) >= badge.requirement.value
        break

      case 'category_mastery':
        if (badge.requirement.categoryId && stats.categoryMastery) {
          const categoryScore = stats.categoryMastery[badge.requirement.categoryId] || 0
          progress = Math.round(categoryScore)
          unlocked = categoryScore >= badge.requirement.value
        }
        break
    }

    return {
      id: badge.id,
      name: badge.name,
      description: badge.description,
      category: badge.category,
      tier: badge.tier,
      icon: badge.icon,
      requirement: badge.requirement,
      points: badge.points,
      unlocked,
      progress,
      total,
      // You would fetch this from the database in a real implementation
      unlockedAt: unlocked ? new Date().toISOString() : undefined
    }
  })
}

/**
 * Calculate total points earned from achievements
 */
export function calculateTotalPoints(achievements: Achievement[]): number {
  return achievements
    .filter(a => a.unlocked)
    .reduce((sum, a) => sum + a.points, 0)
}

/**
 * Get achievements grouped by category
 */
export function groupAchievementsByCategory(achievements: Achievement[]) {
  const grouped: Record<string, Achievement[]> = {
    quiz_completion: [],
    accuracy: [],
    streak: [],
    speed: [],
    mastery: [],
    special: []
  }

  achievements.forEach(achievement => {
    grouped[achievement.category].push(achievement)
  })

  return grouped
}

/**
 * Get recently unlocked achievements (for showing in recent activity)
 */
export function getRecentlyUnlocked(achievements: Achievement[], days: number = 7): Achievement[] {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)

  return achievements
    .filter(a => a.unlocked && a.unlockedAt)
    .filter(a => new Date(a.unlockedAt!) >= cutoffDate)
    .sort((a, b) => {
      if (!a.unlockedAt || !b.unlockedAt) return 0
      return new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime()
    })
}

/**
 * Get next achievements the user is close to unlocking
 */
export function getNextAchievements(achievements: Achievement[], count: number = 3): Achievement[] {
  return achievements
    .filter(a => !a.unlocked && a.progress !== undefined && a.total !== undefined)
    .map(a => ({
      ...a,
      progressPercent: (a.progress! / a.total!) * 100
    }))
    .sort((a, b) => b.progressPercent - a.progressPercent)
    .slice(0, count)
}
