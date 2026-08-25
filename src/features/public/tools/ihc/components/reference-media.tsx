"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Microscope, ExternalLink } from "lucide-react";
import { ImageViewerModal } from "@/shared/components/ui/image-viewer-modal";
import {
  searchImagesForDiagnosis,
  type DiagnosisImage,
} from "@/features/admin/images/services/images";
import { useAllVirtualSlides } from "@/shared/hooks/use-client-virtual-slides";
import {
  buildSearchIndex,
  rankSlidesWithExpansion,
} from "@/shared/utils/domain/virtual-slide-search";
import { isViewerSupported } from "@/shared/utils/domain/repository";
import type { VirtualSlide } from "@/shared/types/virtual-slides";

// The in-house viewer — the same one the virtual-slides tool, the quiz and the
// WSI questions use. Deliberately NOT `WSIViewer`, which resolves an *iframe*
// strategy from the slide URL: that route hands WHO Blue Books, LearnHaem and
// the rest to the host's own page instead of our OSD/DZI viewer, and sends
// Leeds to a dead "fallback" panel. `isViewerSupported` is the predicate that
// goes with THIS component, so it is the one that decides what we show inline.
// Bundles OpenSeadragon, hence the dynamic import.
const SelfHostedOSDViewer = dynamic(
  () =>
    import("@/shared/components/common/self-hosted-osd-viewer").then((m) => m.SelfHostedOSDViewer),
  { ssr: false, loading: () => <div className="h-80 animate-pulse rounded-lg bg-muted" /> }
);

/**
 * Embed image-library matches for a diagnosis (full-text, spelling/acronym aware).
 *
 * A thumbnail opens the image where you are looking at it. It used to navigate
 * to /tools/images with the diagnosis pre-searched, which threw away the tool's
 * state to show one picture; the library page itself opens images in a lightbox,
 * so this now uses the same `ImageViewerModal` it does.
 */
