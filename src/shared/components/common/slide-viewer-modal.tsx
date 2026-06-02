"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, Microscope, X } from "lucide-react";

import { cn } from "@/shared/utils/index";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { VirtualSlide } from "@/shared/types/virtual-slides";
import { getCaseGroup } from "@/shared/hooks/use-client-virtual-slides";
import { useLottieAnimation } from "@/shared/hooks/use-lottie-animation";

// Animated error mark (same "error" Lottie used by the demo-question + other load-failure
// states) — keeps the slide-failure card consistent with the rest of the app.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

// Self-contained error mark. The "error" Lottie is a one-shot; ping-pong it forward/reverse
// so it doesn't freeze on its last frame.
//
// MEMORY LEAK FIX: lottie-web MUTATES the animationData object in place — configAnimation does
// `this.animationData = animData; animData.assets = []` and completeData stamps `_render` /
// `_processed` / `__complete` onto every shape (see node_modules/lottie-web .../lottie.js:1648).
// `useLottieAnimation` returns a MODULE-CACHED, shared object, so every dialog open piled more
// parsed/rendered state onto that one cached object, which the cache then pinned forever —
// destroy()-on-unmount couldn't reclaim it. Repeatedly opening a failing slide leaked a full
// parsed animation (~180k objects) per open and froze the tab within a few tries. Fix: hand each
// instance a fresh `structuredClone`, so lottie-web mutates a throwaway copy that's GC'd with the
// instance on unmount and the shared cache stays clean. (Kept as its own component so the
// `complete` listener is tied to the error card's mount/unmount; `active` guards a late event.)
function ErrorLottie({ animationData }: { animationData: unknown }) {
  const data = useMemo(() => structuredClone(animationData), [animationData]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = useRef<any>(null);
  useEffect(() => {
    const anim = ref.current?.animationItem;
    if (!anim) return;
    let active = true;
    const onComplete = () => {
      if (!active) return;
      anim.setDirection(anim.playDirection * -1);
      anim.play();
    };
    anim.addEventListener("complete", onComplete);
    return () => {
      active = false;
      anim.removeEventListener("complete", onComplete);
    };
  }, []);
  return (
    <Lottie
      lottieRef={ref}
      animationData={data}
      loop={false}
      autoplay
      style={{ width: "100%", height: "100%" }}
    />
  );
}

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
  initialSlide,
  onClose,
}: {
  slide: VirtualSlide | null;
  // MGH only: a specific within-case slide (/list name hash) to open on, instead of the
  // case's H&E representative. Seeded once when the viewer mounts for this case.
  initialSlide?: string;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState<VirtualSlide | null>(slide);
  // Tiles showing? Drives the small-card → full-window expand. Stays true across in-case
  // slide switches (the viewer handles those with its own blur transition).
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lineIdx, setLineIdx] = useState(0);
  // Bumped after the small→full expand finishes so the viewer refits to the big container.
  const [fitToken, setFitToken] = useState(0);
  // CSS pseudo-fullscreen, set by the viewer on browsers without the element Fullscreen API
  // (iOS Safari). The viewer can't escape this dialog's centering transform on its own, so we
  // expand the whole DialogContent to the viewport instead.
  const [cssFullscreen, setCssFullscreen] = useState(false);

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
      setLoadError(null);
      setLineIdx(Math.floor(Math.random() * LOADING_LINES.length));
      setCssFullscreen(false);
    }
  }, [slide]);

  // Cycle the loading lines until tiles are up (or it errors out).
  useEffect(() => {
    if (ready || loadError || !slide) return;
    const t = setInterval(() => setLineIdx((i) => (i + 1) % LOADING_LINES.length), 2200);
    return () => clearInterval(t);
  }, [ready, loadError, slide]);

  // Full case group in canonical order (stable regardless of which slide is selected) — the
  // active one is just highlighted in place, so picking a sibling doesn't reshuffle the list.
  const members = useMemo(() => {
    if (!current) return [];
    const group = getCaseGroup(current);
    return group.length > 1 ? group : [];
  }, [current]);

  // Memoized so its identity is stable across re-renders — the viewer keys an effect on this
  // prop, and a fresh array each render would re-run it and clobber the cross-fade on nav.
  const relatedSlides = useMemo(
    () =>
      members.length > 1
        ? members.map((s) => ({
            // Stain rendered as its own chip on the thumbnail (below), so the label is just
            // the diagnosis — avoids "diagnosis · stain" duplicating the chip.
            label: s.diagnosis || "Slide",
            thumbUrl: s.preview_image_url || undefined,
            slideUrl: s.slide_url || s.case_url,
            stain: s.stain_type || undefined,
          }))
        : undefined,
    [members]
  );

  const onSelectRelated = (url: string) => {
    const s = members.find((m) => (m.slide_url || m.case_url) === url);
    if (s) setCurrent(s);
  };

  // Once ready never reverts within a session — guard so repeated readies are cheap.
  const readyRef = useRef(false);
  readyRef.current = ready;

  const { animationData: errorAnim, isLoading: errorAnimLoading } = useLottieAnimation("error");

  return (
    <Dialog
      open={!!slide}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        // The default bare close icon is invisible over a black letterbox (dark on black) and
        // we can't flip it white (most slides are white). Render our own with a backing chip
        // so it contrasts with the chip, not the slide — visible on any background.
        showCloseButton={false}
        // Close only on a genuine pointer-down on the blurred backdrop (the overlay). OSD's
        // canvas pointer handling and our in-viewer menu open/close toggles otherwise trip
        // Radix's outside-pointer/focus detection (a second button press or a tap to close a
        // menu was closing the whole viewer), so anything whose target is inside the content is
        // ignored — only the overlay itself dismisses. Escape + the X still close explicitly.
        onInteractOutside={(e) => {
          const target = e.detail.originalEvent.target as HTMLElement | null;
          if (!target?.closest('[data-slot="dialog-overlay"]')) e.preventDefault();
        }}
        className={cn(
          // NB: no `position` utility here — the base DialogContent is `fixed` (which also
          // serves as the containing block for the absolute children below). Adding
          // `relative` would win the twMerge conflict and drop the fixed centering, kicking
          // the whole dialog into document flow off-screen.
          "gap-0 overflow-hidden border-0 bg-black p-0 transition-all duration-500 ease-out",
          ready
            ? "h-[95vh] w-[97vw] max-w-[97vw] sm:max-w-[97vw]"
            : "h-[320px] w-[90vw] max-w-sm sm:max-w-sm",
          // CSS fullscreen (iOS Safari fallback): fill the viewport, overriding the centering
          // transform + size above. Last in the list so twMerge resolves the conflicts here.
          cssFullscreen &&
            "h-[100dvh] w-screen max-w-none sm:max-w-none top-0 left-0 translate-x-0 translate-y-0 rounded-none"
        )}
      >
        <DialogTitle className="sr-only">{current?.diagnosis || "Slide viewer"}</DialogTitle>
        <DialogDescription className="sr-only">
          Interactive whole-slide image viewer
          {current?.repository ? ` — ${current.repository}` : ""}
        </DialogDescription>

        {/* Close — backing chip keeps the X visible over black letterbox or white slide alike.
            Offset by the safe-area insets so a landscape notch (viewport-fit=cover) can't sit on
            top of the close button. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            top: "calc(0.75rem + env(safe-area-inset-top, 0px))",
            right: "calc(0.75rem + env(safe-area-inset-right, 0px))",
          }}
          className="absolute z-50 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-md ring-1 ring-black/10 backdrop-blur transition-colors hover:bg-white md:h-8 md:w-8"
        >
          <X className="h-5 w-5 md:h-4 md:w-4" />
        </button>

        {/* Viewer fills the box (absolute → bypasses the dialog's grid). It loads tiles even
            while the card covers it, so by the time we expand the slide is already showing.
            Inset left/right by the safe-area insets so in mobile landscape (viewport-fit=cover)
            the slide + controls stay within the visible viewport instead of rendering under the
            notch; the notch strip just shows the dialog's black. env() is 0 with no notch. */}
        {current && (
          <div
            className="absolute bottom-0 top-0"
            style={{
              left: "env(safe-area-inset-left, 0px)",
              right: "env(safe-area-inset-right, 0px)",
            }}
          >
            <SelfHostedOSDViewer
              slideUrl={current.slide_url || current.case_url}
              tileSourceUrl={current.tileSourceUrl}
              initialSlide={initialSlide}
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
                if (!readyRef.current && !loadError) setReady(true);
              }}
              onError={(msg) => setLoadError(msg)}
              onCssFullscreenChange={setCssFullscreen}
            />
          </div>
        )}

        {/* Loading / error card. Covers the viewer until tiles are up; on a load failure it
            switches to a graceful message instead of leaving a blank (or blurred) window. */}
        <div
          aria-hidden={ready && !loadError}
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white px-6 text-center transition-opacity duration-500 ease-out",
            ready && !loadError ? "opacity-0" : "opacity-100",
            loadError ? "pointer-events-auto" : "pointer-events-none"
          )}
        >
          {loadError ? (
            <>
              <div className="flex h-24 w-24 items-center justify-center">
                {errorAnimLoading || !errorAnim ? (
                  <div className="h-full w-full animate-pulse rounded-full bg-muted/20" />
                ) : (
                  <ErrorLottie animationData={errorAnim} />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-800">Couldn&apos;t open this slide</p>
                <p className="max-w-xs text-xs leading-relaxed text-gray-500">{loadError}</p>
                {(current?.slide_url || current?.case_url) && !current?.loginWalled && (
                  <a
                    href={current.slide_url || current.case_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
                  >
                    Try it on the source site →
                  </a>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="relative flex items-center justify-center">
                <Loader2 className="h-20 w-20 animate-spin text-primary/25" />
                <Microscope className="absolute h-8 w-8 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-800">Opening slide…</p>
                <p className="min-h-[2.5rem] max-w-xs text-xs italic leading-relaxed text-gray-500 transition-opacity duration-300">
                  {LOADING_LINES[lineIdx]}
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
