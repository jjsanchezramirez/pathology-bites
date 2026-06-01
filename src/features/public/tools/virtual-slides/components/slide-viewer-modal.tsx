"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, Microscope } from "lucide-react";

import { cn } from "@/shared/utils/index";
import { Dialog, DialogContent, DialogTitle } from "@/shared/components/ui/dialog";
import { VirtualSlide } from "@/shared/types/virtual-slides";
import { getRelatedSlides } from "@/shared/hooks/use-client-virtual-slides";

// Heavy (bundles OpenSeadragon) — keep it out of the initial tool bundle. The loading
// fallback is transparent: the modal's own microscope/joke card sits on top until ready.
const SelfHostedOSDViewer = dynamic(
  () =>
    import("@/shared/components/common/self-hosted-osd-viewer").then((m) => m.SelfHostedOSDViewer),
  { ssr: false, loading: () => <div className="h-full w-full bg-white" /> }
);

// Light pathology-flavored loading lines, cycled while tiles stream in.
const LOADING_LINES = [
  "Warming up the objective lens…",
  "Focusing through the tissue…",
  "Coaxing the tiles out of the scanner…",
  "Adjusting the condenser (virtually)…",
  "Letting the stain settle…",
  "Scanning for mitoses you'll be quizzed on later…",
  "Centering on the most interesting field…",
  "Convincing the pixels to behave…",
  "Oiling the (digital) 100× lens…",
  "Stacking the focal planes just right…",
];

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
  // Tiles showing? Drives the small-card → full-window expand. Stays true across in-case
  // slide switches (the viewer handles those with its own blur transition).
  const [ready, setReady] = useState(false);
  const [lineIdx, setLineIdx] = useState(0);
  // Bumped after the small→full expand finishes so the viewer refits to the big container.
  const [fitToken, setFitToken] = useState(0);

  useEffect(() => setCurrent(slide), [slide]);

  // Refit once the expand transition (duration-500) has completed.
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setFitToken((n) => n + 1), 520);
    return () => clearTimeout(t);
  }, [ready]);

  // Reset the load state whenever the modal opens fresh.
  useEffect(() => {
    if (slide) {
      setReady(false);
      setLineIdx(Math.floor(Math.random() * LOADING_LINES.length));
    }
  }, [slide]);

  // Cycle the loading lines until tiles are up.
  useEffect(() => {
    if (ready || !slide) return;
    const t = setInterval(() => setLineIdx((i) => (i + 1) % LOADING_LINES.length), 2200);
    return () => clearInterval(t);
  }, [ready, slide]);

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

  // Once ready never reverts within a session — guard so repeated readies are cheap.
  const readyRef = useRef(false);
  readyRef.current = ready;

  return (
    <Dialog
      open={!!slide}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={cn(
          "relative gap-0 overflow-hidden border-0 bg-black p-0 transition-all duration-500 ease-out",
          ready
            ? "h-[95vh] w-[97vw] max-w-[97vw] sm:max-w-[97vw]"
            : "h-[320px] w-[90vw] max-w-sm sm:max-w-sm"
        )}
      >
        <DialogTitle className="sr-only">{current?.diagnosis || "Slide viewer"}</DialogTitle>

        {/* Viewer fills the box (absolute → bypasses the dialog's grid). It loads tiles even
            while the card covers it, so by the time we expand the slide is already showing. */}
        {current && (
          <div className="absolute inset-0">
            <SelfHostedOSDViewer
              slideUrl={current.slide_url || current.case_url}
              repository={current.repository}
              heightClass="h-full"
              info={{
                diagnosis: current.diagnosis,
                category: current.category,
                subcategory: current.subcategory,
                stain: current.stain_type,
              }}
              relatedSlides={relatedSlides}
              onSelectRelated={onSelectRelated}
              fitToken={fitToken}
              onReady={() => {
                if (!readyRef.current) setReady(true);
              }}
            />
          </div>
        )}

        {/* Loading card — microscope + spinner + rotating line. Fades out as we expand. */}
        <div
          aria-hidden={ready}
          className={cn(
            "pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white px-6 text-center transition-opacity duration-500 ease-out",
            ready ? "opacity-0" : "opacity-100"
          )}
        >
          <div className="relative">
            <Microscope className="h-12 w-12 text-primary" />
            <Loader2 className="absolute -bottom-1 -right-1 h-5 w-5 animate-spin text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-800">Opening slide…</p>
            <p className="min-h-[2.5rem] max-w-xs text-xs italic leading-relaxed text-gray-500 transition-opacity duration-300">
              {LOADING_LINES[lineIdx]}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
