// src/features/achievements/services/achievement-service.server.ts
// SERVER-SIDE ONLY - Do not import in client components
import { createClient } from '@/shared/services/server'
import { UserStats, AchievementDefinition, checkAchievements, ACHIEVEMENT_DEFINITIONS } from './achievement-checker'

/**
 * Get user stats from the database
 * SERVER-SIDE ONLY
 */
export async function getUserStats(userId: string): Promise<UserStats> {
  const supabase = await createClient()

  // Get total completed quizzes
  const { count: totalQuizzes } = await supabase
    .from('quiz_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed')

  // Get perfect scores (100% accuracy)
  const { count: perfectScores } = await supabase
    .from('quiz_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('score', 100)

  // Get recent accuracy (last 10 quizzes)
  const { data: recentQuizzes } = await supabase
    .from('quiz_sessions')
    .select('score')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(10)

  const recentAccuracy = recentQuizzes && recentQuizzes.length > 0
    ? recentQuizzes.reduce((sum, q) => sum + (q.score || 0), 0) / recentQuizzes.length
    : 0

  console.log('Recent quizzes:', recentQuizzes)
  console.log('Recent accuracy calculated:', recentAccuracy)

  // Get unique subjects answered (for differential diagnosis achievements)
  const { data: uniqueSubjectsData } = await supabase
    .from('quiz_attempts')
    .select('question_id')
    .eq('user_id', userId)
    .eq('is_correct', true)

  // Get unique category_ids from the questions
  const questionIds = uniqueSubjectsData?.map(a => a.question_id) || []
  const { data: questionsData } = await supabase
    .from('questions')
    .select('category_id')
    .in('id', questionIds.length > 0 ? questionIds : ['00000000-0000-0000-0000-000000000000']) // Dummy ID if no questions

  const uniqueSubjects = new Set(questionsData?.map(q => q.category_id).filter(Boolean) || []).size

  // Get total number of categories that have questions
  const { data: categoriesWithQuestions } = await supabase
    .from('questions')
    .select('category_id')
    .not('category_id', 'is', null)

  const totalCategories = new Set(categoriesWithQuestions?.map(q => q.category_id) || []).size

  // Calculate streaks from quiz_sessions dates
  const { data: allCompletedQuizzes } = await supabase
    .from('quiz_sessions')
    .select('created_at, completed_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('created_at', { ascending: true })

  let currentStreak = 0
  let longestStreak = 0

  if (allCompletedQuizzes && allCompletedQuizzes.length > 0) {
    // Get unique dates (days) when quizzes were completed
    const uniqueDates = new Set(
      allCompletedQuizzes.map(q => {
        const date = new Date(q.completed_at || q.created_at)
        // Normalize to start of day in UTC
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString().split('T')[0]
      })
    )

    const sortedDates = Array.from(uniqueDates).sort()

    // Calculate current streak (working backwards from today)
    const today = new Date()
    const todayStr = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).toISOString().split('T')[0]

    let checkDate = new Date(todayStr)
    currentStreak = 0

    while (true) {
      const checkDateStr = checkDate.toISOString().split('T')[0]
      if (sortedDates.includes(checkDateStr)) {
        currentStreak++
        // Move to previous day
        checkDate.setUTCDate(checkDate.getUTCDate() - 1)
      } else {
        break
      }
    }

    // Calculate longest streak
    let tempStreak = 1
    longestStreak = 1

    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1])
      const currDate = new Date(sortedDates[i])

      // Calculate difference in days
      const diffTime = currDate.getTime() - prevDate.getTime()
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays === 1) {
        // Consecutive day
        tempStreak++
        longestStreak = Math.max(longestStreak, tempStreak)
      } else {
        // Streak broken
        tempStreak = 1
      }
    }
  }

  console.log('Streak calculation - current:', currentStreak, 'longest:', longestStreak)

  // Calculate speed records - check perfect score quizzes with sufficient questions
  const { data: perfectQuizzes } = await supabase
    .from('quiz_sessions')
    .select('id, total_questions, total_time_spent, score')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .eq('score', 100) // Perfect score only

  let speedRecords5min = 0 // 10 questions in 5 min
  let speedRecords2min = 0 // 10 questions in 2 min
  let speedRecords25in5min = 0 // 25 questions in 5 min
  let speedRecords25in2min = 0 // 25 questions in 2 min

  if (perfectQuizzes && perfectQuizzes.length > 0) {
    perfectQuizzes.forEach(quiz => {
      const totalQuestions = quiz.total_questions
      const totalTime = quiz.total_time_spent || 0

      // Count each qualifying quiz (not just set to 1)
      if (totalQuestions >= 10) {
        if (totalTime <= 300) { // 5 minutes = 300 seconds
          speedRecords5min++
        }
        if (totalTime <= 120) { // 2 minutes = 120 seconds
          speedRecords2min++
        }
      }

      // Check for 25 questions in 5 min or 2 min
      if (totalQuestions >= 25) {
        if (totalTime <= 300) { // 5 minutes = 300 seconds
          speedRecords25in5min++
        }
        if (totalTime <= 120) { // 2 minutes = 120 seconds
          speedRecords25in2min++
        }
      }
    })
  }

  console.log('Speed records - 10in5:', speedRecords5min, '10in2:', speedRecords2min, '25in5:', speedRecords25in5min, '25in2:', speedRecords25in2min)

  const stats = {
    totalQuizzes: totalQuizzes || 0,
    perfectScores: perfectScores || 0,
    currentStreak,
    longestStreak,
    speedRecords5min,
    speedRecords2min,
    speedRecords25in5min,
    speedRecords25in2min,
    recentAccuracy,
    uniqueSubjects,
    totalCategories
  }

  console.log('User stats calculated:', JSON.stringify(stats, null, 2))

  return stats
}

/**
 * Award achievements to a user (called after quiz completion)
 * SERVER-SIDE ONLY
 */
export async function awardAchievements(userId: string): Promise<AchievementDefinition[]> {
  const supabase = await createClient()

  // Get user stats
  const stats = await getUserStats(userId)

  // Check which achievements should be unlocked
  const achievementsToUnlock = checkAchievements(stats)
  console.log('Achievements to unlock:', achievementsToUnlock.length, achievementsToUnlock.map(a => a.id))

  // Get already unlocked achievements
  const { data: existingAchievements } = await supabase
    .from('user_achievements')
    .select('group_key')
    .eq('user_id', userId)
    .eq('type', 'achievement')

  const existingIds = new Set(existingAchievements?.map(a => a.group_key) || [])

  // Filter out already unlocked achievements
  const newAchievements = achievementsToUnlock.filter(a => !existingIds.has(a.id))

  // Insert new achievements
  if (newAchievements.length > 0) {
    const achievementsToInsert = newAchievements.map(achievement => ({
      user_id: userId,
      type: 'achievement',
      title: achievement.title,
      description: achievement.description,
      group_key: achievement.id,
      data: {
        category: achievement.category,
        requirement: achievement.requirement,
        animationType: achievement.animationType
      },
      is_read: false,
      priority: 'medium'
    }))

    console.log('Attempting to insert achievements:', achievementsToInsert.length)

    const { data, error } = await supabase.from('user_achievements').insert(achievementsToInsert)

    if (error) {
      console.error('Error inserting achievements:', error)
      throw new Error(`Failed to insert achievements: ${error.message}`)
    }

    console.log('Successfully inserted achievements:', data)
  } else {
    console.log('No new achievements to insert')
  }

  return newAchievements
}
