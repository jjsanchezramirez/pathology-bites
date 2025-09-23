// src/shared/utils/__tests__/citation-formatters.test.ts
import { normalizeText } from "../citation-formatters";

// Focus on testing the normalization function directly
// Journal abbreviation matching will be tested separately when we have a proper test database

// Test the normalization function directly

describe("Text Normalization Function", () => {
  test("should normalize various diacritics correctly", () => {
    const testCases = [
      { input: "Biología", expected: "biologia" },
      { input: "Médico", expected: "medico" },
      { input: "Niño", expected: "nino" },
      { input: "Corazón", expected: "corazon" },
      { input: "Investigación", expected: "investigacion" },
      { input: "Müller", expected: "muller" },
      { input: "Østerberg", expected: "osterberg" },
      { input: "François", expected: "francois" },
      { input: "José María", expected: "jose maria" },
    ];

    testCases.forEach(({ input, expected }) => {
      expect(normalizeText(input)).toBe(expected);
    });
  });

  test("should handle special characters and punctuation", () => {
    const testCases = [
      { input: "Journal of A&B", expected: "journal of ab" },
      { input: "Review: Part I", expected: "review part i" },
      { input: "Medicine (London)", expected: "medicine london" },
      { input: "β-Blockers Study", expected: "blockers study" },
      { input: "Multi-center Analysis", expected: "multicenter analysis" },
    ];

    testCases.forEach(({ input, expected }) => {
      expect(normalizeText(input)).toBe(expected);
    });
  });

  test("should handle mixed case and multiple spaces", () => {
    expect(normalizeText("  BIOLOGÍA    Molecular  ")).toBe(
      "biologia molecular",
    );
    expect(normalizeText("The   New England Journal")).toBe(
      "the new england journal",
    );
  });
});
