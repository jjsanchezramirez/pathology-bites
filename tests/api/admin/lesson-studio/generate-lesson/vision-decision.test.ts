import { describe, it, expect } from "vitest";
import {
  normaliseMagnification,
  deriveMicroscopicTool,
} from "@/app/api/admin/lesson-studio/generate-lesson/vision";

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
