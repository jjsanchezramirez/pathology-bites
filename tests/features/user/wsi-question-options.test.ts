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
  candidateAlterations,
  hasUsableMolecularProfile,
  leadingAlteration,
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

describe("profiles from the reconciled matrix", () => {
  it("builds options from a corrected phenotype", () => {
    // Rosai-Dorfman reached live questions keyed S100-NEGATIVE, from a v1 matrix
    // call the reconciliation corrected. The profile below is what the rebuilt
    // corpus now carries; the builder has to make a fair question from it.
    const built = buildImmunoOptions("S100+, OCT2+, CD11C+, fascin+, CD1A-, CD207-")!;
    expect(built.correct).toContain("S100+");
    expect(built.correct).not.toContain("S100-");
    expect(built.options).toHaveLength(5);
    expect(new Set(built.options).size).toBe(5);
  });
});

describe("leadingAlteration", () => {
  it("keeps a karyotype whole", () => {
    // Splitting on ";" cut nomenclature in half — "Fusions: YWHAE-NUTM2A/B
    // fusions (t(10;17)(q22;p13))" became "...(t(10", and broken nomenclature
    // offered as distractor material teaches the writer to emit more of it.
    expect(leadingAlteration("Fusions: YWHAE-NUTM2A/B fusions (t(10;17)(q22;p13)); others")).toBe(
      "Fusions: YWHAE-NUTM2A/B fusions (t(10;17)(q22;p13))"
    );
  });

  it("keeps a karyotype and its fusion together", () => {
    // Standard nomenclature separates them with the same semicolon.
    expect(leadingAlteration("t(8;21)(q22;q22); RUNX1::RUNX1T1 (defining); more")).toBe(
      "t(8;21)(q22;q22); RUNX1::RUNX1T1"
    );
  });

  it("drops a significance annotation but never real nomenclature", () => {
    expect(leadingAlteration("ETV6::NTRK3 fusion (defining)")).toBe("ETV6::NTRK3 fusion");
    expect(leadingAlteration("MYC amplification (seen in 60% of cases)")).toBe("MYC amplification");
    // The trailing bracket here IS the alteration.
    expect(leadingAlteration("t(10;17)(q22;p13)")).toBe("t(10;17)(q22;p13)");
  });

  it("strips corpus bullets and method prefixes", () => {
    expect(leadingAlteration("* Often has loss of 16q")).toBe("Often has loss of 16q");
    expect(leadingAlteration("FISH: 13q14 deletions")).toBe("13q14 deletions");
  });
});

describe("candidateAlterations", () => {
  const pool = [
    {
      category: "Breast pathology",
      diagnosis: "Secretory carcinoma",
      source_metadata: { molecular_profile: "ETV6::NTRK3 fusion (defining)" },
    },
    {
      category: "Breast pathology",
      diagnosis: "Atypical vascular lesion",
      source_metadata: { molecular_profile: "No MYC overexpression/amplification" },
    },
    {
      category: "Breast pathology",
      diagnosis: "Radial scar",
      source_metadata: { molecular_profile: "Approximately 2/3 rd will have a PIK3CA mutation" },
    },
    {
      category: "Breast pathology",
      diagnosis: "Graves-like",
      source_metadata: { molecular_profile: "Polymorphisms in HLA-DR3 and CTLA-4 gene." },
    },
    {
      category: "Hematopathology",
      diagnosis: "AML",
      source_metadata: { molecular_profile: "t(8;21)(q22;q22); RUNX1::RUNX1T1" },
    },
  ];

  it("offers only same-chapter alterations, attributed to their entity", () => {
    const out = candidateAlterations(pool, {
      category: "Breast pathology",
      diagnosis: "Mucinous carcinoma",
    });
    expect(out).toContain("ETV6::NTRK3 fusion (Secretory carcinoma)");
    // A breast question offering a leukaemia translocation marks the on-topic
    // option as the answer.
    expect(out.join(" ")).not.toContain("RUNX1");
  });

  it("refuses negations, prose and associations", () => {
    const out = candidateAlterations(pool, {
      category: "Breast pathology",
      diagnosis: "Mucinous carcinoma",
    }).join(" ");
    expect(out).not.toMatch(/No MYC/i);
    expect(out).not.toMatch(/Approximately/i);
    expect(out).not.toMatch(/Polymorphisms/i);
  });

  it("never offers the case's own alteration", () => {
    const out = candidateAlterations(pool, {
      category: "Breast pathology",
      diagnosis: "Secretory carcinoma",
    });
    expect(out.join(" ")).not.toContain("ETV6::NTRK3");
  });
});

describe("buildImmunoOptions — scarce positives", () => {
  it("uses the negatives it has when only one marker is positive", () => {
    // WHO-derived profiles often define an entity by a single positive against
    // several excluded markers. The composition step used to take at most one
    // negative, so this four-call profile produced a two-marker set and was
    // discarded — 20+ real corpus cases lost to arithmetic, not to data.
    const built = buildImmunoOptions("ERG+, SMA-, Thyroglobulin-, TTF-1-");
    expect(built).not.toBeNull();
    expect(built!.options).toHaveLength(5);
    expect(built!.correct).toContain("ERG+");
    expect(built!.correct).toContain("SMA-");
  });

  it("still prefers positives when both polarities are plentiful", () => {
    const built = buildImmunoOptions("A+, B+, C+, D+, E+, F+, X-, Y-, Z-");
    expect(built).not.toBeNull();
    const plus = (built!.correct.match(/\+/g) || []).length;
    const minus = (built!.correct.match(/-/g) || []).length;
    expect(plus).toBe(4);
    expect(minus).toBe(1);
  });
});
