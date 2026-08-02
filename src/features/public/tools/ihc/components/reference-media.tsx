"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Microscope, ExternalLink } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  searchImagesForDiagnosis,
  type DiagnosisImage,
} from "@/features/admin/images/services/images";
import { useAllVirtualSlides } from "@/shared/hooks/use-client-virtual-slides";
import {
  buildSearchIndex,
  rankSlidesWithExpansion,
} from "@/shared/utils/domain/virtual-slide-search";
import type { VirtualSlide } from "@/shared/types/virtual-slides";

// The OSD viewer is heavy — load it only when a slide is actually shown.
const WSIViewer = dynamic(
  () => import("@/shared/components/common/wsi-viewer").then((m) => m.WSIViewer),
  { ssr: false, loading: () => <div className="h-80 animate-pulse rounded-lg bg-muted" /> }
);

/** Embed image-library matches for a diagnosis (full-text, spelling/acronym aware). */
export function ImageMatches({ name, aliases }: { name: string; aliases?: string[] }) {
  const [images, setImages] = useState<DiagnosisImage[]>([]);
  // Depend on a stable string, not the array: an aliasless diagnosis gets a fresh
  // `[]` each render, which as an effect dependency would loop setImages forever.
  const aliasKey = JSON.stringify(aliases ?? []);

  useEffect(() => {
    let cancelled = false;
    setImages([]);
    searchImagesForDiagnosis(name, JSON.parse(aliasKey) as string[], 6)
      .then((res) => {
        if (!cancelled) setImages(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [name, aliasKey]);

  if (images.length === 0) return null;

  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Images</h4>
      <div className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {images.map((img) => (
          <a
            key={img.id}
            href={`/tools/images?search=${encodeURIComponent(name)}`}
            className="group relative block aspect-square overflow-hidden rounded-md border"
            title={img.description || img.alt_text || name}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- dynamic R2 URLs */}
            <img
              src={img.url}
              alt={img.description || img.alt_text || name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </a>
        ))}
      </div>
      <a
        href={`/tools/images?search=${encodeURIComponent(name)}`}
        className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
      >
        See all in the image library <ExternalLink className="h-2.5 w-2.5" />
      </a>
    </div>
  );
}

// Score below which a ranked slide is treated as "no real match" rather than
// shown. The slide engine scores an exact diagnosis 100, a contained phrase 90,
// and word-level token overlap 70-80; anything under 70 is a weak/partial hit we
// don't want to present as *the* slide for this entity.
const SLIDE_MATCH_MIN_SCORE = 70;

/** Embed the in-house WSI viewer for a matching virtual slide (loaded on demand). */
export function SlideMatch({ name, aliases }: { name: string; aliases?: string[] }) {
  const [load, setLoad] = useState(false);
  const slides = useAllVirtualSlides(load);
  const [match, setMatch] = useState<VirtualSlide | null>(null);
  const [searched, setSearched] = useState(false);
  // Depend on a stable string, not the array (a fresh `[]` each render would loop).
  const aliasKey = JSON.stringify(aliases ?? []);

  // Use the app's real slide-search engine (the same ranked matcher the WSI tool
  // uses) instead of a substring scan: it's punctuation- and word-order-tolerant,
  // expands WHO acronyms, and returns a confidence score we can gate on.
  useEffect(() => {
    if (!slides) return;
    let cancelled = false;
    setSearched(false);
    setMatch(null);
    buildSearchIndex(slides);
    // Try the primary name first, then fall back through aliases until one clears
    // the confidence bar — an old synonym sometimes matches the slide library's
    // naming when the current WHO term doesn't.
    (async () => {
      for (const query of [name, ...(JSON.parse(aliasKey) as string[])]) {
        if (cancelled) return;
        const res = await rankSlidesWithExpansion(slides, query);
        const best = res.scoredSlides?.[0];
        if (best && (res.topScore ?? 0) >= SLIDE_MATCH_MIN_SCORE) {
          if (!cancelled) {
            setMatch(best.slide);
            setSearched(true);
          }
          return;
        }
      }
      if (!cancelled) setSearched(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [slides, name, aliasKey]);

  if (!load) {
    return (
      <Button variant="outline" size="sm" onClick={() => setLoad(true)}>
        <Microscope className="mr-1.5 h-4 w-4" /> Find a virtual slide
      </Button>
    );
  }
  if (!slides || !searched) return <div className="h-80 animate-pulse rounded-lg bg-muted" />;
  if (!match) {
    return <p className="text-xs text-muted-foreground">No matching virtual slide in the library.</p>;
  }
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Virtual slide — {match.diagnosis}
      </h4>
      <div className="h-96 overflow-hidden rounded-lg border">
        <WSIViewer slide={match} showMetadata fillHeight />
      </div>
    </div>
  );
}
