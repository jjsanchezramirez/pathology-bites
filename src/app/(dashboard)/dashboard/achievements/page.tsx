// src/app/(dashboard)/dashboard/achievements/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { AchievementsSection } from '@/features/achievements/components'
import { Achievement, AchievementCategory } from '@/features/achievements/types/achievement'
import { toast } from '@/shared/utils/toast'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { useUnifiedData } from '@/shared/hooks/use-unified-data'

export default function AchievementsPage() {
  const { data: unifiedData, isLoading, mutate } = useUnifiedData()
  const [checking, setChecking] = useState(false)
  const [achievementCategories, setAchievementCategories] = useState<AchievementCategory[]>([])

  useEffect(() => {
    if (unifiedData?.achievements) {
      processAchievementsData()
    }
  }, [unifiedData])

  const checkAchievements = async () => {
    try {
      setChecking(true)
      // Use GET to avoid CSRF issues with the temporary test button
      const response = await fetch('/api/user/achievements/check', {
        method: 'GET',
        credentials: 'include'
      })
      const result = await response.json()

      console.log('Achievement check response:', result)

      if (!result.success) {
        const errorMsg = result.details || result.error || 'Failed to check achievements'
        throw new Error(errorMsg)
      }

      if (result.newAchievements && result.newAchievements.length > 0) {
        toast.success(`Unlocked ${result.newAchievements.length} new achievement(s)!`)
        console.log('New achievements:', result.newAchievements)
        // Refresh the unified data cache
        await mutate()
      } else {
        toast.info('No new achievements unlocked')
      }
    } catch (error) {
      console.error('Error checking achievements:', error)
      const errorMsg = error instanceof Error ? error.message : 'Failed to check achievements'
      toast.error(`Error: ${errorMsg}`)
    } finally {
      setChecking(false)
    }
  }

  const processAchievementsData = () => {
    if (!unifiedData?.achievements) return

    const { achievements: achievementsData } = unifiedData
    const achievementProgress = achievementsData.progress as Achievement[]

      // Group achievements by category (progress is already calculated by API)
      const categories: Record<string, Achievement[]> = {
        'diagnostic-experience': [],
        'perfectionist': [],
        'daily-signout': [],
        'pattern-recognition': [],
        'diagnostic-accuracy': [],
        'differential-diagnosis': []
      }

      const categoryTitles = {
        'diagnostic-experience': 'Diagnostic Experience',
        'perfectionist': 'Perfectionist',
        'daily-signout': 'Daily Sign-Out',
        'pattern-recognition': 'Pattern Recognition',
        'diagnostic-accuracy': 'Diagnostic Accuracy',
        'differential-diagnosis': 'Differential Diagnosis'
      }

      const categoryDescriptions = {
        'diagnostic-experience': 'Complete quizzes to unlock these achievements',
        'perfectionist': 'Achieve perfect scores on quizzes',
        'daily-signout': 'Maintain daily learning streaks',
        'pattern-recognition': 'Answer questions quickly and accurately',
        'diagnostic-accuracy': 'Maintain high accuracy over your last 10 quizzes',
        'differential-diagnosis': 'Answer questions from multiple subjects'
      }

      // Group achievements by category using pre-calculated progress
      achievementProgress.forEach((achievement) => {
        const categoryId = achievement.category === 'quiz' ? 'diagnostic-experience' :
                         achievement.category === 'perfect' ? 'perfectionist' :
                         achievement.category === 'streak' ? 'daily-signout' :
                         achievement.category === 'speed' ? 'pattern-recognition' :
                         achievement.category === 'differential' ? 'differential-diagnosis' :
                         'diagnostic-accuracy'

        categories[categoryId].push(achievement)
      })

      // Convert to AchievementCategory array
      const categoryArray: AchievementCategory[] = Object.entries(categories).map(([id, achievements]) => ({
        id,
        title: categoryTitles[id as keyof typeof categoryTitles],
        description: categoryDescriptions[id as keyof typeof categoryDescriptions],
        achievements
      }))

      setAchievementCategories(categoryArray)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Calculate overall stats
  const totalAchievements = achievementCategories.reduce(
    (sum, category) => sum + category.achievements.length,
    0
  )
  const unlockedAchievements = achievementCategories.reduce(
    (sum, category) => sum + category.achievements.filter(a => a.isUnlocked).length,
    0
  )
  const completionPercentage = totalAchievements > 0
    ? Math.round((unlockedAchievements / totalAchievements) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Achievements</h1>
          <p className="text-muted-foreground">
            {unlockedAchievements} of {totalAchievements} unlocked ({completionPercentage}%)
          </p>
        </div>

        {/* Temporary: Check Achievements Button */}
        <Button
          onClick={checkAchievements}
          disabled={checking}
          variant="outline"
          className="gap-2"
        >
          {checking ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Check for New Achievements
            </>
          )}
        </Button>
      </div>

      {/* Achievement Categories */}
      <div className="space-y-8">
        {achievementCategories.map((category) => (
          <AchievementsSection key={category.id} category={category} />
        ))}
      </div>
    </div>
  )
}

