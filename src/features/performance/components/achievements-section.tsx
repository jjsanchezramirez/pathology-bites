// src/features/performance/components/achievements-section.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Badge } from "@/shared/components/ui/badge";
import { AchievementBadge } from "./achievement-badge";
import { Achievement } from "@/shared/types/achievements";
import { groupAchievementsByCategory, calculateTotalPoints } from "../services/achievement-service";
import { Trophy, Star, TrendingUp } from "lucide-react";

interface AchievementsSectionProps {
  achievements: Achievement[];
}

export function AchievementsSection({ achievements }: AchievementsSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const grouped = groupAchievementsByCategory(achievements);
  const totalPoints = calculateTotalPoints(achievements);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;

  const displayAchievements =
    selectedCategory === "all" ? achievements : grouped[selectedCategory] || [];

  // Separate unlocked and locked achievements
  const unlocked = displayAchievements.filter((a) => a.unlocked);
  const locked = displayAchievements.filter((a) => !a.unlocked);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Achievements & Badges
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Total Points</div>
              <div className="text-2xl font-bold text-primary">{totalPoints}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Unlocked</div>
              <div className="text-2xl font-bold">
                {unlockedCount}/{totalCount}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
          <TabsList className="w-full flex-wrap h-auto">
            <TabsTrigger value="all" className="flex-1">
              All
              <Badge variant="secondary" className="ml-2">
                {achievements.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="quiz_completion" className="flex-1">
              Quizzes
              <Badge variant="secondary" className="ml-2">
                {grouped.quiz_completion.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="accuracy" className="flex-1">
              Accuracy
              <Badge variant="secondary" className="ml-2">
                {grouped.accuracy.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="streak" className="flex-1">
              Streaks
              <Badge variant="secondary" className="ml-2">
                {grouped.streak.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="speed" className="flex-1">
              Speed
              <Badge variant="secondary" className="ml-2">
                {grouped.speed.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={selectedCategory} className="mt-6">
            {unlocked.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <h3 className="text-lg font-semibold">Earned ({unlocked.length})</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {unlocked.map((achievement) => (
                    <AchievementBadge key={achievement.id} achievement={achievement} size="md" />
                  ))}
                </div>
              </div>
            )}

            {locked.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold text-muted-foreground">
                    Locked ({locked.length})
                  </h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {locked.map((achievement) => (
                    <AchievementBadge
                      key={achievement.id}
                      achievement={achievement}
                      size="md"
                      showProgress
                    />
                  ))}
                </div>
              </div>
            )}

            {displayAchievements.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No achievements in this category yet.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
