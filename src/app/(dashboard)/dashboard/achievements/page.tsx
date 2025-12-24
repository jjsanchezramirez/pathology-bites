// src/app/(dashboard)/dashboard/achievements/page.tsx
'use client'

import { AchievementsSection } from '@/features/achievements/components'
import { achievementCategories } from '@/features/achievements/data/achievements-data'

export default function AchievementsPage() {
  // Calculate overall stats
  const totalAchievements = achievementCategories.reduce(
    (sum, category) => sum + category.achievements.length,
    0
  )
  const unlockedAchievements = achievementCategories.reduce(
    (sum, category) => sum + category.achievements.filter(a => a.isUnlocked).length,
    0
  )
  const completionPercentage = Math.round((unlockedAchievements / totalAchievements) * 100)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Achievements</h1>
        <p className="text-muted-foreground">
          {unlockedAchievements} of {totalAchievements} unlocked ({completionPercentage}%)
        </p>
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

