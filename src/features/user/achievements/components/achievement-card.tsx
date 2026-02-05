// src/features/achievements/components/achievement-card.tsx

import { Card, CardContent } from "@/shared/components/ui/card";
import { Progress } from "@/shared/components/ui/progress";
import { AchievementLottie } from "./achievement-lottie";

type AnimationType = "badge" | "medal" | "star_badge" | "star_medal" | "crown" | "trophy_large";

interface AchievementCardProps {
  animationType: AnimationType;
  title: string;
  description: string;
  isUnlocked: boolean;
  progress?: number;
  maxProgress?: number;
  category?: "quiz" | "perfect" | "streak" | "speed" | "accuracy" | "differential";
  showProgress?: boolean;
}

export function AchievementCard({
  animationType,
  title,
  description,
  isUnlocked,
  progress = 0,
  maxProgress = 100,
  category,
  showProgress,
}: AchievementCardProps) {
  const progressPercentage = maxProgress > 0 ? (progress / maxProgress) * 100 : 0;

  // Determine if we should show progress
  // Speed and Accuracy are binary (you either did it or didn't), so no progress shown
  // Differential, Quiz, Perfect, and Streak show progress
  const shouldShowProgressBar =
    showProgress !== undefined ? showProgress : category !== "speed" && category !== "accuracy";

  // Hide progress if unlocked OR progress is less than 25%
  // This prevents discouraging displays like "1/15" or "2/20"
  const hasMinimalProgress = !isUnlocked && progressPercentage < 25;

  return (
    <Card className="text-center">
      <CardContent className="pt-6 pb-4 px-4">
        {/* Lottie Animation */}
        <div className="mb-4 flex justify-center">
          <AchievementLottie
            animationType={animationType}
            isUnlocked={isUnlocked}
            className="w-24 h-24"
          />
        </div>

        {/* Title */}
        <h3 className="font-semibold mb-2">{title}</h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4 min-h-[40px]">{description}</p>

        {/* Progress - only show for certain categories and when meaningful */}
        {shouldShowProgressBar && !hasMinimalProgress && (
          <div className="space-y-2">
            <Progress value={progressPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {progress}/{maxProgress}
            </p>
          </div>
        )}

        {/* Show "Locked" for achievements with no meaningful progress yet */}
        {((!shouldShowProgressBar && !isUnlocked) || hasMinimalProgress) && (
          <p className="text-xs text-muted-foreground">Locked</p>
        )}
      </CardContent>
    </Card>
  );
}
