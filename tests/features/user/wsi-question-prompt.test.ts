/**
 * The prompt must state what the slide physically is.
 *
 * Given only a site and a diagnosis, the writer invents a plausible procedure to
 * open the stem with — and over a Sezary syndrome peripheral blood smear it wrote
 * "a skin punch biopsy is performed", telling the reader to look for something
 * that is not on the slide. The specimen line, and the rule that the stem may not
 * contradict it, are what prevent that.
 */
import { describe, it, expect } from "vitest";

import { buildWsiQuestionPrompt } from "@/features/user/wsi-questions/utils/wsi-question-kinds";
import type { VirtualSlide } from "@/shared/types/virtual-slides";

const slide = (over: Record<string, unknown> = {}) =>
  ({
    id: "hemepath_1",
    diagnosis: "Sezary syndrome",
    category: "Hematopathology",
    subcategory: "Blood",
    stain_type: "Giemsa",
    source_metadata: { specimen: "peripheral blood smear" },
    ...over,
  }) as unknown as VirtualSlide;

describe("buildWsiQuestionPrompt — specimen", () => {
  it("states the specimen and its stain", () => {
    const prompt = buildWsiQuestionPrompt(slide(), "diagnosis");
    expect(prompt).toContain("Specimen shown: peripheral blood smear, stained Giemsa");
  });

  it("forbids contradicting the specimen or inventing one", () => {
    const prompt = buildWsiQuestionPrompt(slide(), "diagnosis");
    expect(prompt).toMatch(/Contradict the specimen, or name one when none is stated/i);
  });

  it("falls back to the site when no specimen is recorded", () => {
    const prompt = buildWsiQuestionPrompt(
      slide({ source_metadata: {}, subcategory: "Breast", stain_type: "" }),
      "diagnosis"
    );
    // PathPresenter cases record no specimen; the site is all that can honestly
    // be said, and the rules tell the writer not to invent beyond it.
    expect(prompt).toContain("Specimen shown: Breast specimen");
    expect(prompt).not.toContain("stained");
  });

  it("never states a site for a curated case, whose site field is unreliable", () => {
    // A Leeds ALK-negative ALCL with the history "generalised lymphadenopathy" is
    // filed under Bone Marrow, and the stem duly opened "a bone-marrow core is
    // examined" over a lymph node. PathPresenter's organ comes from the case's own
    // chapter and stays.
    const curated = buildWsiQuestionPrompt(
      slide({
        repository: "Leeds University",
        subcategory: "Bone Marrow",
        source_metadata: {},
        diagnosis: "ALK-negative anaplastic large cell lymphoma",
      }),
      "diagnosis"
    );
    expect(curated).not.toContain("Bone Marrow");
    // It still says what is on screen — just not the unreliable site. A writer
    // given nothing to call the slide narrates it instead.
    expect(curated).toMatch(/Specimen shown: a .*-stained slide/);

    const pathpresenter = buildWsiQuestionPrompt(
      slide({ repository: "PathPresenter", subcategory: "Breast", source_metadata: {} }),
      "diagnosis"
    );
    expect(pathpresenter).toContain("Organ: Breast");
  });

  it("still states a curated case's specimen when the case records one", () => {
    const prompt = buildWsiQuestionPrompt(
      slide({
        repository: "Leeds University",
        subcategory: "Bone Marrow",
        stain_type: "Giemsa",
        source_metadata: { specimen: "peripheral blood smear" },
      }),
      "diagnosis"
    );
    expect(prompt).toContain("Specimen shown: peripheral blood smear, stained Giemsa");
    expect(prompt).not.toContain("Organ: Bone Marrow");
  });

  it("names no procedure when none is known, but still anchors the slide", () => {
    // Naming nothing is right — a Leeds hepatosplenic T-cell lymphoma filed under
    // site "Bone Marrow" put a trephine core in a stem over a slide that is not
    // marrow. But saying NOTHING is what made the model narrate instead, to
    // establish what it was looking at: haem cases failed the narration check
    // three times as often as PathPresenter ones.
    const prompt = buildWsiQuestionPrompt(
      slide({ source_metadata: {}, subcategory: "", stain_type: "" }),
      "diagnosis"
    );
    expect(prompt).toMatch(/Specimen shown: not recorded/);
    expect(prompt).toMatch(/refer to it only as "the slide"/);
    expect(prompt).toMatch(/name one when none is stated/i);
  });

  it("carries the specimen into IHC and molecular prompts too", () => {
    for (const kind of ["ihc", "molecular"] as const) {
      const prompt = buildWsiQuestionPrompt(
        slide({
          source_metadata: {
            specimen: "bone marrow aspirate smear",
            immuno_profile: "CD3+, CD4+, CD7-",
            molecular_profile: "TCR clonal rearrangement",
          },
        }),
        kind
      );
      expect(prompt).toContain("Specimen shown: bone marrow aspirate smear");
    }
  });
});
