// src/features/performance/components/achievement-badge.tsx
"use client";

import { cn } from "@/shared/utils/utils";
import { Achievement, getTierColor, getTierBgColor } from "@/shared/types/achievements";
import {
  Play,
  BookOpen,
  GraduationCap,
  Trophy,
  Crown,
  Award,
  Target,
  Crosshair,
  Sparkles,
  Star,
  Flame,
  Zap,
  Rocket,
  Lock,
} from "lucide-react";
import { Progress } from "@/shared/components/ui/progress";

const iconMap: Record<string, unknown> = {
  Play,
  BookOpen,
  GraduationCap,
  Trophy,
  Crown,
  Award,
  Target,
  Crosshair,
  Sparkles,
  Star,
  Flame,
  Zap,
  Rocket,
  Lock,
};

interface AchievementBadgeProps {
  achievement: Achievement;
  size?: "sm" | "md" | "lg";
  showProgress?: boolean;
}

export function AchievementBadge({
  achievement,
  size = "md",
  showProgress = false,
}: AchievementBadgeProps) {
  const Icon = iconMap[achievement.icon] || Award;
  const isLocked = !achievement.unlocked;

  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-20 h-20",
    lg: "w-28 h-28",
  };

  const iconSizeClasses = {
    sm: "w-7 h-7",
    md: "w-9 h-9",
    lg: "w-12 h-12",
  };

  const progressPercent =
    achievement.progress && achievement.total
      ? Math.min((achievement.progress / achievement.total) * 100, 100)
      : 0;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative group">
        {/* Badge Circle */}
        <div
          className={cn(
            sizeClasses[size],
            "rounded-full flex items-center justify-center transition-all duration-300",
            isLocked ? "bg-gray-200 dark:bg-gray-800 opacity-50" : getTierBgColor(achievement.tier),
            !isLocked && "shadow-lg group-hover:scale-110 group-hover:shadow-xl"
          )}
        >
          <Icon
            className={cn(
              iconSizeClasses[size],
              isLocked ? "text-gray-400 dark:text-gray-600" : getTierColor(achievement.tier)
            )}
          />

          {/* Lock overlay */}
          {isLocked && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Lock className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
          )}
        </div>

        {/* Glow effect for unlocked badges */}
        {!isLocked && (
          <div
            className={cn(
              "absolute inset-0 rounded-full blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-300",
              achievement.tier === "bronze" && "bg-orange-400",
              achievement.tier === "silver" && "bg-gray-400",
              achievement.tier === "gold" && "bg-yellow-400",
              achievement.tier === "platinum" && "bg-cyan-400",
              achievement.tier === "diamond" && "bg-purple-400"
            )}
          />
        )}
      </div>

      {/* Badge Name */}
      <div className="text-center">
        <p
          className={cn(
            "text-sm font-semibold",
            isLocked ? "text-gray-500 dark:text-gray-400" : "text-foreground"
          )}
        >
          {achievement.name}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2">{achievement.description}</p>

        {/* Points */}
        {!isLocked && (
          <p className="text-xs font-medium text-primary mt-1">+{achievement.points} pts</p>
        )}

        {/* Progress for locked badges */}
        {isLocked &&
          showProgress &&
          achievement.progress !== undefined &&
          achievement.total !== undefined && (
            <div className="mt-2 w-full">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>
                  {achievement.progress}/{achievement.total}
                </span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} className="h-1.5" />
            </div>
          )}

        {/* Unlock date for earned badges */}
        {achievement.unlockedAt && (
          <p className="text-xs text-muted-foreground mt-1">
            Earned {new Date(achievement.unlockedAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}
