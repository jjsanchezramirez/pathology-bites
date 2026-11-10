// Repository tie-break in rankSlidesWithExpansion (REPOSITORY_RANK_PRIORITY).
//
// Kept apart from virtual-slide-search.test.ts because the search index is module-global:
// building this fixture there would replace that file's index.
//
// The rule under test: among equally relevant slides, ones the in-house viewer can open
// lead, and WHO Blue Books (subscription-walled since Nov 2026) trails with the other
// link-out repositories. WHO used to lead every tie.

import { describe, it, expect, beforeAll } from "vitest";
import {
  buildSearchIndex,
  rankSlidesWithExpansion,
} from "@/shared/utils/domain/virtual-slide-search";
import type { VirtualSlide } from "@/shared/types/virtual-slides";

function mk(id: string, repository: string): VirtualSlide {
  return {
    id,
    repository,
    category: "Hematopathology",
    subcategory: "Lymph Node",
    diagnosis: "Follicular lymphoma",
    patient_info: "",
    age: null,
    gender: null,
    clinical_history: "",
    stain_type: "",
    preview_image_url: "",
    slide_url: "",
    case_url: "",
    other_urls: [],
    source_metadata: {},
  };
}

// WHO first in input order, so a pass cannot come from input order alone.
const FIXTURE: VirtualSlide[] = [
  mk("who_1_2_3", "WHO Blue Books Online"),
  mk("pathpresenter_1", "PathPresenter"),
  mk("rosai_1", "Rosai Collection"),
  mk("mgh_1", "MGH Pathology"),
  mk("leeds_1", "Leeds University"),
];

describe("repository tie-break", () => {
  beforeAll(() => buildSearchIndex(FIXTURE));

  it("ranks in-house-viewable repositories ahead of WHO on an exact tie", async () => {
    const { slides, scoredSlides } = await rankSlidesWithExpansion(FIXTURE, "follicular lymphoma");
    // Guard: the fixture really is a tie, so only the repository decides the order.
    expect(new Set(scoredSlides?.map((s) => s.score)).size).toBe(1);

    const order = slides.map((s) => s.repository);
    expect(order.slice(0, 3)).toEqual(["Leeds University", "MGH Pathology", "Rosai Collection"]);
    expect(order[0]).not.toBe("WHO Blue Books Online");
    expect(order.indexOf("WHO Blue Books Online")).toBeGreaterThan(
      order.indexOf("Rosai Collection")
    );
  });
});
