/**
 * Unit tests for the pure helpers extracted from self-hosted-osd-viewer.tsx.
 */
import { describe, it, expect } from "vitest";
import {
  snap,
  fmtMag,
  magToSlider,
  sliderToMag,
  slug,
  buildExportName,
  estimateExportMB,
  nativeMagFromMpp,
  computeOnScreenMag,
  computeHiResDimensions,
  buildPanelItems,
  buildOsdOptions,
  MAG_MIN,
  MAG_MAX,
} from "@/shared/components/common/self-hosted-osd-viewer-utils";

describe("snap", () => {
  it("snaps to the nearest 90° within the threshold", () => {
    expect(snap(3)).toBe(0);
    expect(snap(88)).toBe(90);
    expect(snap(272)).toBe(270);
    expect(snap(357)).toBe(0); // 360 % 360
  });

  it("leaves angles outside the threshold untouched", () => {
    expect(snap(45)).toBe(45);
    expect(snap(80)).toBe(80);
  });
});

describe("fmtMag", () => {
  it("shows one decimal under 10× and whole numbers at/above", () => {
    expect(fmtMag(2.5)).toBe("2.5×");
    expect(fmtMag(40)).toBe("40×");
    expect(fmtMag(9.96)).toBe("10.0×");
  });
});

describe("magToSlider / sliderToMag", () => {
  it("are inverses across the range", () => {
    for (const m of [1, 5, 20, 100]) {
      expect(sliderToMag(magToSlider(m))).toBeCloseTo(m, 6);
    }
  });

  it("map the endpoints to 0 and 1", () => {
    expect(magToSlider(MAG_MIN)).toBeCloseTo(0, 6);
    expect(magToSlider(MAG_MAX)).toBeCloseTo(1, 6);
  });

  it("clamps out-of-range magnifications", () => {
    expect(magToSlider(0.5)).toBeCloseTo(0, 6);
    expect(magToSlider(500)).toBeCloseTo(1, 6);
  });
});

describe("slug", () => {
  it("lowercases and dash-collapses, trimming edges", () => {
    expect(slug("Renal Cell Carcinoma!")).toBe("renal-cell-carcinoma");
    expect(slug("  --A/B--  ")).toBe("a-b");
    expect(slug(undefined)).toBe("");
  });
});

describe("buildExportName", () => {
  it("joins slugged fields + mag + resolution into a .png name", () => {
    expect(
      buildExportName({
        diagnosis: "Renal Cell Carcinoma",
        repository: "MGH",
        category: "GU",
        mag: 39.7,
        resLabel: "4K",
      })
    ).toBe("renal-cell-carcinoma_mgh_gu_40x_4K.png");
  });

  it("falls back to 'slide' and drops empty fields", () => {
    expect(buildExportName({ mag: 1, resLabel: "1K" })).toBe("slide_1x_1K.png");
  });
});

describe("estimateExportMB", () => {
  it("scales by output height and ~2 bytes/px", () => {
    // px=1000, container 800x600 → outH = round(1000*600/800)=750 → 1000*750*2/1e6 = 1.5
    expect(estimateExportMB(1000, 800, 600)).toBeCloseTo(1.5, 6);
  });
});

describe("nativeMagFromMpp", () => {
  it("maps microns-per-pixel to objective magnification (0.25µm/px → 40×)", () => {
    expect(nativeMagFromMpp(0.25)).toBeCloseTo(40, 6);
    expect(nativeMagFromMpp(0.5)).toBeCloseTo(20, 6);
  });

  it("defaults to 40× when mpp is unknown", () => {
    expect(nativeMagFromMpp(undefined)).toBe(40);
    expect(nativeMagFromMpp(0)).toBe(40); // 0 is falsy → unknown
  });
});

