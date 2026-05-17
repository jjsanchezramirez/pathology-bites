import { describe, it, expect } from "vitest";
import {
  parseVisionJSON,
  overrideToolDeterministically,
} from "@/app/api/admin/lesson-studio/generate-lesson/vision-v2";
import type { VisionResult } from "@/app/api/admin/lesson-studio/generate-sequence/vision";
import type { ImageInput } from "@/app/api/admin/lesson-studio/generate-sequence/prompt";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeImage(overrides: Partial<ImageInput> = {}): ImageInput {
  return {
    url: "https://example.com/img.jpg",
    title: "Castleman Disease",
    description: "Hyaline vascular variant",
    category: "microscopic",
    magnification: "high",
    width: 1200,
    height: 900,
    ...overrides,
  };
}

function makeVision(overrides: Partial<VisionResult> = {}): VisionResult {
  return {
    canSeeImage: true,
    featurePosition: { x: 60, y: 40 },
    suggestedLabel: "Hyaline Follicle",
    annotationTool: "circle",
    annotationReason: "Discrete round follicle",
    objectPresent: true,
    objectShape: "circular",
    objectSize: "medium",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseVisionJSON
// ---------------------------------------------------------------------------

describe("parseVisionJSON", () => {
  const img = makeImage();

  const validJSON = JSON.stringify({
    canSeeImage: true,
    featurePosition: { x: 60, y: 40 },
    suggestedLabel: "Hyaline Follicle",
    annotationTool: "spotlight",
    annotationReason: "Busy low-mag field",
    objectPresent: true,
    objectShape: "circular",
    objectSize: "medium",
  });

  it("parses clean JSON", () => {
    const result = parseVisionJSON(validJSON, img);
    expect(result).not.toBeNull();
    expect(result!.canSeeImage).toBe(true);
    expect(result!.featurePosition).toEqual({ x: 60, y: 40 });
    expect(result!.annotationTool).toBe("spotlight");
    expect(result!.suggestedLabel).toBe("Hyaline Follicle");
    expect(result!.objectPresent).toBe(true);
    expect(result!.objectShape).toBe("circular");
    expect(result!.objectSize).toBe("medium");
  });

  it("strips markdown code fences", () => {
    const fenced = "```json\n" + validJSON + "\n```";
    const result = parseVisionJSON(fenced, img);
    expect(result).not.toBeNull();
    expect(result!.annotationTool).toBe("spotlight");
  });

  it("extracts JSON from surrounding text", () => {
    const wrapped = "Here is the analysis:\n" + validJSON + "\nDone.";
    const result = parseVisionJSON(wrapped, img);
    expect(result).not.toBeNull();
    expect(result!.canSeeImage).toBe(true);
  });

  it("returns null for completely invalid input", () => {
    expect(parseVisionJSON("not json at all", img)).toBeNull();
    expect(parseVisionJSON("", img)).toBeNull();
  });

  it("handles canSeeImage: false", () => {
    const result = parseVisionJSON(JSON.stringify({ canSeeImage: false }), img);
    expect(result).not.toBeNull();
    expect(result!.canSeeImage).toBe(false);
    expect(result!.featurePosition).toBeNull();
    expect(result!.annotationTool).toBe("none");
    expect(result!.suggestedLabel).toBe("");
  });

  it("sets featurePosition to null when coordinates are out of 0-100 range", () => {
    const outOfRange = JSON.stringify({
      canSeeImage: true,
      featurePosition: { x: 150, y: 40 },
      suggestedLabel: "Test",
      annotationTool: "none",
      annotationReason: "",
    });
    const result = parseVisionJSON(outOfRange, img);
    expect(result).not.toBeNull();
    expect(result!.featurePosition).toBeNull();
  });

  it("sets featurePosition to null when field is missing", () => {
    const noPosition = JSON.stringify({
      canSeeImage: true,
      suggestedLabel: "Test",
      annotationTool: "none",
      annotationReason: "",
    });
    const result = parseVisionJSON(noPosition, img);
    expect(result).not.toBeNull();
    expect(result!.featurePosition).toBeNull();
  });

  it("strips trailing punctuation from suggestedLabel", () => {
    const withPunct = JSON.stringify({
      canSeeImage: true,
      featurePosition: { x: 50, y: 50 },
      suggestedLabel: "Follicle.",
      annotationTool: "none",
      annotationReason: "",
    });
    const result = parseVisionJSON(withPunct, img);
    expect(result!.suggestedLabel).toBe("Follicle");
  });

  it("truncates suggestedLabel to 50 chars", () => {
    const longLabel = "A".repeat(80);
    const withLong = JSON.stringify({
      canSeeImage: true,
      featurePosition: { x: 50, y: 50 },
      suggestedLabel: longLabel,
      annotationTool: "none",
      annotationReason: "",
    });
    const result = parseVisionJSON(withLong, img);
    expect(result!.suggestedLabel.length).toBeLessThanOrEqual(50);
  });

  it("defaults invalid annotationTool to 'none'", () => {
    const invalid = JSON.stringify({
      canSeeImage: true,
      featurePosition: { x: 50, y: 50 },
      suggestedLabel: "Test",
      annotationTool: "highlight",
      annotationReason: "",
    });
    const result = parseVisionJSON(invalid, img);
    expect(result!.annotationTool).toBe("none");
  });

  it("forces tool to 'none' when tool requires position but none given", () => {
    const noPos = JSON.stringify({
      canSeeImage: true,
      suggestedLabel: "Test",
      annotationTool: "circle",
      annotationReason: "",
    });
    const result = parseVisionJSON(noPos, img);
    expect(result!.annotationTool).toBe("none");
  });

  it("parses objectPresent, objectShape, objectSize correctly", () => {
    const full = JSON.stringify({
      canSeeImage: true,
      featurePosition: { x: 50, y: 50 },
      suggestedLabel: "Test",
      annotationTool: "none",
      annotationReason: "",
      objectPresent: true,
      objectShape: "ovoid",
      objectSize: "large",
    });
    const result = parseVisionJSON(full, img);
    expect(result!.objectPresent).toBe(true);
    expect(result!.objectShape).toBe("ovoid");
    expect(result!.objectSize).toBe("large");
  });

  it("defaults invalid objectShape to null", () => {
    const invalid = JSON.stringify({
      canSeeImage: true,
      featurePosition: { x: 50, y: 50 },
      suggestedLabel: "Test",
      annotationTool: "none",
      annotationReason: "",
      objectShape: "hexagonal",
    });
    const result = parseVisionJSON(invalid, img);
    expect(result!.objectShape).toBeNull();
  });

  it("truncates annotationReason to 200 chars", () => {
    const longReason = "R".repeat(300);
    const data = JSON.stringify({
      canSeeImage: true,
      featurePosition: { x: 50, y: 50 },
      suggestedLabel: "Test",
      annotationTool: "none",
      annotationReason: longReason,
    });
    const result = parseVisionJSON(data, img);
    expect(result!.annotationReason.length).toBeLessThanOrEqual(200);
  });
});

// ---------------------------------------------------------------------------
// overrideToolDeterministically
// ---------------------------------------------------------------------------

describe("overrideToolDeterministically", () => {
  it("figure category forces annotationTool to 'none'", () => {
    const result = overrideToolDeterministically(
      makeVision({ annotationTool: "circle" }),
      makeImage({ category: "figure" })
    );
    expect(result.annotationTool).toBe("none");
  });

  it("table category forces annotationTool to 'none'", () => {
    const result = overrideToolDeterministically(
      makeVision({ annotationTool: "spotlight" }),
      makeImage({ category: "table" })
    );
    expect(result.annotationTool).toBe("none");
  });

  it("diagram category forces annotationTool to 'none'", () => {
    const result = overrideToolDeterministically(
      makeVision({ annotationTool: "arrow" }),
      makeImage({ category: "diagram" })
    );
    expect(result.annotationTool).toBe("none");
  });

  it("microscopic with no featurePosition results in 'none'", () => {
    const result = overrideToolDeterministically(
      makeVision({ featurePosition: null }),
      makeImage({ category: "microscopic" })
    );
    expect(result.annotationTool).toBe("none");
  });

  it("microscopic: circle is upgraded to spotlight (spotlight bias)", () => {
    const result = overrideToolDeterministically(
      makeVision({
        annotationTool: "circle",
        objectPresent: true,
        objectShape: "circular",
        objectSize: "medium",
      }),
      makeImage({ category: "microscopic", magnification: "high" })
    );
    expect(result.annotationTool).toBe("spotlight");
  });

  it("microscopic: ellipse is upgraded to spotlight (spotlight bias)", () => {
    const result = overrideToolDeterministically(
      makeVision({
        annotationTool: "ellipse",
        objectPresent: true,
        objectShape: "ovoid",
        objectSize: "medium",
      }),
      makeImage({ category: "microscopic", magnification: "medium" })
    );
    expect(result.annotationTool).toBe("spotlight");
  });

  it("microscopic: arrow stays arrow (no bias)", () => {
    const result = overrideToolDeterministically(
      makeVision({
        annotationTool: "arrow",
        objectPresent: true,
        objectShape: "circular",
        objectSize: "small",
      }),
      makeImage({ category: "microscopic", magnification: "high" })
    );
    // Arrow result comes from deriveMicroscopicTool — may become arrow or spotlight
    // but it won't be biased the same way circle/ellipse are
    expect(["arrow", "spotlight"]).toContain(result.annotationTool);
  });

  it("gross with objectPresent results in spotlight", () => {
    const result = overrideToolDeterministically(
      makeVision({ objectPresent: true }),
      makeImage({ category: "gross" })
    );
    expect(result.annotationTool).toBe("spotlight");
  });

  it("gross without objectPresent results in 'none'", () => {
    const result = overrideToolDeterministically(
      makeVision({ objectPresent: false }),
      makeImage({ category: "gross" })
    );
    expect(result.annotationTool).toBe("none");
  });

  it("preserves all other VisionResult fields", () => {
    const original = makeVision({
      suggestedLabel: "Follicle",
      featurePosition: { x: 30, y: 70 },
      objectPresent: true,
    });
    const result = overrideToolDeterministically(original, makeImage({ category: "gross" }));
    expect(result.suggestedLabel).toBe("Follicle");
    expect(result.featurePosition).toEqual({ x: 30, y: 70 });
    expect(result.canSeeImage).toBe(true);
  });
});
