"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  useAllVirtualSlides,
  loadAllVirtualSlides,
} from "@/shared/hooks/use-client-virtual-slides";
import {
  useVirtualSlideCount,
  formatSlideCountApprox,
} from "@/shared/hooks/use-virtual-slide-count";
import { rankSlidesWithExpansion } from "@/shared/utils/domain/virtual-slide-search";
import { isViewerSupported } from "@/shared/utils/domain/repository";
import { SlideViewerModal } from "@/shared/components/common/slide-viewer-modal";
import type { VirtualSlide } from "@/shared/types/virtual-slides";

// Exclude raw image files — the homepage buttons should land users on an
// interactive WSI viewer, not a downloadable image.
const NON_VIEWER_EXTENSIONS = [".dzi", ".svs", ".tif", ".tiff", ".jpg", ".jpeg", ".png"];
function isValidWSIUrl(url: string | undefined): url is string {
  if (!url) return false;
  const lower = url.toLowerCase();
  return !NON_VIEWER_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// Repos that gate access behind a login wall — exclude from Random Slide so
// the user doesn't land on a sign-in screen. The slide.id prefixes mirror
// the IDs minted in normalizeToVirtualSlide / repository.ts.
const LOGIN_REQUIRED_PREFIXES = ["pathpresenter_", "toronto_", "recutclub_"];
function isOpenRepo(slideId: string | undefined): boolean {
  if (!slideId) return false;
  return !LOGIN_REQUIRED_PREFIXES.some((p) => slideId.startsWith(p));
}

function pickViewerUrl(slide: VirtualSlide): string | null {
  if (isValidWSIUrl(slide.slide_url)) return slide.slide_url!;
  if (isValidWSIUrl(slide.case_url)) return slide.case_url!;
  for (const url of slide.other_urls ?? []) {
    if (isValidWSIUrl(url)) return url;
  }
  return null;
}

export function VirtualSlideSearchTeaser() {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  // The slides corpus is ~2 MB brotli / ~27 MB decompressed and only powers the two
  // buttons below — so we keep it OFF the initial-load critical path (loading it eagerly
  // was tanking homepage LCP/TBT). `slidesEnabled` gates the fetch: it flips true once the
  // browser goes idle after first paint, or on first hero interaction, whichever lands
  // first. Buttons stay clickable meanwhile; a cold click awaits the corpus directly.
  const [slidesEnabled, setSlidesEnabled] = useState(false);
  const allSlides = useAllVirtualSlides(slidesEnabled);
  const [pendingAction, setPendingAction] = useState<"random" | "lucky" | null>(null);
  const [viewerSlide, setViewerSlide] = useState<VirtualSlide | null>(null);

  // Warm the corpus once the browser is idle after first paint (falls back to a short
  // timer where requestIdleCallback is unavailable). Cancelled if an interaction enables
  // it first.
  useEffect(() => {
    if (slidesEnabled) return;
    let cancelled = false;
    const enable = () => {
      if (!cancelled) setSlidesEnabled(true);
    };
    const w = window as Window & typeof globalThis;
    const id =
      typeof w.requestIdleCallback === "function"
        ? w.requestIdleCallback(enable, { timeout: 2500 })
        : w.setTimeout(enable, 1500);
    return () => {
      cancelled = true;
      if (typeof w.cancelIdleCallback === "function") w.cancelIdleCallback(id as number);
      else w.clearTimeout(id as number);
    };
  }, [slidesEnabled]);

  // Live slide count from the corpus manifest (auto-updates with each rebuild). Falls
  // back to a floored figure until the tiny manifest resolves.
  const slideCount = useVirtualSlideCount();
  const slideCountLabel = slideCount ? formatSlideCountApprox(slideCount) : "65,000+";

  // Open a slide in the in-house viewer when its repo is renderable; otherwise fall back to the
  // source site (login-walled / non-embeddable repos) so the homepage buttons never dead-end.
  const openSlide = (slide: VirtualSlide) => {
    if (isViewerSupported(slide.repository)) {
      setViewerSlide(slide);
      return;
    }
    const url = pickViewerUrl(slide);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else router.push(`/tools/virtual-slides?search=${encodeURIComponent(slide.diagnosis || "")}`);
  };

  // Return the corpus, loading it on demand if a cold click beat the idle prefetch.
  // Marks the clicked button as pending only while a real fetch is in flight (warm
  // clicks resolve synchronously and never flash "Loading…").
  const ensureSlides = async (action: "random" | "lucky"): Promise<VirtualSlide[] | null> => {
    if (allSlides && allSlides.length > 0) return allSlides;
    setPendingAction(action);
    try {
      return await loadAllVirtualSlides();
    } catch {
      return null;
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/tools/virtual-slides?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push("/tools/virtual-slides");
    }
  };

  const handleFeelingLucky = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    setSlidesEnabled(true);

    try {
      const all = await ensureSlides("lucky");
      if (!all || all.length === 0) {
        window.open(
          `/tools/virtual-slides?search=${encodeURIComponent(query)}`,
          "_blank",
          "noopener,noreferrer"
        );
        return;
      }
      // Call the search engine directly instead of routing through the hook's
      // setState-driven `searchWithFilters` API. The hook returns a snapshot
      // of `slides` captured at the render the click handler closed over, so
      // a subsequent `setOptions({ query })` + `await setTimeout` doesn't
      // surface the new results inside this same handler — you'd read the
      // pre-search slides ref and end up at whatever the first un-filtered
      // result was. Calling `rankSlidesWithExpansion` here gives us the
      // ranked alveolar-RMS-style result synchronously off the in-memory
      // search index that `loadClientSlides()` already built.
      const ranked = await rankSlidesWithExpansion(all, query);

      // Prefer the top viewer-renderable match (opens in-house); else the best match with a
      // usable URL (link-out); else the full search page.
      const target =
        ranked.slides.find((s) => isViewerSupported(s.repository) && pickViewerUrl(s)) ??
        ranked.slides.find((s) => pickViewerUrl(s));

      if (target) {
        openSlide(target);
      } else {
        window.open(
          `/tools/virtual-slides?search=${encodeURIComponent(query)}`,
          "_blank",
          "noopener,noreferrer"
        );
      }
    } catch (error) {
      console.error("Feeling lucky failed:", error);
      window.open(
        `/tools/virtual-slides?search=${encodeURIComponent(query)}`,
        "_blank",
        "noopener,noreferrer"
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleRandomSlide = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    setSlidesEnabled(true);
    try {
      const all = await ensureSlides("random");
      if (!all || all.length === 0) return;

      const candidates: VirtualSlide[] = [];
      for (const slide of all) {
        if (!isOpenRepo(slide.id)) continue;
        if (pickViewerUrl(slide)) candidates.push(slide);
      }

      if (candidates.length === 0) {
        console.warn("[Random Slide] No valid WSI viewer URLs found in open repos");
        return;
      }

      // Prefer a viewer-renderable slide so Random Slide opens in the in-house viewer.
      const supported = candidates.filter((s) => isViewerSupported(s.repository));
      const pool = supported.length > 0 ? supported : candidates;
      openSlide(pool[Math.floor(Math.random() * pool.length)]);
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto lg:mx-0">
      <form
        onSubmit={handleSearch}
        onPointerEnter={() => setSlidesEnabled(true)}
        onFocus={() => setSlidesEnabled(true)}
        className="space-y-4"
      >
        <div className="relative">
          <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 h-6 w-6 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${slideCountLabel} virtual slides...`}
            className="w-full pl-14 pr-28 py-5 rounded-xl border-2 border-input bg-background/50 backdrop-blur-sm text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all hover:bg-background shadow-lg hover:shadow-xl"
          />
          <Button
            type="submit"
            size="lg"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-primary hover:bg-primary/90 px-6 sm:px-8"
          >
            Search
          </Button>
        </div>

        {/* Google-style button row */}
        <div className="flex gap-3 justify-center lg:justify-start">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={handleRandomSlide}
            disabled={pendingAction === "random"}
            className="px-6 transition-all hover:scale-105 hover:shadow-md"
          >
            {pendingAction === "random" ? "Loading..." : "Visit Random Slide"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={handleFeelingLucky}
            disabled={pendingAction === "lucky" || !searchQuery.trim()}
            className="px-6 transition-all hover:scale-105 hover:shadow-md"
          >
            {pendingAction === "lucky" ? "Loading..." : "I'm Feeling Lucky"}
          </Button>
        </div>
      </form>
      <SlideViewerModal slide={viewerSlide} onClose={() => setViewerSlide(null)} />
    </div>
  );
}
