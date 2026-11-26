import { describe, expect, it } from "vitest";
import {
  REVIEW,
  SCORING_GUIDE,
  matchScoring,
  scoringCitations,
  scoringFollowUps,
} from "@/features/user/ask-albright/lib/scoring-guide";

describe("matchScoring — scoring questions find their entry", () => {
  it.each([
    ["How is HER2 IHC scored in breast cancer?", "her2-breast"],
    ["What does HER2 2+ mean?", "her2-breast"],
    ["HER2 scoring criteria", "her2-breast"],
    ["What is HER2-low?", "her2-low"],
    ["HER2 0 vs 1+ for trastuzumab deruxtecan scoring", "her2-low"],
    ["How is HER2 scored in gastric cancer?", "her2-gastric"],
    ["HER2 scoring in GEJ biopsies", "her2-gastric"],
    ["What is the difference between PD-L1 TPS and CPS?", "pdl1-scores"],
    ["How is PD-L1 CPS calculated?", "pdl1-scores"],
    ["PD-L1 22C3 cutoffs by tumor type", "pdl1-cutoffs"],
    ["What PD-L1 cut-off is used in NSCLC?", "pdl1-cutoffs"],
    ["SP142 scoring in TNBC", "pdl1-cutoffs"],
  ])("%j → %s", (q, id) => expect(matchScoring(q)?.id).toBe(id));
});

describe("matchScoring — other HER2 / PD-L1 questions go to the normal answer", () => {
  it.each([
    "Is HER2 positive in Paget disease?",
    "What percentage of gastric cancers are HER2 amplified?",
    "Is PD-L1 expressed in follicular dendritic cell sarcoma?",
    "What is CD30 positive in?",
    "Which stains separate chromophobe RCC from oncocytoma?",
  ])("%j", (q) => expect(matchScoring(q)).toBeNull());
});

describe("scoring content", () => {
  it("cites only sources it lists, links only https, and resolves follow-ups", () => {
    for (const e of SCORING_GUIDE) {
      const cited = [...e.answer.matchAll(/\[(\d+(?:,\s*\d+)*)\]/g)].flatMap((m) =>
        m[1].split(/,\s*/).map(Number)
      );
      expect(cited.length, e.id).toBeGreaterThan(0);
      for (const n of cited)
        expect(n, `${e.id} cites [${n}]`).toBeLessThanOrEqual(e.sources.length);
      // every listed source is cited at least once
      for (let n = 1; n <= e.sources.length; n++)
        expect(cited, `${e.id} never cites [${n}]`).toContain(n);
      for (const s of e.sources) expect(s.href).toMatch(/^https:\/\//);
      expect(scoringCitations(e)).toHaveLength(e.sources.length);
      expect(scoringFollowUps(e).length).toBe(e.related.length);
      expect(matchScoring(e.ask)?.id, e.ask).toBe(e.id);
    }
  });

  it("keeps the unverified facts on the review list", () => {
    expect(REVIEW.length).toBeGreaterThan(0);
    const table = SCORING_GUIDE.find((e) => e.id === "pdl1-cutoffs")!.answer;
    expect(table).toContain("†");
  });
});