export function ImageMatches({ name, aliases }: { name: string; aliases?: string[] }) {
  const [images, setImages] = useState<DiagnosisImage[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // Depend on a stable string, not the array: an aliasless diagnosis gets a fresh
  // `[]` each render, which as an effect dependency would loop setImages forever.
  const aliasKey = JSON.stringify(aliases ?? []);

  useEffect(() => {
    let cancelled = false;
    setImages([]);
    setOpenIndex(null);
    searchImagesForDiagnosis(name, JSON.parse(aliasKey) as string[], 6)
      .then((res) => {
        if (!cancelled) setImages(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [name, aliasKey]);

  // Arrow keys walk the set while the lightbox is open, so a six-image result
  // reads as one gallery rather than six separate open/close cycles.
  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setOpenIndex((i) => (i === null ? i : (i + 1) % images.length));
      if (e.key === "ArrowLeft")
        setOpenIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openIndex, images.length]);

  if (images.length === 0) return null;
  const open = openIndex === null ? null : images[openIndex];

  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Images</h4>
      <div className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="group relative block aspect-square overflow-hidden rounded-md border"
            title={img.description || img.alt_text || name}
            aria-label={`Open image: ${img.description || img.alt_text || name}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- dynamic R2 URLs */}
            <img
              src={img.url}
              alt={img.description || img.alt_text || name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </button>
        ))}
      </div>
      <a
        href={`/tools/images?search=${encodeURIComponent(name)}`}
        className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
      >
        See all in the image library <ExternalLink className="h-2.5 w-2.5" />
      </a>
      {open && (
        <ImageViewerModal
          src={open.url}
          alt={open.alt_text || name}
          description={open.description || undefined}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </div>
  );
}

// Score below which a ranked slide is treated as "no real match" rather than
// shown. The slide engine scores an exact diagnosis 100, a contained phrase 90,
// and word-level token overlap 70-80; anything under 70 is a weak/partial hit we
// don't want to present as *the* slide for this entity.
const SLIDE_MATCH_MIN_SCORE = 70;

/**
 * Can the in-house viewer actually render this slide?
 *
 * Repository-gated, matching every other consumer: the tile-source resolver
 * knows DZI / Leeds / Aperio / Wirtualny, and Recut (login) and Toronto
 * (auth-walled) are the ones that keep an external link. PathPresenter renders
 * too, but only when the case shipped a pre-resolved `tileSourceUrl`, so it is
 * gated on that field rather than on the repository name.
 */
function isViewable(slide: VirtualSlide): boolean {
  return Boolean(slide.tileSourceUrl) || isViewerSupported(slide.repository || "");
}

interface SlideResult {
  /** Best match we can actually display in the viewer. */
  viewable: VirtualSlide | null;
  /** Best match overall, when it can only be opened on its host site. */
  external: VirtualSlide | null;
}

/**
 * Show the best matching virtual slide for a diagnosis, in the viewer.
 *
 * Two changes from the version this replaces, both from the same complaint —
 * a reference page should show you the slide, not offer to go looking for one:
 *
 *  * It searches on mount instead of behind a "Find a virtual slide" button.
 *    The slide dataset is a shared module-level cache (`useAllVirtualSlides`),
 *    so on any page that has already loaded it this costs nothing, and the OSD
 *    bundle is still deferred until a slide is actually matched.
 *  * It ranks only slides our viewer can EMBED. Leeds, Toronto and Recut all
 *    refuse to be framed (see wsi-viewer-config.ts), so the old code could pick
 *    a top-scoring slide and then render a dead panel. The best embeddable
 *    slide is shown inline; a better-scoring un-embeddable one is offered as a
 *    link to its host instead of being silently dropped.
 */
export function SlideMatch({ name, aliases }: { name: string; aliases?: string[] }) {
  const slides = useAllVirtualSlides(true);
  const [result, setResult] = useState<SlideResult | null>(null);
  // Depend on a stable string, not the array (a fresh `[]` each render would loop).
  const aliasKey = JSON.stringify(aliases ?? []);

  // Use the app's real slide-search engine (the same ranked matcher the WSI tool
  // uses) instead of a substring scan: it's punctuation- and word-order-tolerant,
  // expands WHO acronyms, and returns a confidence score we can gate on.
  useEffect(() => {
    if (!slides) return;
    let cancelled = false;
    setResult(null);
    buildSearchIndex(slides);
    // Try the primary name first, then fall back through aliases until one clears
    // the confidence bar — an old synonym sometimes matches the slide library's
    // naming when the current WHO term doesn't.
    (async () => {
      for (const query of [name, ...(JSON.parse(aliasKey) as string[])].slice(0, 5)) {
        if (cancelled) return;
        const res = await rankSlidesWithExpansion(slides, query);
        const hits = (res.scoredSlides ?? []).filter((s) => s.score >= SLIDE_MATCH_MIN_SCORE);
        if (!hits.length) continue;
        const viewable = hits.find((s) => isViewable(s.slide))?.slide ?? null;
        if (!cancelled) {
          setResult({ viewable, external: viewable ? null : hits[0].slide });
        }
        return;
      }
      if (!cancelled) setResult({ viewable: null, external: null });
    })();
    return () => {
      cancelled = true;
    };
  }, [slides, name, aliasKey]);

  if (!slides || !result) {
    return (
      <div>
        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Virtual slide
        </h4>
        <div className="h-80 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (result.viewable) {
    return (
      <div>
        <h4 className="mb-1.5 flex flex-wrap items-baseline gap-x-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Virtual slide
          <span className="font-normal normal-case tracking-normal">
            {result.viewable.diagnosis}
            {result.viewable.stain_type ? ` · ${result.viewable.stain_type}` : ""} ·{" "}
            {result.viewable.repository}
          </span>
        </h4>
        <div className="h-96 overflow-hidden rounded-lg border">
          <SelfHostedOSDViewer
            // Remount on a different slide: the viewer seeds its OSD instance
            // from these props, and reusing it across entities would leave the
            // previous tumour's tiles on screen.
            key={result.viewable.id}
            slideUrl={result.viewable.slide_url || result.viewable.case_url}
            tileSourceUrl={result.viewable.tileSourceUrl}
            repository={result.viewable.repository}
            heightClass="h-full"
            info={{
              diagnosis: result.viewable.diagnosis,
              category: result.viewable.category,
              subcategory: result.viewable.subcategory,
              stain: result.viewable.stain_type,
            }}
          />
        </div>
      </div>
    );
  }

  // Best match exists but its host refuses embedding — link out rather than
  // render a viewer that would sit blank.
  if (result.external) {
    return (
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Virtual slide
        </h4>
        <a
          href={result.external.case_url || result.external.slide_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent"
        >
          <Microscope className="h-3.5 w-3.5" />
          {result.external.diagnosis} — open at {result.external.repository}
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {result.external.repository} does not permit embedding, so this one opens on their site.
        </p>
      </div>
    );
  }

  return null;
}
