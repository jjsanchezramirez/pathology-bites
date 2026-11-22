// src/features/achievements/components/achievements-section.tsx

import { PageSection } from "@/shared/components/ui/page-layout";
import { AchievementCard } from "./achievement-card";
import { AchievementCategory } from "../types/achievement";

interface AchievementsSectionProps {
  category: AchievementCategory;
}

export function AchievementsSection({ category }: AchievementsSectionProps) {
  const unlockedCount = category.achievements.filter((a) => a.isUnlocked).length;
  const totalCount = category.achievements.length;

  return (
    <PageSection
      title={category.title}
      description={
        <>
          {category.description} • {unlockedCount} of {totalCount} unlocked
        </>
      }
    >
      {/* Achievement Cards Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
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
    </PageSection>
  );
}
