// src/features/performance/components/recent-achievements-card.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { AchievementBadge } from "./achievement-badge";
import { Achievement } from "@/shared/types/achievements";
import { getRecentlyUnlocked, getNextAchievements } from "../services/achievement-service";
import { Trophy, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/shared/components/ui/button";

interface RecentAchievementsCardProps {
  achievements: Achievement[];
}

export function RecentAchievementsCard({ achievements }: RecentAchievementsCardProps) {
  const recentlyUnlocked = getRecentlyUnlocked(achievements, 30); // Last 30 days
  const nextAchievements = getNextAchievements(achievements, 3);

  if (recentlyUnlocked.length === 0 && nextAchievements.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Achievements
          </CardTitle>
          <Link href="/dashboard/performance">
            <Button variant="ghost" size="sm">
              View All
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Recently Unlocked */}
        {recentlyUnlocked.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              Recently Earned
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {recentlyUnlocked.slice(0, 3).map((achievement) => (
                <AchievementBadge key={achievement.id} achievement={achievement} size="sm" />
              ))}
            </div>
          </div>
        )}

        {/* Next to Unlock */}
        {nextAchievements.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Almost There
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {nextAchievements.map((achievement) => (
                <AchievementBadge
                  key={achievement.id}
                  achievement={achievement}
                  size="sm"
                  showProgress
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
