// src/app/(dashboard)/dashboard/achievements/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { AchievementsSection } from "@/features/user/achievements/components";
import {
  Achievement,
  AchievementCategory,
  AchievementProgress,
} from "@/features/user/achievements/types/achievement";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useUnifiedData } from "@/shared/hooks/use-unified-data";
import { ScrollReveal } from "@/shared/components/common";

// Mirrors the real layout — page header, then six category sections each with
// a header + 2/3-col grid of cards. Keeping the structure identical avoids the
// jarring spinner→full-page swap; the layout doesn't reflow when data lands.
const SKELETON_CATEGORY_SIZES = [4, 3, 6, 4, 6, 4];

function AchievementsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-48 mb-3" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="space-y-8">
        {SKELETON_CATEGORY_SIZES.map((count, sectionIdx) => (
          <div key={sectionIdx} className="space-y-4">
            <div>
              <Skeleton className="h-6 w-56 mb-2" />
              <Skeleton className="h-4 w-72" />
            </div>
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: count }).map((_, cardIdx) => (
                <Card key={cardIdx} className="text-center">
                  <CardContent className="pt-6 pb-4 px-4">
                    <div className="mb-4 flex justify-center">
                      <Skeleton className="w-24 h-24 rounded-full" />
                    </div>
                    <Skeleton className="h-5 w-3/4 mx-auto mb-2" />
                    <div className="mb-4 min-h-[40px] space-y-1.5">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-5/6 mx-auto" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-2 w-full" />
                      <Skeleton className="h-3 w-12 mx-auto" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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
    return <AchievementsLoadingSkeleton />;
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
