/**
 * Pick the passages to answer from, across all three PathTalk corpora.
 *
 * One routed source was not enough: "Are MEF2B and J chain useful in NLPHL?"
 * routed (reasonably) to PathologyOutlines, whose NLPHL chunks never mention
 * either marker — while WHO and PubMed both answered it outright. Searching is
 * free (no tokens) and runs in parallel, so every question now searches all
 * three; this module decides which pages the one answer call sees. Pure, so
 * the ranking is unit-testable.
 */

import type { AskSource } from "./router";
import { questionTerms } from "./router";

export interface SourcedHit {
  source: AskSource;
  title: string;
  href: string;
  body: string;
}

export interface Page {
  source: AskSource;
  title: string;
  href: string;
  /** Every chunk PathTalk returned for this page, joined. */
  body: string;
  /** Position of the page's first chunk in its source's results (0 = top hit). */
  rank: number;
}

/**
 * One page per href. PathTalk often returns the same page as several chunks
 * (three NLPHL chunks from one PathologyOutlines page); dropping the repeats
 * threw away two thirds of the text, so they are concatenated instead.
 */
export function mergeByHref(hits: SourcedHit[]): Page[] {
  const pages = new Map<string, Page>();
  const seenPerSource = new Map<AskSource, number>();
  for (const h of hits) {
    const existing = pages.get(h.href);
    if (existing) {
      existing.body += ` … ${h.body}`;
      continue;
    }
    const rank = seenPerSource.get(h.source) ?? 0;
    seenPerSource.set(h.source, rank + 1);
    pages.set(h.href, { source: h.source, title: h.title, href: h.href, body: h.body, rank });
  }
  return [...pages.values()];
}

/**
 * Words that say what kind of answer is wanted, not what it is about. They
 * appear in nearly every pathology passage, so they would let a page that
 * never mentions MEF2B outrank one that does.
 */
const GENERIC = new Set(
  (
    "useful use usefulness role diagnosis diagnostic diagnose stain stains staining ihc " +
    "immunohistochemistry immunohistochemical marker markers expression expressed features " +
    "feature distinguish distinguishing differentiate differential help helpful value " +
    "utility significance common typical typically tumor tumour cells cell positive negative"
  ).split(" ")
);

/** The question's subject terms (what a passage must mention to be about it). */
export function keyTerms(question: string): string[] {
  return questionTerms(question).filter((t) => !GENERIC.has(t));
}

function mentions(body: string, term: string): boolean {
  // Prefix match on word starts: "mef2b" hits "MEF2B", "chromophob" hits "chromophobe".
  return new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(body);
}

/**
 * Score = sum over key terms the page mentions, each weighted by rarity
 * (1 / pages mentioning it): "nlphl" is on every page and barely counts, "mef2b"
 * on two of seven counts a lot. The router's pick and a source's own top hit
 * only break ties, so routing is a preference, not a gate.
 */
export function rankPages(pages: Page[], question: string, preferred: AskSource): Page[] {
  const terms = keyTerms(question);
  const lower = pages.map((p) => `${p.title} ${p.body}`.toLowerCase());
  const df = new Map(terms.map((t) => [t, lower.filter((b) => mentions(b, t)).length]));
  const score = (i: number) =>
    terms.reduce((s, t) => (mentions(lower[i], t) ? s + 1 / (df.get(t) || 1) : s), 0) +
    (pages[i].source === preferred ? 0.25 : 0) -
    pages[i].rank * 0.05;
  return pages
    .map((p, i) => ({ p, s: score(i) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
}
