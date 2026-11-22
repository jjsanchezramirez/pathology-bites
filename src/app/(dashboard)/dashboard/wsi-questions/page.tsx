"use client";

import { useEffect } from "react";

import { PageHeader } from "@/shared/components/ui/page-header";
import { WSIQuestionGenerator } from "@/features/user/wsi-questions/components/wsi-question-generator";
import { hydrateWsiLayout, useWsiLayout } from "@/features/user/wsi-questions/utils/wsi-layout";
import { useWsiLayoutShortcut } from "@/features/user/wsi-questions/utils/use-wsi-layout-shortcut";
import { useImmersiveMode } from "@/shared/contexts/immersive-mode-context";

// Note: Metadata would be exported from a parent layout or server component
// This is a client component so metadata is handled by the layout

export default function WSIQuestionsPage() {
  const layout = useWsiLayout();
  const fullscreen = layout === "fullscreen";

  // Applied after hydration, not during render: the store starts at "classic" on
  // both sides so the first client render matches the server's.
  useEffect(hydrateWsiLayout, []);

  // Bound here rather than in the generator: the page is mounted through every
  // generator state, so the key works while a question is still loading.
  useWsiLayoutShortcut(layout);

  // Collapses the sidebar to its rail and hands the page a full-height `main`,
  // exactly as an active quiz gets. The header stays visible.
  useImmersiveMode(fullscreen);

  return (
    // `pb-squircle` shapes every rounded corner below it as a superellipse, so
    // the answer options and cards match the in-house viewer's own chrome
    // instead of meeting it with circular corners. Chromium-only; elsewhere the
    // declaration is ignored and the page keeps ordinary rounded corners.
    <div className={fullscreen ? "pb-squircle h-full" : "pb-squircle space-y-6"}>
      {/* The heading is the first thing to go when the reader asks for room —
          they know what page they are on. */}
      {!fullscreen && (
        <PageHeader
          title="Slide-Based Questions"
          description="Generate unlimited AI-powered pathology questions from whole slide images."
        />
      )}

      <WSIQuestionGenerator showCategoryFilter={true} compact={false} className="w-full" />
    </div>
  );
}
