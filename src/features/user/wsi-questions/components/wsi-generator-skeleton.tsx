"use client";

/**
 * Loading state for when no slide has been chosen yet — the corpus is still
 * downloading, or a prefetched question is resolving.
 *
 * Renders in whichever layout is active. It used to know only the classic
 * column, so entering this state from full screen dropped the reader back into
 * a narrow page mid-generation and then snapped forward again when the question
 * arrived.
 */

import { SectionCard } from "@/shared/components/ui/page-layout";
import { WsiFullscreenShell } from "./wsi-fullscreen-shell";
import { LoadingNote, OptionsSkeleton, StemSkeleton, ViewerPlaceholder } from "./wsi-loading-parts";
import type { ReactNode } from "react";
import type { WsiLayout } from "@/features/user/wsi-questions/utils/wsi-layout";

interface WSIGeneratorSkeletonProps {
  className: string;
  /** The live control bar, so it neither disappears nor changes shape while loading. */
  controls: ReactNode;
  layout: WsiLayout;
  isWSIDataLoading: boolean;
  currentLoadingMessage: string;
}

export function WSIGeneratorSkeleton({
  className,
  controls,
  layout,
  isWSIDataLoading,
  currentLoadingMessage,
}: WSIGeneratorSkeletonProps) {
  if (layout === "fullscreen") {
    return (
      <WsiFullscreenShell
        className={className}
        controls={controls}
        viewer={
          <ViewerPlaceholder
            isWSIDataLoading={isWSIDataLoading}
            currentLoadingMessage={currentLoadingMessage}
            fillHeight
          />
        }
        panel={
          <>
            <LoadingNote
              isWSIDataLoading={isWSIDataLoading}
              currentLoadingMessage={currentLoadingMessage}
              compact
            />
            <StemSkeleton />
            <OptionsSkeleton />
          </>
        }
      />
    );
  }

  return (
    <div className={`w-full max-w-4xl mx-auto ${className}`} style={{ minHeight: "600px" }}>
      {controls}

      <SectionCard className="h-full">
        <StemSkeleton />
        <ViewerPlaceholder
          isWSIDataLoading={isWSIDataLoading}
          currentLoadingMessage={currentLoadingMessage}
        />
        <OptionsSkeleton />
      </SectionCard>
    </div>
  );
}
