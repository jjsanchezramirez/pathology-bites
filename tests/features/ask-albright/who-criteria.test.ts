import { describe, it, expect } from "vitest";
import {
  criteriaAnswer,
  parseWhoCriteria,
  pickCriteriaPage,
} from "@/features/user/ask-albright/lib/who-criteria";

// The CHL passage as PathTalk returns it (WHO Haematolymphoid, 5th ed.).
const CHL =
  "diagnostic criteria Essential: primary nodal or mediastinal presentation; HRS cells and variants in a reactive microenvironment composed of varying proportions of small lymphocytes, eosinophils, histiocytes, plasma cells, and neutrophils; immunophenotype of HRS cells: CD30+, PAX5+ (weak to moderate), CD20−/weak/heterogeneous. Desirable: immunophenotype of HRS cells: CD15+, CD45−, decreased expression of OCT2 and BOB1; EBV positivity (~40% of cases); histological subtyping (if possible); exclusion of mimics of CHL by appropriate workup. Staging The principles of staging and risk stratification in CHL have evolved";

describe("parseWhoCriteria", () => {
  it("reads both groups in WHO's own words and stops at the next section", () => {
    const c = parseWhoCriteria(CHL)!;
    expect(c.essential).toEqual([
      "Primary nodal or mediastinal presentation",
      "HRS cells and variants in a reactive microenvironment composed of varying proportions of small lymphocytes, eosinophils, histiocytes, plasma cells, and neutrophils",
      "Immunophenotype of HRS cells: CD30+, PAX5+ (weak to moderate), CD20−/weak/heterogeneous",
    ]);
    expect(c.desirable).toHaveLength(4);
    expect(c.desirable[3]).toBe("Exclusion of mimics of CHL by appropriate workup");
  });

  it("does not split inside parentheses", () => {
    const c = parseWhoCriteria("Essential: CD20+ (strong; diffuse); CD10+. Desirable: MYC.")!;
    expect(c.essential).toEqual(["CD20+ (strong; diffuse)", "CD10+"]);
    expect(parseWhoCriteria("Essential: Ki-67 according to #20865Table 11.06.")!.essential).toEqual(
      ["Ki-67 according to Table 11.06"]
    );
  });

  it("returns null for a heading that only points to a box", () => {
    expect(
      parseWhoCriteria(
        "Essential and desirable diagnostic criteria See Box 2.19. Staging Not relevant"
      )
    ).toBeNull();
  });

  it("formats both groups as cited bullets", () => {
    const text = criteriaAnswer({ essential: ["A"], desirable: ["B", "C"] }, 1);
    expect(text).toBe("**Essential:**\n- A [1]\n\n**Desirable:**\n- B [1]\n- C [1]");
    expect(criteriaAnswer({ essential: ["A"], desirable: [] }, 2)).toBe("**Essential:**\n- A [2]");
  });
});

describe("pickCriteriaPage", () => {
  const page = (title: string, body = CHL) => ({ title, body });

  it("prefers the general page over a variant the question doesn't name", () => {
    const pages = [
      page("Classic Hodgkin lymphoma of the mediastinum"),
      page("Classic Hodgkin lymphoma"),
    ];
    expect(pickCriteriaPage(pages, "WHO diagnostic criteria for CHL")!.page.title).toBe(
      "Classic Hodgkin lymphoma"
    );
    expect(
      pickCriteriaPage(pages, "criteria for classic Hodgkin lymphoma of the mediastinum")!.page
        .title
    ).toBe("Classic Hodgkin lymphoma of the mediastinum");
  });

  it("skips pages without criteria", () => {
    expect(pickCriteriaPage([page("CMML", "See Box 2.19")], "CMML criteria")).toBeNull();
  });
});
