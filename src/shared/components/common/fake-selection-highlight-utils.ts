// Pure helpers + constants for the fake-selection-highlight tool: search-URL
// building, query tokenization, WHO-acronym matching, and viewable-slide picking.
// (The selection/pointer engine + tooltip UI stay in the component.) Unit-tested
// in isolation (see fake-selection-highlight-utils.test.ts).

import { isViewerSupported } from "@/shared/utils/domain/repository";
import type { VirtualSlide } from "@/shared/types/virtual-slides";

const SEARCH_SUFFIX = "pathology";
export const MIN_CHARS = 2;
const VIRTUAL_SLIDES_SEARCH_PATH = "/tools/virtual-slides";

// Selections longer than this many words drop the search actions (only Highlight + Copy
// remain) — a slide search on a whole sentence is noise.
export const SEARCH_WORD_LIMIT = 8;

export const TOP_MATCH_MIN_SCORE_WHO = 85;
// 90 = the selected phrase appears verbatim inside a real diagnosis ("contains exact phrase").
export const TOP_MATCH_MIN_SCORE_OTHER = 90;
export const PATHPRESENTER_TIE_DELTA = 5;
export const PATHPRESENTER_REPOSITORY = "PathPresenter";

export type TopMatch = { slide: VirtualSlide; score: number; isWho: boolean };

/**
 * Choose which slide the inline-viewer action opens: the highest-ranked match our viewer
 * can render, in search order. No repository is preferred over rank (WHO used to be;
 * see REPOSITORY_RANK_PRIORITY in virtual-slide-search.ts).
 * Returns null when nothing renderable is available (caller falls back to the link).
 */
export function pickViewableSlide(
  topMatch: TopMatch | null,
  topMatches: VirtualSlide[]
): VirtualSlide | null {
  if (!topMatch) return null;
  return topMatches.find((s) => isViewerSupported(s.repository)) ?? null;
}

export function queryTokens(text: string): string[] {
  return (
    text
      .toLowerCase()
      .replace(/[-/]/g, " ")
      .match(/[a-z0-9]+/g) || []
  );
}

export function isWhoAcronymMatch(slide: VirtualSlide, queryText: string): boolean {
  if (!slide.acronym) return false;
  const acronyms = (Array.isArray(slide.acronym) ? slide.acronym : [slide.acronym]).map((a) =>
    a.toLowerCase()
  );
  const tokens = queryTokens(queryText);
  return tokens.some((t) => acronyms.includes(t));
}

export function buildGoogleImagesUrl(text: string): string {
  const q = `${text} ${SEARCH_SUFFIX}`.trim();
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`;
}

export function buildVirtualSlidesUrl(text: string): string {
  return `${VIRTUAL_SLIDES_SEARCH_PATH}?search=${encodeURIComponent(text)}`;
}

function openInTab(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
  window.getSelection()?.removeAllRanges();
}

export function openGoogleImages(text: string): void {
  openInTab(buildGoogleImagesUrl(text));
}

export function openVirtualSlides(text: string): void {
  openInTab(buildVirtualSlidesUrl(text));
}

export function openWsi(url: string): void {
  openInTab(url);
}
