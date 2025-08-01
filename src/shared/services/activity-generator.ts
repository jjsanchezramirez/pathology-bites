// src/shared/services/activity-generator.ts
// Simple activity generator - keeping it focused and clean

interface ActivityData {
  type: string
  title: string
  description: string
  quiz_id?: string
  goal_id?: string
  subject_id?: string
  data?: Record<string, any>
  priority?: 'low' | 'medium' | 'high'
}

export class ActivityGenerator {
  
  // Quiz completed activity
  static createQuizCompletedActivity(quizData: {
    id: string
    title: string
    score: number
    totalQuestions: number
    timeSpent?: number
    previousScore?: number
  }): ActivityData {
    const improvement = quizData.previousScore ? quizData.score - quizData.previousScore : null
    
    return {
      type: 'quiz_completed',
      title: `Completed "${quizData.title}"`,
      description: `Scored ${quizData.score}% on ${quizData.totalQuestions} questions${
        improvement ? ` (${improvement > 0 ? '+' : ''}${improvement}% improvement)` : ''
      }`,
      quiz_id: quizData.id,
      data: {
        score: quizData.score,
        totalQuestions: quizData.totalQuestions,
        timeSpent: quizData.timeSpent,
        improvement
      },
      priority: quizData.score >= 90 ? 'high' : quizData.score >= 70 ? 'medium' : 'low'
    }
  }

  // Quiz started activity
  static createQuizStartedActivity(quizData: {
    id: string
    title: string
    totalQuestions: number
  }): ActivityData {
    return {
      type: 'quiz_started',
      title: `Started "${quizData.title}"`,
      description: `${quizData.totalQuestions} questions to complete`,
      quiz_id: quizData.id,
      data: {
        totalQuestions: quizData.totalQuestions
      },
      priority: 'medium'
    }
  }

  // Goal achieved activity
  static createGoalAchievedActivity(goalData: {
    id: string
    title: string
    type: string
    category: string
    targetValue: number
  }): ActivityData {
    return {
      type: 'goal_achieved',
      title: '🎯 Goal Achieved!',
      description: `Completed "${goalData.title}" ${goalData.type === 'daily' ? 'today' : 'this week'}`,
      goal_id: goalData.id,
      data: {
        goalType: goalData.type,
        category: goalData.category,
        targetValue: goalData.targetValue
      },
      priority: 'high'
    }
  }

  // Study streak activity
  static createStudyStreakActivity(streakData: {
    days: number
    isNewRecord?: boolean
  }): ActivityData {
    return {
      type: 'study_streak',
      title: `🔥 ${streakData.days} Day Streak!`,
      description: `Keep up the great work!${streakData.isNewRecord ? ' New personal record!' : ''}`,
      data: {
        days: streakData.days,
        isNewRecord: streakData.isNewRecord
      },
      priority: streakData.days >= 7 ? 'high' : 'medium'
    }
  }

  // Subject mastered activity
  static createSubjectMasteredActivity(subjectData: {
    id: string
    name: string
    accuracy: number
  }): ActivityData {
    return {
      type: 'subject_mastered',
      title: '🏆 Subject Mastered!',
      description: `Achieved mastery in ${subjectData.name} with ${subjectData.accuracy}% accuracy`,
      subject_id: subjectData.id,
      data: {
        subjectName: subjectData.name,
        accuracy: subjectData.accuracy
      },
      priority: 'high'
    }
  }

  // Performance milestone activity
  static createPerformanceMilestoneActivity(milestoneData: {
    milestone: string
    description: string
    previousValue?: number
    newValue: number
  }): ActivityData {
    return {
      type: 'performance_milestone',
      title: `📈 ${milestoneData.milestone}`,
      description: milestoneData.description,
      data: {
        milestone: milestoneData.milestone,
        previousValue: milestoneData.previousValue,
        newValue: milestoneData.newValue
      },
      priority: 'medium'
    }
  }

  // Badge earned activity
  static createBadgeEarnedActivity(badgeData: {
    id: string
    name: string
    description: string
  }): ActivityData {
    return {
      type: 'badge_earned',
      title: '🏅 Badge Earned!',
      description: `Earned "${badgeData.name}" - ${badgeData.description}`,
      data: {
        badgeId: badgeData.id,
        badgeName: badgeData.name
      },
      priority: 'high'
    }
  }

  // Weak area improved activity
  static createWeakAreaImprovedActivity(improvementData: {
    subjectId: string
    subjectName: string
    oldAccuracy: number
    newAccuracy: number
  }): ActivityData {
    const improvement = improvementData.newAccuracy - improvementData.oldAccuracy
    
    return {
      type: 'weak_area_improved',
      title: `💪 Improvement in ${improvementData.subjectName}`,
      description: `Accuracy improved from ${improvementData.oldAccuracy}% to ${improvementData.newAccuracy}% (+${improvement}%)`,
      subject_id: improvementData.subjectId,
      data: {
        subjectName: improvementData.subjectName,
        oldAccuracy: improvementData.oldAccuracy,
        newAccuracy: improvementData.newAccuracy,
        improvement
      },
      priority: improvement >= 10 ? 'high' : 'medium'
    }
  }

  // Helper method to create activity via API
  static async createActivity(userId: string, activityData: ActivityData): Promise<boolean> {
    try {
      const response = await fetch('/api/dashboard/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(activityData)
      })

      if (!response.ok) {
        console.error('Failed to create activity:', await response.text())
        return false
      }

      return true
    } catch (error) {
      console.error('Error creating activity:', error)
      return false
    }
  }
}
