"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Microscope, ExternalLink } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { fetchImages } from "@/features/admin/images/services/images";
import { useAllVirtualSlides } from "@/shared/hooks/use-client-virtual-slides";
import type { VirtualSlide } from "@/shared/types/virtual-slides";

// The OSD viewer is heavy — load it only when a slide is actually shown.
const WSIViewer = dynamic(
  () => import("@/shared/components/common/wsi-viewer").then((m) => m.WSIViewer),
  { ssr: false, loading: () => <div className="h-80 animate-pulse rounded-lg bg-muted" /> }
);

interface LibraryImage {
  id: string;
  url: string;
  description?: string | null;
  alt_text?: string | null;
}

/** Embed high-confidence image-library matches for a diagnosis. */
export function ImageMatches({ name }: { name: string }) {
  const [images, setImages] = useState<LibraryImage[]>([]);

  useEffect(() => {
    let cancelled = false;
    setImages([]);
    fetchImages({ searchTerm: name, page: 1, pageSize: 8, includeOnlyMicroscopicAndGross: true })
      .then((res) => {
        if (!cancelled && !res.error) setImages((res.data as LibraryImage[]).slice(0, 6));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [name]);

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

/** Embed the in-house WSI viewer for a matching virtual slide (loaded on demand). */
export function SlideMatch({ name, aliases = [] }: { name: string; aliases?: string[] }) {
  const [load, setLoad] = useState(false);
  const slides = useAllVirtualSlides(load);

  const match = useMemo<VirtualSlide | null>(() => {
    if (!slides) return null;
    const needles = [name, ...aliases].map((s) => s.toLowerCase());
    const hit = slides.find((s) => {
      const hay = `${s.diagnosis} ${s.category} ${s.subcategory}`.toLowerCase();
      return needles.some((n) => n.length >= 4 && hay.includes(n));
    });
    return hit ?? null;
  }, [slides, name, aliases]);

  if (!load) {
    return (
      <Button variant="outline" size="sm" onClick={() => setLoad(true)}>
        <Microscope className="mr-1.5 h-4 w-4" /> Find a virtual slide
      </Button>
    );
  }
  if (!slides) return <div className="h-80 animate-pulse rounded-lg bg-muted" />;
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
