// Warm the browser cache with the images of the cards around the current one,
// so stepping to the next card shows its picture immediately instead of waiting
// ~0.1–1 s for it to download.
//
// The URLs must be byte-identical to what the viewer's <img> tags request, or
// the cache is never hit. So this runs the viewer's own HTML transform
// (processCardImageHtml) and lets the browser's HTML parser resolve the result —
// entity decoding (`H&amp;E` → `H&E`) and URL resolution included — exactly as
// it does when the viewer sets innerHTML. DOMParser documents are inert: parsing
// does not start any download. Only our own image host is ever prefetched.

import type { AnkiCard } from "@/features/user/anki/types/anki-card";
import { processCardImageHtml } from "@/features/user/anki/components/interactive-anki-viewer-utils";
import { isR2PublicUrl } from "@/shared/config/r2-public-urls";

/** Image URLs a card will display (question, answer, multi-image variants). */
export function collectCardImageUrls(card: AnkiCard): string[] {
  if (typeof DOMParser === "undefined") return [];
  const html = [
    processCardImageHtml(card.question || ""),
    processCardImageHtml(card.answer || ""),
    // Multiple-image cards are rendered from the parser's HTML as-is.
    card.question || "",
    card.answer || "",
  ].join("\n");
  const doc = new DOMParser().parseFromString(html, "text/html");
  const urls = new Set<string>();
  doc.querySelectorAll("img[src]").forEach((img) => {
    const src = (img as HTMLImageElement).src;
    if (isR2PublicUrl(src)) urls.add(src);
  });
  return [...urls];
}

// Per-session memory of what was already requested, and the in-flight Image
// objects (kept referenced so a download is not dropped before it finishes).
const requested = new Set<string>();
const inFlight: HTMLImageElement[] = [];
const MAX_IN_FLIGHT = 24;

export function prefetchImages(urls: string[]): void {
  if (typeof Image === "undefined") return;
  for (const url of urls) {
    if (requested.has(url)) continue;
    requested.add(url);
    const img = new Image();
    img.decoding = "async";
    // Never compete with the image the user is looking at.
    img.setAttribute("fetchpriority", "low");
    img.src = url;
    inFlight.push(img);
    if (inFlight.length > MAX_IN_FLIGHT) inFlight.shift();
  }
}

/** Prefetch the next `ahead` cards and the previous `behind` cards. */
export function prefetchAroundCard(
  cards: readonly AnkiCard[],
  index: number,
  { ahead = 3, behind = 1 }: { ahead?: number; behind?: number } = {}
): void {
  const neighbours: AnkiCard[] = [];
  for (let i = index + 1; i <= index + ahead && i < cards.length; i++) neighbours.push(cards[i]);
  for (let i = index - 1; i >= index - behind && i >= 0; i--) neighbours.push(cards[i]);
  prefetchImages(neighbours.flatMap(collectCardImageUrls));
}

/** Test hook: forget what was requested. */
export function __resetPrefetchMemory(): void {
  requested.clear();
  inFlight.length = 0;
}
