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
  /** When false, replaces "Redirecting…" with an offline waiting message. */
  isOnline?: boolean;
  /** Final progress at the moment the timer expired. Surfaced as the score readout. */
  score?: { correct: number; total: number };
}

export function TimerExpiredDialog({ open, isOnline = true, score }: TimerExpiredDialogProps) {
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
            flex flex-col items-center gap-4
            transition-all duration-500 ease-out
            ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-105"}
          `}
        >
          {/* Title. Explicit text-white (not theme `text-foreground`) because the
              dialog sits over a dark scrim — theme foreground reads as dark text
              in light mode, which is unreadable on the overlay. */}
          <h2 className="text-2xl font-bold text-white text-center">Time&apos;s Up!</h2>

          {/* Lottie animation with amber radial spotlight behind it */}
          <div className="relative w-48 h-48">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -m-10 rounded-full bg-amber-500/20 blur-3xl"
            />
            <div className="relative w-full h-full">
              {isLoading || !animationData ? (
                <div className="w-full h-full bg-white/10 rounded-full animate-pulse" />
              ) : (
                <Lottie
                  animationData={animationData}
                  loop={true}
                  autoplay={true}
                  style={{ width: "100%", height: "100%" }}
                />
              )}
            </div>
          </div>

          {/* Score + accent + description block, mirroring the trophy modal's
              title / category / description triple. All colors are explicit
              white-on-dark variants so the contrast holds against the modal
              scrim in both light and dark themes. */}
          <div className="text-center space-y-1.5">
            {score && score.total > 0 && (
              <p className="text-3xl font-bold text-white tabular-nums">
                {score.correct} <span className="text-white/40">/</span> {score.total}
              </p>
            )}
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Time Expired
            </p>
            <p className="text-sm text-white/80 max-w-sm">
              {isOnline
                ? "Your answers are in. Pulling up your results…"
                : "You're offline. Your answers are saved — we'll submit and show your results as soon as you're back online."}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
