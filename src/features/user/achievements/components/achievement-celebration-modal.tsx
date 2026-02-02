"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { AchievementLottie } from "./achievement-lottie";
import { VisuallyHidden } from "@/shared/components/ui/visually-hidden";
import confetti from "canvas-confetti";

interface Achievement {
  id: string;
  title: string;
  description: string;
  category: string;
  animationType: "badge" | "medal" | "star_badge" | "star_medal" | "crown" | "trophy_large";
}

interface AchievementCelebrationModalProps {
  achievements: Achievement[];
  open: boolean;
  onClose: () => void;
}

export function AchievementCelebrationModal({
  achievements,
  open,
  onClose,
}: AchievementCelebrationModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // Sequential achievement display
  useEffect(() => {
    if (!open || achievements.length === 0) {
      setCurrentIndex(0);
      setIsVisible(false);
      return;
    }

    // Show first achievement
    const showTimer = setTimeout(() => {
      setIsVisible(true);
    }, 100);

    return () => clearTimeout(showTimer);
  }, [open, achievements.length]);

  // Trigger confetti for each achievement
  useEffect(() => {
    if (!open || !isVisible || currentIndex >= achievements.length) return;

    const confettiTimer = setTimeout(() => {
      const colors = ["#fbbf24", "#f59e0b", "#d97706", "#fef3c7", "#fcd34d"];

      // Single celebratory burst
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { x: 0.5, y: 0.5 },
        colors,
        startVelocity: 30,
        zIndex: 9999,
      });
    }, 300);

    return () => clearTimeout(confettiTimer);
  }, [open, isVisible, currentIndex, achievements.length]);

  // Auto-advance or close
  useEffect(() => {
    if (!open || !isVisible) return;

    const autoAdvanceTimer = setTimeout(() => {
      if (currentIndex < achievements.length - 1) {
        setIsVisible(false);
        setTimeout(() => {
          setCurrentIndex((prev) => prev + 1);
          setIsVisible(true);
        }, 300);
      }
    }, 3000); // Show each achievement for 3 seconds

    return () => clearTimeout(autoAdvanceTimer);
  }, [open, isVisible, currentIndex, achievements.length]);

  if (achievements.length === 0) return null;

  const currentAchievement = achievements[currentIndex];

  const handleNext = () => {
    if (currentIndex < achievements.length - 1) {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => prev + 1);
        setIsVisible(true);
      }, 300);
    } else {
      onClose();
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-lg border-none bg-transparent shadow-none p-8 overflow-visible"
        showCloseButton={false}
      >
        <VisuallyHidden>
          <DialogTitle>Achievement Unlocked: {currentAchievement.title}</DialogTitle>
        </VisuallyHidden>

        <div
          className={`
            flex flex-col items-center gap-8
            transition-all duration-500 ease-out
            ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
          `}
        >
          {/* Title */}
          <h2 className="text-2xl font-bold text-foreground text-center">
            New Achievement Unlocked!
          </h2>

          {/* Achievement animation */}
          <div className="w-48 h-48">
            <AchievementLottie
              animationType={currentAchievement.animationType}
              isUnlocked={true}
              className="w-full h-full"
            />
          </div>

          {/* Achievement details */}
          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold text-foreground">{currentAchievement.title}</h3>
            <p className="text-sm text-primary font-semibold uppercase">
              {currentAchievement.category}
            </p>
            <p className="text-sm text-muted-foreground max-w-sm">
              {currentAchievement.description}
            </p>
          </div>

          {/* Progress indicator */}
          {achievements.length > 1 && (
            <div className="flex gap-1.5">
              {achievements.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentIndex
                      ? "w-8 bg-primary"
                      : idx < currentIndex
                        ? "w-1.5 bg-primary/60"
                        : "w-1.5 bg-muted"
                  }`}
                />
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 w-full">
            {currentIndex < achievements.length - 1 ? (
              <>
                <Button onClick={handleSkip} variant="ghost" className="flex-1">
                  Skip
                </Button>
                <Button onClick={handleNext} className="flex-1">
                  Next
                </Button>
              </>
            ) : (
              <Button onClick={onClose} className="w-full">
                Continue
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
