/**
 * Unit tests for the pure helpers extracted from wsi-question-generator.tsx.
 */
import { describe, it, expect } from "vitest";
import {
  categoriesWithoutKinds,
  getRepositoryFromId,
  ensureWSIRepository,
  getOptionLabel,
  formatTokenUsage,
  extractCategories,
  slideMatchesCategory,
} from "@/features/user/wsi-questions/components/wsi-question-generator-utils";
import type { VirtualSlide } from "@/shared/types/virtual-slides";

describe("getRepositoryFromId", () => {
  it("maps known id prefixes to repository names", () => {
    expect(getRepositoryFromId("mgh_123")).toBe("MGH Pathology");
    expect(getRepositoryFromId("hemepath_9")).toBe("Hematopathology eTutorial");
    expect(getRepositoryFromId("rosai_4")).toBe("Rosai Collection");
  });

  it("falls back to the raw prefix for unknown repositories", () => {
    expect(getRepositoryFromId("unknown_42")).toBe("unknown");
  });
});

describe("ensureWSIRepository", () => {
  it("fills repository from the id when missing", () => {
    const wsi = { id: "mgh_1" } as VirtualSlide;
    expect(ensureWSIRepository(wsi).repository).toBe("MGH Pathology");
  });

  it("leaves an existing repository untouched", () => {
    const wsi = { id: "mgh_1", repository: "Custom" } as VirtualSlide;
    expect(ensureWSIRepository(wsi).repository).toBe("Custom");
  });
});

describe("getOptionLabel", () => {
  it("uses the explicit id when present", () => {
    expect(getOptionLabel("A", 0)).toBe("A");
  });

  it("falls back to a letter by index", () => {
    expect(getOptionLabel("", 0)).toBe("A");
    expect(getOptionLabel("", 2)).toBe("C");
  });
});

describe("formatTokenUsage", () => {
  it("formats a numeric total with thousands separators", () => {
    expect(formatTokenUsage({ total_tokens: 1234 })).toBe("1,234 tokens");
  });

  it("returns N/A when total is missing or non-numeric", () => {
    expect(formatTokenUsage(null)).toBe("Tokens: N/A");
    expect(formatTokenUsage({})).toBe("Tokens: N/A");
  });
});

describe("extractCategories", () => {
  it("returns unique, non-empty, sorted categories", () => {
    expect(
      extractCategories([
        { category: "Renal" },
        { category: "Bone" },
        { category: "Renal" },
        { category: "" },
        { category: null },
      ])
    ).toEqual(["Bone", "Renal"]);
  });
});

describe("slideMatchesCategory", () => {
  // The real chapter names from the PathPresenter case set behind the generator.
  const CATEGORIES = [
    "Bone and soft tissue pathology",
    "Breast pathology",
    "Cardiovascular pathology",
    "Endocrine pathology",
    "Gastrointestinal pathology",
    "Gynecologic pathology",
    "Head and neck pathology",
    "Liver pathology",
    "Male genital pathology",
    "Neuropathology",
    "Pancreatobiliary pathology",
    "Pediatric pathology",
    "Pulmonary pathology",
    "Skin pathology",
    "Uropathology",
  ];

  it("does not let Uropathology pull in Neuropathology", () => {
    // "uropathology" is a literal substring of "neuropathology" (n-e-u-r-o-…).
    // Substring matching returned 88 candidates for Uropathology — 47 of them
    // neuropath — so the user got the category they asked for 47% of the time.
    expect(slideMatchesCategory("Neuropathology", "Uropathology")).toBe(false);
    expect(slideMatchesCategory("Uropathology", "Uropathology")).toBe(true);
    expect(slideMatchesCategory("Uropathology", "Neuropathology")).toBe(false);
  });

  it("matches every real category to itself and to nothing else", () => {
    for (const selected of CATEGORIES) {
      const matched = CATEGORIES.filter((c) => slideMatchesCategory(c, selected));
      expect(matched).toEqual([selected]);
    }
  });

  it("ignores case and surrounding whitespace", () => {
    expect(slideMatchesCategory("  Uropathology  ", "uropathology")).toBe(true);
    expect(slideMatchesCategory("SKIN PATHOLOGY", "Skin pathology")).toBe(true);
  });

  it("treats a missing category as no match rather than throwing", () => {
    expect(slideMatchesCategory(null, "Uropathology")).toBe(false);
    expect(slideMatchesCategory(undefined, "Uropathology")).toBe(false);
    expect(slideMatchesCategory("", "Uropathology")).toBe(false);
  });
});

describe("categoriesWithoutKinds", () => {
  const slide = (over: Record<string, unknown>) =>
    ({
      tileSourceUrl: "https://example.org/a.dzi",
      source_metadata: {},
      ...over,
    }) as unknown as Parameters<typeof categoriesWithoutKinds>[0][number];

  const renderable = () => true;

  const CORPUS = [
    // Curated haematolymphoid: morphology only, no recorded profiles.
    slide({ category: "Hematopathology", diagnosis: "Follicular lymphoma" }),
    // PathPresenter: carries the author's own immuno and molecular notes.
    slide({
      category: "Breast pathology",
      diagnosis: "Invasive ductal carcinoma",
      source_metadata: {
        immuno_profile: "ER+, PR+, HER2-, GATA3+",
        molecular_profile: "PIK3CA H1047R mutation",
      },
    }),
  ];

  it("flags a category that cannot carry the enabled types", () => {
    // Asking for IHC empties Hematopathology before the category is applied —
    // which the picker should show rather than let the reader discover.
    expect(categoriesWithoutKinds(CORPUS, ["ihc"], renderable)).toEqual(["Hematopathology"]);
    expect(categoriesWithoutKinds(CORPUS, ["molecular"], renderable)).toEqual(["Hematopathology"]);
  });

  it("flags nothing when diagnosis is enabled, since every slide supports it", () => {
    expect(categoriesWithoutKinds(CORPUS, ["diagnosis"], renderable)).toEqual([]);
    expect(categoriesWithoutKinds(CORPUS, ["diagnosis", "ihc"], renderable)).toEqual([]);
  });

  it("ignores slides the viewer cannot render, which are never in the pool anyway", () => {
    const unrenderable = () => false;
    expect(categoriesWithoutKinds(CORPUS, ["ihc"], unrenderable)).toEqual([]);
  });
});