describe("computeOnScreenMag", () => {
  it("scales native mag by on-screen pixels per image pixel", () => {
    // 40× native, viewport zoom 1, container 1000px wide, image 1000px wide → 1:1 → 40×
    expect(computeOnScreenMag(40, 1, 1000, 1000)).toBeCloseTo(40, 6);
    // half the image fits the container (zoom shows 2× the pixels) → 80×
    expect(computeOnScreenMag(40, 2, 1000, 1000)).toBeCloseTo(80, 6);
    // image twice as wide as the container at zoom 1 → 20×
    expect(computeOnScreenMag(40, 1, 1000, 2000)).toBeCloseTo(20, 6);
  });
});

describe("computeHiResDimensions", () => {
  it("scales the live viewport up to the requested long side", () => {
    expect(computeHiResDimensions(4096, 1024, 768)).toEqual({
      scale: 4,
      width: 4096,
      height: 3072,
    });
  });

  it("never downscales below the live size (scale floored at 1)", () => {
    expect(computeHiResDimensions(500, 1024, 768)).toEqual({
      scale: 1,
      width: 1024,
      height: 768,
    });
  });
});

describe("buildPanelItems", () => {
  const relatedSlides = [
    { label: "H&E", thumbUrl: "a.jpg", slideUrl: "u1", stain: "HE" },
    { label: "PAS", thumbUrl: "b.jpg", slideUrl: "u2", stain: "PAS" },
  ];
  const related = [
    { name: "n1", label: "Slide 1", thumbUrl: "c.jpg" },
    { name: "n2", label: "Slide 2", thumbUrl: "d.jpg" },
  ];

  it("corpus mode keys off slideUrl and flags the active slide", () => {
    const items = buildPanelItems(true, relatedSlides, [], "u2", null);
    expect(items).toEqual([
      { key: "u1", label: "H&E", thumbUrl: "a.jpg", stain: "HE", active: false },
      { key: "u2", label: "PAS", thumbUrl: "b.jpg", stain: "PAS", active: true },
    ]);
  });

  it("corpus mode tolerates undefined relatedSlides", () => {
    expect(buildPanelItems(true, undefined, related, "u1", null)).toEqual([]);
  });

  it("MGH mode keys off name and defaults the active slide to the first", () => {
    const items = buildPanelItems(false, undefined, related, "ignored", null);
    expect(items).toEqual([
      { key: "n1", label: "Slide 1", thumbUrl: "c.jpg", stain: undefined, active: true },
      { key: "n2", label: "Slide 2", thumbUrl: "d.jpg", stain: undefined, active: false },
    ]);
  });

  it("MGH mode honors an explicit activeSlide", () => {
    const items = buildPanelItems(false, undefined, related, "ignored", "n2");
    expect(items.map((i) => i.active)).toEqual([false, true]);
  });
});

describe("buildOsdOptions", () => {
  const element = {} as HTMLElement;

  it("turns off the default control groups and renders our own bar", () => {
    const o = buildOsdOptions({
      element,
      tileSources: { foo: 1 },
      drawer: "webgl",
      corsClean: true,
      showNavigator: true,
    });
    expect(o.showNavigationControl).toBe(false);
    expect(o.showRotationControl).toBe(false);
    expect(o.showFlipControl).toBe(false);
    expect(o.showFullPageControl).toBe(false);
    expect(o.element).toBe(element);
    expect(o.tileSources).toEqual({ foo: 1 });
    expect(o.drawer).toBe("webgl");
    expect(o.showNavigator).toBe(true);
  });

  it("uses Anonymous crossOriginPolicy only when CORS-clean", () => {
    expect(
      buildOsdOptions({
        element,
        tileSources: {},
        drawer: "canvas",
        corsClean: true,
        showNavigator: false,
      }).crossOriginPolicy
    ).toBe("Anonymous");
    expect(
      buildOsdOptions({
        element,
        tileSources: {},
        drawer: "canvas",
        corsClean: false,
        showNavigator: false,
      }).crossOriginPolicy
    ).toBe(false);
  });
});
