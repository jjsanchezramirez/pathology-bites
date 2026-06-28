/**
 * Unit tests for the pure helpers extracted from fake-selection-highlight.tsx.
 */
import { describe, it, expect, vi } from "vitest";

// pickViewableSlide depends on which repositories our viewer can render.
vi.mock("@/shared/utils/domain/repository", () => ({
  isViewerSupported: (repo?: string) => repo === "WHO Blue Books Online" || repo === "MGH",
}));

import {
  queryTokens,
  isWhoAcronymMatch,
  buildGoogleImagesUrl,
  buildVirtualSlidesUrl,
  pickViewableSlide,
  type TopMatch,
} from "@/shared/components/common/fake-selection-highlight-utils";
import type { VirtualSlide } from "@/shared/types/virtual-slides";

function slide(p: Partial<VirtualSlide>): VirtualSlide {
  return { repository: "PathPresenter", ...p } as VirtualSlide;
}

describe("queryTokens", () => {
  it("lowercases, splits on -// and non-alphanumerics", () => {
    expect(queryTokens("Chronic Hepatitis-B/C")).toEqual(["chronic", "hepatitis", "b", "c"]);
    expect(queryTokens("")).toEqual([]);
  });
});

describe("isWhoAcronymMatch", () => {
  it("matches a query token against the slide's acronym(s)", () => {
    expect(isWhoAcronymMatch(slide({ acronym: "RCC" }), "renal rcc carcinoma")).toBe(true);
    expect(isWhoAcronymMatch(slide({ acronym: ["AML", "APL"] }), "apl variant")).toBe(true);
    expect(isWhoAcronymMatch(slide({ acronym: "RCC" }), "hepatocellular")).toBe(false);
    expect(isWhoAcronymMatch(slide({ acronym: undefined }), "rcc")).toBe(false);
  });
});

describe("URL builders", () => {
  it("buildGoogleImagesUrl appends the pathology suffix and encodes", () => {
    expect(buildGoogleImagesUrl("renal cell")).toBe(
      "https://www.google.com/search?tbm=isch&q=renal%20cell%20pathology"
    );
  });

  it("buildVirtualSlidesUrl points at the search page", () => {
    expect(buildVirtualSlidesUrl("renal cell")).toBe(
      "/tools/virtual-slides?search=renal%20cell"
    );
  });
});

describe("pickViewableSlide", () => {
  const tm: TopMatch = { slide: slide({}), score: 90, isWho: false };

  it("returns null with no match or no slides", () => {
    expect(pickViewableSlide(null, [])).toBeNull();
    expect(pickViewableSlide(tm, [])).toBeNull();
  });

  it("returns the #1 match when our viewer can render it", () => {
    const slides = [slide({ id: "a", repository: "MGH" }), slide({ id: "b", repository: "WHO Blue Books Online" })];
    expect(pickViewableSlide(tm, slides)?.id).toBe("a");
  });

  it("prefers a WHO slide over an earlier non-WHO renderable when the top match is not renderable", () => {
    // mgh is renderable and comes first, but WHO is preferred → must return "who", not "mgh"
    const slides = [
      slide({ id: "pp", repository: "PathPresenter" }),
      slide({ id: "mgh", repository: "MGH" }),
      slide({ id: "who", repository: "WHO Blue Books Online" }),
    ];
    expect(pickViewableSlide(tm, slides)?.id).toBe("who");
  });

  it("falls back to the first renderable match when no WHO slide exists", () => {
    const slides = [
      slide({ id: "pp", repository: "PathPresenter" }),
      slide({ id: "mgh", repository: "MGH" }),
    ];
    expect(pickViewableSlide(tm, slides)?.id).toBe("mgh");
  });

  it("returns null when nothing is renderable", () => {
    const slides = [slide({ id: "pp", repository: "PathPresenter" })];
    expect(pickViewableSlide(tm, slides)).toBeNull();
  });
});
