"use client";

/**
 * The slide viewer for WSI questions — our own OpenSeadragon, never an iframe.
 *
 * PathPresenter's corpus stores a case-viewer page (a Vue app), not a slide, so
 * the embed path used to hand that page to an <iframe>. The Deep Zoom manifests
 * behind those pages are public and are now resolved ahead of time and published
 * with the corpus as `tile_source_url`, which is what lets the in-house viewer
 * take over: same tiles, our controls, no third-party chrome.
 *
 * Slides without a manifest are filtered out of the question pool upstream
 * (use-wsi-question-generator), so the guard here is a backstop, not a fallback.
 */

import dynamic from "next/dynamic";
import { useCallback, useEffect } from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Loader2 } from "lucide-react";
import type { VirtualSlide } from "@/shared/types/virtual-slides";
import type { SavedView } from "@/shared/components/common/self-hosted-osd-viewer";
import { isViewerSupported } from "@/shared/utils/domain/repository";

// OSD touches window/document at import time, so it cannot be server-rendered.
const SelfHostedOSDViewer = dynamic(
  () =>
    import("@/shared/components/common/self-hosted-osd-viewer").then((m) => m.SelfHostedOSDViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-lg border bg-muted/30">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

/**
 * The last place the reader was looking, for one slide.
 *
 * Switching layout moves the viewer to a different part of the tree, so React
 * unmounts it and OSD's viewport goes with it — without this, flipping to full
 * screen to get a better look would throw away the field you flipped for. Module
 * scope rather than state because the point is to outlive the unmount; keyed by
 * slide so a new question always opens fitted, on its own terms.
 */
let remembered: { slideId: string; view: SavedView } | null = null;

interface WSIQuestionViewerProps {
  slide: VirtualSlide;
  /** Fill the parent's height (full-screen layout) instead of a fixed inline box. */
  fillHeight?: boolean;
  /**
   * The slide could not be opened — a dead tile host, a pyramid that has gone
   * away. The question is unanswerable without it, and the host is the only
   * thing that can offer the reader another one.
   */
  onUnavailable?: (message: string) => void;
}

export function WSIQuestionViewer({
  slide,
  fillHeight = false,
  onUnavailable,
}: WSIQuestionViewerProps) {
  const rememberView = useCallback(
    (view: SavedView) => {
      remembered = { slideId: slide.id, view };
    },
    [slide.id]
  );

  // Two ways a slide reaches the viewer, and both are normal:
  //   - PathPresenter ships a pre-resolved DZI, because its `url` is a Vue case
  //     page rather than a slide and there is nothing to resolve at runtime.
  //   - The curated haematolymphoid cases (WHO, Leeds, MGH, Rosai…) carry no
  //     manifest at all; the tile-source resolver opens them from the slide URL
  //     by host, exactly as it does on /tools/virtual-slides.
  // Requiring a manifest rejected the whole second group with "no tile source".
  const openable = Boolean(slide.tileSourceUrl) || isViewerSupported(slide.repository || "");

  // Reported through the same channel whether the failure is structural (no
  // openable source) or happens at load time, so the host handles one case.
  // In an effect, not in the branch below: the host reacts by setting state, and
  // doing that from inside another component's render is a React error.
  useEffect(() => {
    if (!openable) onUnavailable?.("This slide has no source the viewer can open.");
  }, [openable, onUnavailable]);

  if (!openable) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10 text-sm text-muted-foreground">
          This slide cannot be opened in the viewer.
        </CardContent>
      </Card>
    );
  }

  return (
    // Inline height is deliberate: the classic layout has no bounded parent to
    // inherit from, so the box has to state its own size.
    <div
      className={fillHeight ? "h-full min-h-0" : "w-full"}
      style={fillHeight ? undefined : { height: "560px" }}
    >
      <SelfHostedOSDViewer
        // Remount per slide: OSD keeps its own viewport/tile state.
        key={slide.id}
        slideUrl={slide.slide_url || slide.case_url || ""}
        tileSourceUrl={slide.tileSourceUrl}
        repository={slide.repository}
        heightClass="h-full"
        // The viewer root carries `wsi-squircle` + `overflow-hidden` but no radius
        // of its own, so `corner-shape: squircle` has nothing to shape until a
        // caller supplies one. 18px is what the lab used and what the rest of the
        // viewer's chrome is tuned against.
        className="rounded-[18px]"
        initialView={remembered?.slideId === slide.id ? remembered.view : undefined}
        onViewChange={rememberView}
        onError={onUnavailable}
        info={{
          // No `diagnosis` — the info panel would print the answer.
          category: slide.category,
          subcategory: slide.subcategory,
          stain: slide.stain_type,
        }}
      />
    </div>
  );
}
