// src/shared/hooks/use-virtual-slide-count.ts
"use client";

import { useEffect, useState } from "react";
import { VIRTUAL_SLIDES_MANIFEST_URL } from "@/shared/config/virtual-slides";

// The corpus pipeline rewrites virtual-slides/manifest.json on every rebuild with the
// live { total, ... }. Reading that 561-byte manifest gives an always-current slide
// count for free — no need to download + count the ~2 MB corpus just to show a number.
// This is the single source of truth for the public-facing slide count; it auto-tracks
// each scheduled scrape/rebuild with no app redeploy.

// Floored "N+" figure so marketing copy never overstates the live total (65,396 -> "65,000+").
export function formatSlideCountApprox(total: number): string {
  return `${(Math.floor(total / 1000) * 1000).toLocaleString()}+`;
}

// Module-level cache so the manifest is fetched at most once per session, shared across
// every component that shows the count (homepage teaser, public stats, …).
let cachedTotal: number | null = null;

export function useVirtualSlideCount(): number | null {
  const [total, setTotal] = useState<number | null>(cachedTotal);

  useEffect(() => {
    if (cachedTotal !== null) return;
    let alive = true;
    fetch(VIRTUAL_SLIDES_MANIFEST_URL)
      .then((res) => (res.ok ? res.json() : null))
      .then((manifest) => {
        if (alive && typeof manifest?.total === "number") {
          cachedTotal = manifest.total;
          setTotal(manifest.total);
        }
      })
      .catch(() => {
        // Manifest unreachable — leave null so callers fall back to their default copy.
      });
    return () => {
      alive = false;
    };
  }, []);

  return total;
}
