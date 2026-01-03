// src/features/achievements/components/achievement-lottie.tsx
"use client";

import dynamic from "next/dynamic";
import { cn } from "@/shared/utils";
import { useLottieAnimation } from "@/shared/hooks/use-lottie-animation";

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

type AnimationType = "badge" | "medal" | "star_badge" | "star_medal" | "crown" | "trophy_large";

interface AchievementLottieProps {
  animationType: AnimationType;
  isUnlocked: boolean;
  className?: string;
}

export function AchievementLottie({
  animationType,
  isUnlocked,
  className,
}: AchievementLottieProps) {
  const { animationData, isLoading } = useLottieAnimation(animationType);

  if (isLoading || !animationData) {
    // Loading placeholder
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <div className="w-full h-full bg-muted/20 rounded-full animate-pulse" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center transition-all",
        !isUnlocked && "grayscale opacity-60",
        className
      )}
    >
      <Lottie
        animationData={animationData}
        loop={isUnlocked}
        autoplay={isUnlocked}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
