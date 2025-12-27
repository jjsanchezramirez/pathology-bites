// src/features/achievements/components/achievements-section.tsx

import { AchievementCard } from './achievement-card'
import { AchievementCategory } from '../types/achievement'

interface AchievementsSectionProps {
  category: AchievementCategory
}

export function AchievementsSection({ category }: AchievementsSectionProps) {
  const unlockedCount = category.achievements.filter(a => a.isUnlocked).length
  const totalCount = category.achievements.length

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div>
        <h2 className="text-xl font-semibold">{category.title}</h2>
        <p className="text-sm text-muted-foreground">
          {category.description} • {unlockedCount} of {totalCount} unlocked
        </p>
      </div>

      {/* Achievement Cards Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {category.achievements.map((achievement) => (
          <AchievementCard
            key={achievement.id}
            animationType={achievement.animationType}
            title={achievement.title}
            description={achievement.description}
            isUnlocked={achievement.isUnlocked}
            progress={achievement.progress}
            maxProgress={achievement.requirement}
            category={achievement.category}
          />
        ))}
      </div>
    </div>
  )
}

