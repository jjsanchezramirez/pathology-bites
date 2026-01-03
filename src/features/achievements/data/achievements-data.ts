// src/features/achievements/data/achievements-data.ts

import { AchievementCategory } from '../types/achievement'

// Mock data - will be replaced with real user data from the database
const mockUserStats = {
  totalQuizzes: 12,
  perfectScores: 2,
  currentStreak: 5,
  longestStreak: 7,
  speedRecords: 1,
  recentAccuracy: 75 // percentage over last 10 quizzes
}

export const achievementCategories: AchievementCategory[] = [
  {
    id: 'quiz-count',
    title: 'Quiz Master',
    description: 'Complete quizzes to unlock these achievements',
    achievements: [
      {
        id: 'quiz-1',
        title: 'First Steps',
        description: 'Complete your first quiz',
        animationType: 'medal',
        category: 'quiz',
        requirement: 1,
        isUnlocked: mockUserStats.totalQuizzes >= 1,
        progress: mockUserStats.totalQuizzes,
        unlockedDate: mockUserStats.totalQuizzes >= 1 ? '2024-01-15' : undefined
      },
      {
        id: 'quiz-5',
        title: 'Getting Started',
        description: 'Complete 5 quizzes',
        animationType: 'medal',
        category: 'quiz',
        requirement: 5,
        isUnlocked: mockUserStats.totalQuizzes >= 5,
        progress: mockUserStats.totalQuizzes,
        unlockedDate: mockUserStats.totalQuizzes >= 5 ? '2024-01-20' : undefined
      },
      {
        id: 'quiz-10',
        title: 'Dedicated Learner',
        description: 'Complete 10 quizzes',
        animationType: 'medal',
        category: 'quiz',
        requirement: 10,
        isUnlocked: mockUserStats.totalQuizzes >= 10,
        progress: mockUserStats.totalQuizzes,
        unlockedDate: mockUserStats.totalQuizzes >= 10 ? '2024-01-25' : undefined
      },
      {
        id: 'quiz-25',
        title: 'Quiz Enthusiast',
        description: 'Complete 25 quizzes',
        animationType: 'medal',
        category: 'quiz',
        requirement: 25,
        isUnlocked: mockUserStats.totalQuizzes >= 25,
        progress: mockUserStats.totalQuizzes
      },
      {
        id: 'quiz-50',
        title: 'Quiz Expert',
        description: 'Complete 50 quizzes',
        animationType: 'medal',
        category: 'quiz',
        requirement: 50,
        isUnlocked: mockUserStats.totalQuizzes >= 50,
        progress: mockUserStats.totalQuizzes
      },
      {
        id: 'quiz-100',
        title: 'Quiz Legend',
        description: 'Complete 100 quizzes',
        animationType: 'medal',
        category: 'quiz',
        requirement: 100,
        isUnlocked: mockUserStats.totalQuizzes >= 100,
        progress: mockUserStats.totalQuizzes
      }
    ]
  },
  {
    id: 'perfect-scores',
    title: 'Perfectionist',
    description: 'Achieve perfect scores on quizzes',
    achievements: [
      {
        id: 'perfect-1',
        title: 'Flawless Victory',
        description: 'Get a perfect score on 1 quiz',
        animationType: 'star_medal',
        category: 'perfect',
        requirement: 1,
        isUnlocked: mockUserStats.perfectScores >= 1,
        progress: mockUserStats.perfectScores,
        unlockedDate: mockUserStats.perfectScores >= 1 ? '2024-01-18' : undefined
      },
      {
        id: 'perfect-5',
        title: 'Perfection Streak',
        description: 'Get perfect scores on 5 quizzes',
        animationType: 'star_medal',
        category: 'perfect',
        requirement: 5,
        isUnlocked: mockUserStats.perfectScores >= 5,
        progress: mockUserStats.perfectScores
      },
      {
        id: 'perfect-10',
        title: 'Master of Perfection',
        description: 'Get perfect scores on 10 quizzes',
        animationType: 'star_medal',
        category: 'perfect',
        requirement: 10,
        isUnlocked: mockUserStats.perfectScores >= 10,
        progress: mockUserStats.perfectScores
      }
    ]
  },
  {
    id: 'streaks',
    title: 'Consistency Champion',
    description: 'Maintain daily learning streaks',
    achievements: [
      {
        id: 'streak-1',
        title: 'Day One',
        description: 'Maintain a 1-day streak',
        animationType: 'badge',
        category: 'streak',
        requirement: 1,
        isUnlocked: mockUserStats.longestStreak >= 1,
        progress: mockUserStats.currentStreak,
        unlockedDate: mockUserStats.longestStreak >= 1 ? '2024-01-15' : undefined
      },
      {
        id: 'streak-3',
        title: 'Three Days Strong',
        description: 'Maintain a 3-day streak',
        animationType: 'badge',
        category: 'streak',
        requirement: 3,
        isUnlocked: mockUserStats.longestStreak >= 3,
        progress: mockUserStats.currentStreak,
        unlockedDate: mockUserStats.longestStreak >= 3 ? '2024-01-17' : undefined
      },
      {
        id: 'streak-5',
        title: 'Five Day Fire',
        description: 'Maintain a 5-day streak',
        animationType: 'badge',
        category: 'streak',
        requirement: 5,
        isUnlocked: mockUserStats.longestStreak >= 5,
        progress: mockUserStats.currentStreak,
        unlockedDate: mockUserStats.longestStreak >= 5 ? '2024-01-19' : undefined
      },
      {
        id: 'streak-7',
        title: 'Week Warrior',
        description: 'Maintain a 7-day streak',
        animationType: 'badge',
        category: 'streak',
        requirement: 7,
        isUnlocked: mockUserStats.longestStreak >= 7,
        progress: mockUserStats.currentStreak,
        unlockedDate: mockUserStats.longestStreak >= 7 ? '2024-01-21' : undefined
      },
      {
        id: 'streak-10',
        title: 'Ten Days Blazing',
        description: 'Maintain a 10-day streak',
        animationType: 'badge',
        category: 'streak',
        requirement: 10,
        isUnlocked: mockUserStats.longestStreak >= 10,
        progress: mockUserStats.currentStreak
      },
      {
        id: 'streak-14',
        title: 'Two Week Champion',
        description: 'Maintain a 14-day streak',
        animationType: 'badge',
        category: 'streak',
        requirement: 14,
        isUnlocked: mockUserStats.longestStreak >= 14,
        progress: mockUserStats.currentStreak
      },
      {
        id: 'streak-30',
        title: 'Monthly Master',
        description: 'Maintain a 30-day streak',
        animationType: 'badge',
        category: 'streak',
        requirement: 30,
        isUnlocked: mockUserStats.longestStreak >= 30,
        progress: mockUserStats.currentStreak
      },
      {
        id: 'streak-45',
        title: 'Unstoppable Force',
        description: 'Maintain a 45-day streak',
        animationType: 'badge',
        category: 'streak',
        requirement: 45,
        isUnlocked: mockUserStats.longestStreak >= 45,
        progress: mockUserStats.currentStreak
      },
      {
        id: 'streak-60',
        title: 'Two Month Legend',
        description: 'Maintain a 60-day streak',
        animationType: 'badge',
        category: 'streak',
        requirement: 60,
        isUnlocked: mockUserStats.longestStreak >= 60,
        progress: mockUserStats.currentStreak
      },
      {
        id: 'streak-90',
        title: 'Three Month Titan',
        description: 'Maintain a 90-day streak',
        animationType: 'badge',
        category: 'streak',
        requirement: 90,
        isUnlocked: mockUserStats.longestStreak >= 90,
        progress: mockUserStats.currentStreak
      },
      {
        id: 'streak-100',
        title: 'Century of Learning',
        description: 'Maintain a 100-day streak',
        animationType: 'badge',
        category: 'streak',
        requirement: 100,
        isUnlocked: mockUserStats.longestStreak >= 100,
        progress: mockUserStats.currentStreak
      }
    ]
  },
  {
    id: 'speed',
    title: 'Speed Demon',
    description: 'Answer questions quickly and accurately',
    achievements: [
      {
        id: 'speed-1',
        title: 'Lightning Fast',
        description: 'Answer 10 questions correctly in 30 seconds or less',
        animationType: 'star_badge',
        category: 'speed',
        requirement: 1,
        isUnlocked: mockUserStats.speedRecords >= 1,
        progress: mockUserStats.speedRecords,
        unlockedDate: mockUserStats.speedRecords >= 1 ? '2024-01-22' : undefined
      }
    ]
  },
  {
    id: 'accuracy',
    title: 'Precision Expert',
    description: 'Maintain high accuracy over your last 10 quizzes',
    achievements: [
      {
        id: 'accuracy-50',
        title: 'Half Way There',
        description: 'Achieve 50% or higher accuracy over last 10 quizzes',
        animationType: 'badge',
        category: 'accuracy',
        requirement: 50,
        isUnlocked: mockUserStats.recentAccuracy >= 50,
        progress: mockUserStats.recentAccuracy,
        unlockedDate: mockUserStats.recentAccuracy >= 50 ? '2024-01-16' : undefined
      },
      {
        id: 'accuracy-70',
        title: 'Sharpshooter',
        description: 'Achieve 70% or higher accuracy over last 10 quizzes',
        animationType: 'badge',
        category: 'accuracy',
        requirement: 70,
        isUnlocked: mockUserStats.recentAccuracy >= 70,
        progress: mockUserStats.recentAccuracy,
        unlockedDate: mockUserStats.recentAccuracy >= 70 ? '2024-01-20' : undefined
      },
      {
        id: 'accuracy-80',
        title: 'Expert Marksman',
        description: 'Achieve 80% or higher accuracy over last 10 quizzes',
        animationType: 'badge',
        category: 'accuracy',
        requirement: 80,
        isUnlocked: mockUserStats.recentAccuracy >= 80,
        progress: mockUserStats.recentAccuracy
      },
      {
        id: 'accuracy-90',
        title: 'Perfect Precision',
        description: 'Achieve 90% or higher accuracy over last 10 quizzes',
        animationType: 'badge',
        category: 'accuracy',
        requirement: 90,
        isUnlocked: mockUserStats.recentAccuracy >= 90,
        progress: mockUserStats.recentAccuracy
      }
    ]
  }
]

