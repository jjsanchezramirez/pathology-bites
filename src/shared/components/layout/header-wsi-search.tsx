// src/shared/components/layout/header-wsi-search.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Microscope, Loader2, Eye, ExternalLink } from "lucide-react";
import { useAllVirtualSlides } from "@/shared/hooks/use-client-virtual-slides";
import { rankSlidesWithExpansion } from "@/shared/utils/domain/virtual-slide-search";
import { isViewerSupported } from "@/shared/utils/domain/repository";
import { SlideViewerModal } from "@/shared/components/common/slide-viewer-modal";
import type { VirtualSlide } from "@/shared/types/virtual-slides";

const VIRTUAL_SLIDES_PATH = "/tools/virtual-slides";
const MAX_RESULTS = 8;

// Always-available WSI search in the dashboard header. Type a diagnosis → live matches; click
// one to open it in the in-house viewer inline (renderable repos) or jump to the full search
// page (others). The ~2 MB corpus loads lazily on first focus (useAllVirtualSlides(armed)), so
// it doesn't weigh down every dashboard page.
export function HeaderWsiSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [armed, setArmed] = useState(false);
  const allSlides = useAllVirtualSlides(armed);
  const [results, setResults] = useState<VirtualSlide[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [viewerSlide, setViewerSlide] = useState<VirtualSlide | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Debounced ranking against the corpus.
  useEffect(() => {
    const q = query.trim();
    if (!q || !allSlides) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const t = window.setTimeout(() => {
      rankSlidesWithExpansion(allSlides, q)
        .then(({ slides }) => {
          if (cancelled) return;
          const seen = new Set<string>();
          const out: VirtualSlide[] = [];
          for (const s of slides) {
            const key = (s.diagnosis || "").toLowerCase();
            if (!key || seen.has(key)) continue;
            seen.add(key);
            out.push(s);
            if (out.length >= MAX_RESULTS) break;
          }
          setResults(out);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query, allSlides]);

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const goToSearchPage = useCallback(
    (q: string) => {
      const term = q.trim();
      if (!term) return;
      router.push(`${VIRTUAL_SLIDES_PATH}?search=${encodeURIComponent(term)}`);
      setOpen(false);
    },
    [router]
  );

  const pickResult = (slide: VirtualSlide) => {
    if (isViewerSupported(slide.repository)) {
      setViewerSlide(slide);
      setOpen(false);
    } else {
      // Not embeddable (PathPresenter / Recut) — send to the full search page on that diagnosis.
      goToSearchPage(slide.diagnosis || query);
    }
  };

  return (
    <div ref={rootRef} className="relative w-44 sm:w-56 md:w-72">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setArmed(true);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") goToSearchPage(query);
            else if (e.key === "Escape") {
              setOpen(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Search virtual slides…"
          aria-label="Search virtual slides"
          className="h-9 w-full rounded-md border border-input bg-background pr-8 pl-9 text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none"
        />
        {searching && (
          <Loader2 className="absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && query.trim() && (
        <div className="absolute top-full left-0 z-50 mt-1.5 w-full min-w-[18rem] overflow-hidden rounded-lg border bg-popover shadow-lg">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground">
              {allSlides ? "No matching slides" : "Loading slides…"}
            </div>
          ) : (
            <>
              {results.map((s) => {
                const dx = (s.diagnosis || "").replace(/<[^>]+>/g, "").trim() || "(no diagnosis)";
                const inline = isViewerSupported(s.repository);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pickResult(s)}
                    className="group flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted"
                  >
                    <Microscope className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">{dx}</span>
                      {s.repository && (
                        <span className="truncate text-xs text-muted-foreground">
                          {s.repository}
                        </span>
                      )}
                    </span>
                    {inline ? (
                      <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                    ) : (
                      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => goToSearchPage(query)}
                className="flex w-full items-center justify-between gap-2 border-t px-3 py-2 text-left text-xs font-medium text-primary hover:bg-primary/5"
              >
                <span>See all in Virtual Slide Search</span>
                <Search className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      )}

      <SlideViewerModal slide={viewerSlide} onClose={() => setViewerSlide(null)} />
    </div>
  );
}
