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
