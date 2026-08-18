/**
 * The parts that no longer depend on a model getting a format right.
 *
 * Immunophenotype options have a fixed shape — five over one marker set, one
 * order, differing only in the signs — and asking prose for that shape was the
 * most-violated instruction we measured (11 of 16 questions broke it, and a
 * broken one is answerable without the slide). Built here, the failure is
 * impossible rather than merely detectable.
 */
import { describe, it, expect } from "vitest";

import {
  buildImmunoOptions,
  hasUsableMolecularProfile,
  parseImmunoProfile,
  sanitizeHistory,
} from "@/features/user/wsi-questions/utils/wsi-question-options";

const markerSet = (option: string) =>
  option
    .split(",")
    .map((p) => p.trim().replace(/[+-]$/, ""))
    .join("|");

describe("parseImmunoProfile", () => {
  it("reads signs, including the Unicode minus WHO text uses", () => {
    expect(parseImmunoProfile("CD20+, CD10-, BCL2−")).toEqual([
      { marker: "CD20", positive: true },
      { marker: "CD10", positive: false },
      { marker: "BCL2", positive: false },
    ]);
  });

  it("skips fragments that carry no sign, and duplicates", () => {
    expect(parseImmunoProfile("CD20+, notamarker, CD20-, CD5+").map((c) => c.marker)).toEqual([
      "CD20",
      "CD5",
    ]);
  });
});

describe("buildImmunoOptions", () => {
  const profile = "CD20+, CD10+, BCL2+, BCL6+, CD5-";

  it("builds five options over ONE marker set in ONE order", () => {
    const built = buildImmunoOptions(profile)!;
    expect(built.options).toHaveLength(5);
    const sets = new Set(built.options.map(markerSet));
    expect(sets.size).toBe(1);
    expect([...sets][0]).toBe("CD20|CD10|BCL2|BCL6|CD5");
  });

  it("puts the true phenotype first and keeps every option distinct", () => {
    const built = buildImmunoOptions(profile)!;
    expect(built.correct).toBe(profile);
    expect(built.options[0]).toBe(profile);
    expect(new Set(built.options).size).toBe(5);
  });

  it("cannot be solved by majority vote over the options", () => {
    // The defect this design exists to prevent. One-flip distractors leave the
    // true sign in the majority of every column, so taking the commonest sign
    // per marker reconstructs the answer without opening the slide — it was
    // solvable for 117 of 117 option sets in the live corpus.
    const built = buildImmunoOptions(profile)!;
    const signs = (o: string) => o.split(",").map((p) => p.trim().slice(-1));
    const columns = signs(built.correct).length;

    const majority = Array.from({ length: columns }, (_, i) => {
      const counts = new Map<string, number>();
      for (const option of built.options) {
        const sign = signs(option)[i];
        counts.set(sign, (counts.get(sign) ?? 0) + 1);
      }
      return [...counts].sort((a, b) => b[1] - a[1])[0][0];
    });
    const markers = built.correct.split(",").map((p) => p.trim().slice(0, -1));
    expect(markers.map((m, i) => m + majority[i]).join(", ")).not.toBe(built.correct);
  });

  it("keeps distractors close enough to be plausible phenotypes", () => {
    const built = buildImmunoOptions(profile)!;
    const signs = (o: string) => o.split(",").map((p) => p.trim().slice(-1));
    const truth = signs(built.correct);
    for (const option of built.options.slice(1)) {
      const differences = signs(option).filter((s, i) => s !== truth[i]).length;
      expect(differences).toBeGreaterThanOrEqual(1);
      // A competing entity differs in a few markers, not in all of them.
      expect(differences).toBeLessThanOrEqual(3);
    }
  });

  it("is deterministic", () => {
    expect(buildImmunoOptions(profile)).toEqual(buildImmunoOptions(profile));
  });

  it("refuses a profile too thin to make a fair question", () => {
    expect(buildImmunoOptions("CD20+, CD5-")).toBeNull();
    // All one polarity: the flips would be the only thing distinguishing options,
    // and no marker discriminates.
    expect(buildImmunoOptions("CD20+, CD10+, BCL2+, BCL6+")).toBeNull();
  });
});

describe("sanitizeHistory", () => {
  it("drops microscopy that sources write into the history field", () => {
    const history =
      "Tonsil (H&E). Partial involvement by the lymphoma with follicular and diffuse architecture.";
    expect(sanitizeHistory(history, "Large B-cell lymphoma with IRF4 rearrangement")).toBe("");
  });

  it("keeps genuine clinical history", () => {
    const history = "Generalised lymphadenopathy. Pancytopenia with blast cells.";
    expect(sanitizeHistory(history, "ALK-negative anaplastic large cell lymphoma")).toBe(history);
  });

  it("drops a sentence that names the entity", () => {
    const history = "Fatigue for three months. Known chronic myeloid leukaemia in blast phase.";
    expect(sanitizeHistory(history, "Chronic myeloid leukaemia")).toBe("Fatigue for three months.");
  });
});

describe("hasUsableMolecularProfile", () => {
  it("rejects text whose point is that there is nothing to find", () => {
    // These are real corpus values that passed the old length-only gate and were
    // handed to the writer as "the correct alteration".
    expect(hasUsableMolecularProfile("No specific or diagnostic molecular abnormaility")).toBe(
      false
    );
    expect(
      hasUsableMolecularProfile("Central neurocytoma: No recurrent molecular alterations")
    ).toBe(false);
    expect(
      hasUsableMolecularProfile("* Lack a MED12 mutation (seen in fibroepithelial lesions)")
    ).toBe(false);
  });

  it("rejects a method with no alteration named", () => {
    expect(hasUsableMolecularProfile("PCR testing can be utilized for identification")).toBe(false);
  });

  it("accepts alterations however they are written", () => {
    for (const text of [
      "t(8;21)(q22;q22); RUNX1::RUNX1T1 (defining)",
      "biallelic TP53 alterations (characteristic)",
      "JAK2 p.V617F",
      "FISH: 13q14 deletions",
      "10% have mutations in Jagged1 gene",
      "Majority show chromosome 18 deletions",
      "trisomy 8",
    ]) {
      expect(hasUsableMolecularProfile(text)).toBe(true);
    }
  });
});
