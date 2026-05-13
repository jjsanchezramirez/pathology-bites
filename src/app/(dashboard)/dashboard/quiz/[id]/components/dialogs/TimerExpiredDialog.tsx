// src/app/(dashboard)/dashboard/quiz/[id]/components/dialogs/TimerExpiredDialog.tsx
"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Dialog, DialogContent, DialogTitle } from "@/shared/components/ui/dialog";
import { VisuallyHidden } from "@/shared/components/ui/visually-hidden";
import { useLottieAnimation } from "@/shared/hooks/use-lottie-animation";

// `lottie-react` is dynamically imported with `ssr: false` because `lottie-web`
// (its transitive dep) touches `window` at module load time — bundling it for
// SSR causes Next.js dev to misplace the vendor chunk and 500 every route in
// the dependency graph. The trade-off is a code-split chunk that needs to
// load on first render; if the user is offline when the timer expires, the
// chunk fetch fails and React's error boundary unmounts the dialog. The quiz
// page mitigates that by calling `preloadLottieReactChunk()` (below) on quiz
// init, which resolves to the same chunk and warms the browser cache before
// the timer ever has a chance to expire.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

export function preloadLottieReactChunk(): Promise<unknown> {
  return import("lottie-react");
}

interface TimerExpiredDialogProps {
  open: boolean;
  onViewResults?: () => void;
  /** When false, replaces "Redirecting…" with an offline waiting message. */
  isOnline?: boolean;
}

export function TimerExpiredDialog({ open, isOnline = true }: TimerExpiredDialogProps) {
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
              {isOnline
                ? "Redirecting to your quiz results..."
                : "You're offline. Your answers are saved — we'll submit and show your results as soon as you're back online."}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
