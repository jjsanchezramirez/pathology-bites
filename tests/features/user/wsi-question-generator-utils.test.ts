/**
 * Unit tests for the pure helpers extracted from wsi-question-generator.tsx.
 */
import { describe, it, expect } from "vitest";
import {
  getRepositoryFromId,
  ensureWSIRepository,
  getOptionLabel,
  formatTokenUsage,
  extractCategories,
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
