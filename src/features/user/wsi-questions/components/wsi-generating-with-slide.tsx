"use client";

/**
 * Generating state for when the slide is already known.
 *
 * The slide is chosen client-side in ~0ms, but its tiles take seconds to load
 * and the question text takes seconds to generate. The plain skeleton hid both,
 * so those two waits ran back to back. Rendering the real viewer here starts
 * the tile fetch during generation instead of after it — the reader can begin
 * reading the histology while the stem is still being written.
 *
 * Only the question text is skeletonised, because only the question text is
 * actually still unknown.
 */

import { Card, CardContent } from "@/shared/components/ui/card";
import { LoadingNote, OptionsSkeleton, StemSkeleton } from "./wsi-loading-parts";
import { WSIQuestionViewer } from "./wsi-question-viewer";
import { WsiFullscreenShell } from "./wsi-fullscreen-shell";
import { WSISlideCredits } from "./wsi-slide-credits";
import type { ReactNode } from "react";
import type { VirtualSlide } from "@/shared/types/virtual-slides";
import type { WsiLayout } from "@/features/user/wsi-questions/utils/wsi-layout";

interface WSIGeneratingWithSlideProps {
  className: string;
  slide: VirtualSlide;
  /** The live control bar, rendered by the parent so it is identical to the answered view's. */
  controls: ReactNode;
  layout: WsiLayout;
  currentLoadingMessage: string;
}

export function WSIGeneratingWithSlide({
  className,
  slide,
  controls,
  layout,
  currentLoadingMessage,
}: WSIGeneratingWithSlideProps) {
  // Full screen has to match the answered view exactly, or the overlay tears down
  // and re-mounts on every question — taking the tile cache with it.
  if (layout === "fullscreen") {
    return (
      <WsiFullscreenShell
        className={className}
        controls={controls}
        viewer={<WSIQuestionViewer slide={slide} fillHeight />}
        panel={
          <>
            <LoadingNote currentLoadingMessage={currentLoadingMessage} compact />
            <StemSkeleton />
            <OptionsSkeleton />
            <WSISlideCredits wsi={slide} />
          </>
        }
      />
    );
  }

  return (
    <div className={`w-full max-w-4xl mx-auto ${className}`} style={{ minHeight: "600px" }}>
      {controls}

      <Card className="h-full">
        <CardContent className="space-y-3 sm:space-y-4 pt-4 sm:pt-6 px-3 sm:px-6">
          <StemSkeleton />
          <LoadingNote currentLoadingMessage={currentLoadingMessage} compact />

          {/* The real viewer — tiles start loading now, not after generation. */}
          <div className="w-full">
            <WSIQuestionViewer slide={slide} />
            <WSISlideCredits wsi={slide} />
          </div>

          <OptionsSkeleton />
        </CardContent>
      </Card>
    </div>
  );
}
