// src/app/(dashboard)/dashboard/quiz/[id]/components/dialogs/TimerExpiredDialog.tsx
"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Dialog, DialogContent, DialogTitle } from "@/shared/components/ui/dialog";
import { VisuallyHidden } from "@/shared/components/ui/visually-hidden";
import { useLottieAnimation } from "@/shared/hooks/use-lottie-animation";

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

interface TimerExpiredDialogProps {
  open: boolean;
  onViewResults?: () => void;
}

export function TimerExpiredDialog({ open, onViewResults }: TimerExpiredDialogProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { animationData, isLoading } = useLottieAnimation("alarm_clock");

  useEffect(() => {
    if (!open) {
      setIsVisible(false);
      return;
    }

    // Fade in animation - matches achievement modal timing
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-lg border-none bg-transparent shadow-none p-8 overflow-visible"
        showCloseButton={false}
      >
        <VisuallyHidden>
          <DialogTitle>Time&apos;s Up!</DialogTitle>
        </VisuallyHidden>

        <div
          className={`
            flex flex-col items-center gap-8
            transition-all duration-500 ease-out
            ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
          `}
        >
          {/* Title */}
          <h2 className="text-2xl font-bold text-foreground text-center">Time&apos;s Up!</h2>

          {/* Lottie animation */}
          <div className="w-48 h-48">
            {isLoading || !animationData ? (
              <div className="w-full h-full bg-muted/20 rounded-full animate-pulse" />
            ) : (
              <Lottie
                animationData={animationData}
                loop={true}
                autoplay={true}
                style={{ width: "100%", height: "100%" }}
              />
            )}
          </div>

          {/* Description */}
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground max-w-sm">
              Redirecting to your quiz results...
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
