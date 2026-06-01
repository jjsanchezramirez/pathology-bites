"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

import { Dialog, DialogContent, DialogTitle } from "@/shared/components/ui/dialog";
import { VirtualSlide } from "@/shared/types/virtual-slides";
import { getRelatedSlides } from "@/shared/hooks/use-client-virtual-slides";

// Heavy (bundles OpenSeadragon) — keep it out of the initial tool bundle.
const SelfHostedOSDViewer = dynamic(
  () =>
    import("@/shared/components/common/self-hosted-osd-viewer").then((m) => m.SelfHostedOSDViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[80vh] items-center justify-center bg-black text-sm text-white/80">
        Loading viewer…
      </div>
    ),
  }
);

// Prototype: open a search result in our own OSD viewer (no link-out). One slide at a time —
// tiles stream on demand from the source repo, so corpus size is irrelevant. Related slides
// (same case_group) populate the viewer's left panel and navigate in place.
export function SlideViewerModal({
  slide,
  onClose,
}: {
  slide: VirtualSlide | null;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState<VirtualSlide | null>(slide);
  useEffect(() => setCurrent(slide), [slide]);

  const members = useMemo(() => {
    if (!current) return [];
    const siblings = getRelatedSlides(current);
    return siblings.length ? [current, ...siblings] : [];
  }, [current]);

  const relatedSlides =
    members.length > 1
      ? members.map((s) => ({
          label: [s.diagnosis, s.stain_type].filter(Boolean).join(" · ") || s.diagnosis || "Slide",
          thumbUrl: s.preview_image_url || undefined,
          slideUrl: s.slide_url || s.case_url,
        }))
      : undefined;

  const onSelectRelated = (url: string) => {
    const s = members.find((m) => (m.slide_url || m.case_url) === url);
    if (s) setCurrent(s);
  };

  return (
    <Dialog
      open={!!slide}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="h-[95vh] w-[97vw] max-w-[97vw] gap-0 overflow-hidden border-0 bg-black p-0 sm:max-w-[97vw]">
        <DialogTitle className="sr-only">{current?.diagnosis || "Slide viewer"}</DialogTitle>
        {current && (
          <SelfHostedOSDViewer
            slideUrl={current.slide_url || current.case_url}
            repository={current.repository}
            heightClass="h-[95vh]"
            info={{
              diagnosis: current.diagnosis,
              category: current.category,
              subcategory: current.subcategory,
              stain: current.stain_type,
            }}
            relatedSlides={relatedSlides}
            onSelectRelated={onSelectRelated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
