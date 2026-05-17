// dev/test/lesson-studio/vision-logic.test.ts
import { describe, it, expect } from "vitest";
import {
  normaliseMagnification,
  deriveMicroscopicTool,
  parseXY,
  parseObjectPresent,
  parseObjectShape,
  parseObjectSize,
  parseVisionResponse,
} from "@/app/api/admin/lesson-studio/generate-sequence/vision";
import type { ImageInput } from "@/app/api/admin/lesson-studio/generate-sequence/prompt";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeImage(overrides: Partial<ImageInput> = {}): ImageInput {
  return {
    url: "https://example.com/img.jpg",
    title: "Castleman Disease",
    description: "Hyaline vascular variant",
    category: "microscopic",
    magnification: null,
    width: 1200,
    height: 900,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// normaliseMagnification()
// ---------------------------------------------------------------------------

describe("normaliseMagnification()", () => {
  describe("DB numeric string mapping", () => {
    it("maps 2x, 4x, 5x, 10x → low", () => {
      expect(normaliseMagnification("2x")).toBe("low");
      expect(normaliseMagnification("4x")).toBe("low");
      expect(normaliseMagnification("5x")).toBe("low");
      expect(normaliseMagnification("10x")).toBe("low");
    });

    it("maps 20x → medium", () => {
      expect(normaliseMagnification("20x")).toBe("medium");
    });

    it("maps 40x, 50x, 60x → high", () => {
      expect(normaliseMagnification("40x")).toBe("high");
      expect(normaliseMagnification("50x")).toBe("high");
      expect(normaliseMagnification("60x")).toBe("high");
    });

    it("maps 100x → very_high", () => {
      expect(normaliseMagnification("100x")).toBe("very_high");
    });

    it("is case-insensitive for DB values", () => {
      expect(normaliseMagnification("40X")).toBe("high");
    });
  });

  describe("already-enum DB values", () => {
    it("passes through low/medium/high/very_high directly", () => {
      expect(normaliseMagnification("low")).toBe("low");
      expect(normaliseMagnification("medium")).toBe("medium");
      expect(normaliseMagnification("high")).toBe("high");
      expect(normaliseMagnification("very_high")).toBe("very_high");
    });
  });

  describe("text-based fallback", () => {
    it("infers high from 'high power field'", () => {
      expect(normaliseMagnification(null, "high power field")).toBe("high");
    });

    it("infers high from 'HPF'", () => {
      expect(normaliseMagnification(null, "HPF")).toBe("high");
    });

    it("infers high from '×40'", () => {
      expect(normaliseMagnification(null, "image at ×40 magnification")).toBe("high");
    });

    it("infers high from '40x' in text", () => {
      expect(normaliseMagnification(null, "40x magnification")).toBe("high");
    });

    it("infers low from 'low power'", () => {
      expect(normaliseMagnification(null, "low power view")).toBe("low");
    });

    it("infers low from 'scanning power'", () => {
      expect(normaliseMagnification(null, "scanning power overview")).toBe("low");
    });

    it("infers medium from 'medium power'", () => {
      expect(normaliseMagnification(null, "medium power view")).toBe("medium");
    });

    it("infers very_high from 'oil immersion'", () => {
      expect(normaliseMagnification(null, "oil immersion lens")).toBe("very_high");
    });

    it("infers very_high from ×100", () => {
      expect(normaliseMagnification(null, "×100 magnification")).toBe("very_high");
    });

    it("does not false-positive 'high power' as very_high", () => {
      // 'high power' should be 'high', not 'very_high'
      expect(normaliseMagnification(null, "high power field")).toBe("high");
    });

    it("DB value takes priority over fallback text", () => {
      // DB says 40x (high), text says low power — DB wins
      expect(normaliseMagnification("40x", "low power view")).toBe("high");
    });
  });

  describe("null/undefined/unknown", () => {
    it("returns null when no DB value and no matching text", () => {
      expect(normaliseMagnification(null)).toBeNull();
      expect(normaliseMagnification(undefined)).toBeNull();
      expect(normaliseMagnification(null, "some random text")).toBeNull();
    });

    it("returns null for unrecognised DB string", () => {
      expect(normaliseMagnification("unknown")).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// deriveMicroscopicTool() — full decision table
// ---------------------------------------------------------------------------

describe("deriveMicroscopicTool()", () => {
  it("returns none when no discrete object present", () => {
    expect(deriveMicroscopicTool(false, "circular", "large", "high")).toBe("none");
    expect(deriveMicroscopicTool(null, "circular", "large", "low")).toBe("none");
  });

  describe("low magnification", () => {
    it("circular/ovoid → spotlight", () => {
      expect(deriveMicroscopicTool(true, "circular", "medium", "low")).toBe("spotlight");
      expect(deriveMicroscopicTool(true, "ovoid", "large", "low")).toBe("spotlight");
    });

    it("irregular → arrow", () => {
      expect(deriveMicroscopicTool(true, "irregular", "medium", "low")).toBe("arrow");
      expect(deriveMicroscopicTool(true, "irregular", "small", "low")).toBe("arrow");
    });
  });

  describe("medium magnification", () => {
    it("medium/large + circular → circle", () => {
      expect(deriveMicroscopicTool(true, "circular", "large", "medium")).toBe("circle");
      expect(deriveMicroscopicTool(true, "circular", "medium", "medium")).toBe("circle");
    });

    it("medium/large + ovoid → ellipse", () => {
      expect(deriveMicroscopicTool(true, "ovoid", "large", "medium")).toBe("ellipse");
      expect(deriveMicroscopicTool(true, "ovoid", "medium", "medium")).toBe("ellipse");
    });

    it("small + circular/ovoid → arrow", () => {
      expect(deriveMicroscopicTool(true, "circular", "small", "medium")).toBe("arrow");
      expect(deriveMicroscopicTool(true, "ovoid", "small", "medium")).toBe("arrow");
    });

    it("medium/large + irregular → none", () => {
      expect(deriveMicroscopicTool(true, "irregular", "large", "medium")).toBe("none");
      expect(deriveMicroscopicTool(true, "irregular", "medium", "medium")).toBe("none");
    });

    it("small + irregular → spotlight", () => {
      expect(deriveMicroscopicTool(true, "irregular", "small", "medium")).toBe("spotlight");
    });
  });

  describe("high magnification", () => {
    it("medium/large + circular → circle", () => {
      expect(deriveMicroscopicTool(true, "circular", "large", "high")).toBe("circle");
    });

    it("small + circular → arrow", () => {
      expect(deriveMicroscopicTool(true, "circular", "small", "high")).toBe("arrow");
    });

    it("small + irregular → spotlight", () => {
      expect(deriveMicroscopicTool(true, "irregular", "small", "high")).toBe("spotlight");
    });
  });

  describe("very_high magnification", () => {
    it("treats same as non-low (medium/large + circular → circle)", () => {
      expect(deriveMicroscopicTool(true, "circular", "large", "very_high")).toBe("circle");
    });

    it("small + circular → arrow", () => {
      expect(deriveMicroscopicTool(true, "circular", "small", "very_high")).toBe("arrow");
    });
  });

  describe("null magnification", () => {
    it("null magnification is treated as non-low (isLowMag=false)", () => {
      // With null mag: large + circular → circle (not spotlight)
      expect(deriveMicroscopicTool(true, "circular", "large", null)).toBe("circle");
    });
  });
});

// ---------------------------------------------------------------------------
// parseXY()
// ---------------------------------------------------------------------------

describe("parseXY()", () => {
  it("parses x=N, y=N format", () => {
    expect(parseXY("x=62, y=41")).toEqual({ x: 62, y: 41 });
  });

  it("parses x:N y:N format", () => {
    expect(parseXY("x: 30.5 y: 70.2")).toEqual({ x: 30.5, y: 70.2 });
  });

  it("parses values with % suffix", () => {
    expect(parseXY("x=50%, y=50%")).toEqual({ x: 50, y: 50 });
  });

  it("returns null when no x/y found", () => {
    expect(parseXY("no coordinates here")).toBeNull();
  });

  it("returns null when values are out of 0–100 range", () => {
    expect(parseXY("x=150, y=50")).toBeNull();
    expect(parseXY("x=50, y=-10")).toBeNull();
  });

  it("handles decimal values", () => {
    const result = parseXY("x=62.3, y=41.8");
    expect(result?.x).toBeCloseTo(62.3);
    expect(result?.y).toBeCloseTo(41.8);
  });
});

// ---------------------------------------------------------------------------
// parseObjectPresent()
// ---------------------------------------------------------------------------

describe("parseObjectPresent()", () => {
  it("returns true for 'yes'", () => {
    expect(parseObjectPresent("yes, there is a follicle")).toBe(true);
  });

  it("returns false for 'no'", () => {
    expect(parseObjectPresent("no discrete structure")).toBe(false);
  });

  it("returns null when ambiguous", () => {
    expect(parseObjectPresent("unclear pattern")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseObjectShape()
// ---------------------------------------------------------------------------

describe("parseObjectShape()", () => {
  it("returns circular for 'circular'", () => {
    expect(parseObjectShape("circular follicle")).toBe("circular");
  });

  it("returns circular for 'round'", () => {
    expect(parseObjectShape("round granuloma")).toBe("circular");
  });

  it("returns ovoid for 'ovoid'", () => {
    expect(parseObjectShape("ovoid structure")).toBe("ovoid");
  });

  it("returns ovoid for 'oval'", () => {
    expect(parseObjectShape("oval shaped")).toBe("ovoid");
  });

  it("returns ovoid for 'elliptical'", () => {
    expect(parseObjectShape("elliptical gland")).toBe("ovoid");
  });

  it("returns irregular", () => {
    expect(parseObjectShape("irregular border")).toBe("irregular");
  });

  it("returns null when no shape found", () => {
    expect(parseObjectShape("no shape mentioned")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseObjectSize()
// ---------------------------------------------------------------------------

describe("parseObjectSize()", () => {
  it("returns large", () => {
    expect(parseObjectSize("large follicle")).toBe("large");
  });

  it("returns medium", () => {
    expect(parseObjectSize("medium-sized granuloma")).toBe("medium");
  });

  it("returns small", () => {
    expect(parseObjectSize("small vessel")).toBe("small");
  });

  it("returns null when no size found", () => {
    expect(parseObjectSize("no size info")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseVisionResponse() — integration
// ---------------------------------------------------------------------------

describe("parseVisionResponse()", () => {
  const baseImage = makeImage({ magnification: "high" });

  it("parses a complete well-formed response", () => {
    const raw = `
1. Yes, I can see this histological image clearly.
2. The most important feature is a large circular lymphoid follicle.
3. Yes
3a. circular
3b. large
4. x=55, y=45
5. Hyaline Vascular Follicle
    `;
    const result = parseVisionResponse(raw, baseImage);
    expect(result.objectPresent).toBe(true);
    expect(result.objectShape).toBe("circular");
    expect(result.objectSize).toBe("large");
    expect(result.annotationTool).toBe("circle"); // deriveMicroscopicTool: high + large + circular
    expect(result.featurePosition).toEqual({ x: 55, y: 45 });
    expect(result.suggestedLabel).toContain("Hyaline");
  });

  it("falls back to none when no position found despite tool selection", () => {
    const raw = `
1. Yes.
2. Small mitotic figure.
3. Yes
3a. circular
3b. small
4. (no coordinates given)
5. Mitotic Figure
    `;
    const result = parseVisionResponse(raw, baseImage);
    // No position → falls back to none
    expect(result.annotationTool).toBe("none");
    expect(result.featurePosition).toBeNull();
  });

  it("returns none tool and null position when model says no discrete object", () => {
    const raw = `
1. Yes, I can see the image.
2. The overall tissue pattern shows diffuse architecture.
3. No
4. x=50, y=50
5. Diffuse Pattern
    `;
    const result = parseVisionResponse(raw, baseImage);
    expect(result.objectPresent).toBe(false);
    expect(result.annotationTool).toBe("none");
  });

  it("uses deterministic tool override regardless of response wording", () => {
    // Model might say spotlight in text but decision table says circle (high + large + circular)
    const raw = `
1. Yes.
2. Large round follicle.
3. Yes
3a. circular
3b. large
4. x=60, y=40
5. Lymphoid Follicle
    `;
    const result = parseVisionResponse(raw, baseImage);
    // Decision table: high mag + large + circular → circle
    expect(result.annotationTool).toBe("circle");
    // annotationReason is now the derived string
    expect(result.annotationReason).toContain("circle");
  });

  it("infers low magnification tool from image with low mag", () => {
    const lowMagImage = makeImage({ magnification: "low" });
    const raw = `
1. Yes.
2. Germinal centre pattern.
3. Yes
3a. circular
3b. medium
4. x=50, y=50
5. Germinal Centre
    `;
    const result = parseVisionResponse(raw, lowMagImage);
    // Decision table: low mag + circular → spotlight
    expect(result.annotationTool).toBe("spotlight");
  });
});
