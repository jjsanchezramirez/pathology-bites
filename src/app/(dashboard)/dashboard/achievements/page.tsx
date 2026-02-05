// src/app/(dashboard)/dashboard/achievements/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { AchievementsSection } from "@/features/user/achievements/components";
import {
  Achievement,
  AchievementCategory,
  AchievementProgress,
} from "@/features/user/achievements/types/achievement";
import { Loader2 } from "lucide-react";
import { useUnifiedData } from "@/shared/hooks/use-unified-data";
import { ScrollReveal } from "@/shared/components/common";

export default function AchievementsPage() {
  const { data: unifiedData, isLoading } = useUnifiedData();
  const [achievementCategories, setAchievementCategories] = useState<AchievementCategory[]>([]);

  const processAchievementsData = useCallback(() => {
    if (!unifiedData?.achievements) return;

    const { achievements: achievementsData } = unifiedData;
    const achievementProgress = achievementsData.progress as AchievementProgress[];
    const definitions = achievementsData.definitions;

    // Hydrate progress data with achievement definitions from database
    const fullAchievements: Achievement[] = achievementProgress
      .map((progress) => {
        const definition = definitions.find((def) => def.id === progress.id);
        if (!definition) {
          console.error(`Achievement definition not found for ID: ${progress.id}`);
          return null;
        }
        return {
          id: definition.id,
          title: definition.title,
          description: definition.description,
          animationType: definition.animation_type as Achievement["animationType"],
          category: definition.category as Achievement["category"],
          requirement: progress.requirement, // Use dynamic requirement from progress
          isUnlocked: progress.isUnlocked,
          progress: progress.progress,
          unlockedDate: progress.unlockedDate || undefined,
        } as Achievement;
      })
      .filter((a): a is Achievement => a !== null);

    // Group achievements by category (progress is already calculated by API)
    const categories: Record<string, Achievement[]> = {
      "diagnostic-experience": [],
      perfectionist: [],
      "daily-signout": [],
      "pattern-recognition": [],
      "diagnostic-accuracy": [],
      "differential-diagnosis": [],
    };

    const categoryTitles = {
      "diagnostic-experience": "Diagnostic Experience",
      perfectionist: "Perfectionist",
      "daily-signout": "Daily Sign-Out",
      "pattern-recognition": "Pattern Recognition",
      "diagnostic-accuracy": "Diagnostic Accuracy",
      "differential-diagnosis": "Differential Diagnosis",
    };

    const categoryDescriptions = {
      "diagnostic-experience": "Complete quizzes to unlock these achievements",
      perfectionist: "Achieve perfect scores on quizzes",
      "daily-signout": "Maintain daily learning streaks",
      "pattern-recognition": "Answer questions quickly and accurately",
      "diagnostic-accuracy": "Maintain high accuracy over your last 10 quizzes",
      "differential-diagnosis": "Answer questions from multiple subjects",
    };

    // Group achievements by category using hydrated achievement data
    fullAchievements.forEach((achievement) => {
      const categoryId =
        achievement.category === "quiz"
          ? "diagnostic-experience"
          : achievement.category === "perfect"
            ? "perfectionist"
            : achievement.category === "streak"
              ? "daily-signout"
              : achievement.category === "speed"
                ? "pattern-recognition"
                : achievement.category === "differential"
                  ? "differential-diagnosis"
                  : "diagnostic-accuracy";

      categories[categoryId].push(achievement);
    });

    // Convert to AchievementCategory array
    const categoryArray: AchievementCategory[] = Object.entries(categories).map(
      ([id, achievements]) => ({
        id,
        title: categoryTitles[id as keyof typeof categoryTitles],
        description: categoryDescriptions[id as keyof typeof categoryDescriptions],
        achievements,
      })
    );

    setAchievementCategories(categoryArray);
  }, [unifiedData]);

  useEffect(() => {
    processAchievementsData();
  }, [processAchievementsData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Calculate overall stats
  const totalAchievements = achievementCategories.reduce(
    (sum, category) => sum + category.achievements.length,
    0
  );
  const unlockedAchievements = achievementCategories.reduce(
    (sum, category) => sum + category.achievements.filter((a) => a.isUnlocked).length,
    0
  );
  const completionPercentage =
    totalAchievements > 0 ? Math.round((unlockedAchievements / totalAchievements) * 100) : 0;

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
        {achievementCategories.map((category, index) => (
          <ScrollReveal key={category.id} animation="fade-up" delay={index * 100}>
            <AchievementsSection category={category} />
          </ScrollReveal>
        ))}
      </div>
    </div>
  );
}
