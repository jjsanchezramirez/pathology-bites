import { describe, it, expect } from "vitest";
import { parsePlanResponse } from "@/app/api/admin/lesson-studio/generate-lesson/planner";

// ---------------------------------------------------------------------------
// parsePlanResponse
// ---------------------------------------------------------------------------

describe("parsePlanResponse", () => {
  const validPlan = JSON.stringify({
    imageOrder: [2, 0, 1],
    textSlides: [
      {
        type: "text-only",
        insertBeforeImage: 0,
        title: "Key Features",
        bullets: ["Point one", "Point two"],
        backgroundColor: "#1a1a2e",
        duration: 5,
      },
    ],
    svgPlacements: [{ svgIndex: 0, onSlide: 1, position: { x: 80, y: 20 }, widthPercent: 15 }],
  });

  it("parses valid plan JSON", () => {
    const result = parsePlanResponse(validPlan, 3);
    expect(result).not.toBeNull();
    expect(result!.imageOrder).toEqual([2, 0, 1]);
    expect(result!.textSlides).toHaveLength(1);
    expect(result!.textSlides[0].title).toBe("Key Features");
    expect(result!.svgPlacements).toHaveLength(1);
  });

  it("strips markdown fences", () => {
    const fenced = "```json\n" + validPlan + "\n```";
    const result = parsePlanResponse(fenced, 3);
    expect(result).not.toBeNull();
    expect(result!.imageOrder).toEqual([2, 0, 1]);
  });

  it("extracts JSON from surrounding text", () => {
    const wrapped = "Here is the plan:\n" + validPlan + "\nDone.";
    const result = parsePlanResponse(wrapped, 3);
    expect(result).not.toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parsePlanResponse("not json", 3)).toBeNull();
    expect(parsePlanResponse("", 3)).toBeNull();
  });

  it("returns null when imageOrder length != numImages", () => {
    const wrong = JSON.stringify({ imageOrder: [0, 1] });
    expect(parsePlanResponse(wrong, 3)).toBeNull();
  });

  it("returns null when imageOrder has duplicates", () => {
    const dupes = JSON.stringify({ imageOrder: [0, 0, 1] });
    expect(parsePlanResponse(dupes, 3)).toBeNull();
  });

  it("returns null when imageOrder has missing indices", () => {
    const missing = JSON.stringify({ imageOrder: [0, 1, 4] });
    expect(parsePlanResponse(missing, 3)).toBeNull();
  });

  it("returns null when imageOrder is not an array", () => {
    const bad = JSON.stringify({ imageOrder: "0,1,2" });
    expect(parsePlanResponse(bad, 3)).toBeNull();
  });

  it("parses textSlides with all fields", () => {
    const result = parsePlanResponse(validPlan, 3);
    const ts = result!.textSlides[0];
    expect(ts.type).toBe("text-only");
    expect(ts.insertBeforeImage).toBe(0);
    expect(ts.title).toBe("Key Features");
    expect(ts.bullets).toEqual(["Point one", "Point two"]);
    expect(ts.backgroundColor).toBe("#1a1a2e");
    expect(ts.duration).toBe(5);
  });

  it("clamps insertBeforeImage to [0, numImages]", () => {
    const plan = JSON.stringify({
      imageOrder: [0, 1],
      textSlides: [
        { title: "A", bullets: [], insertBeforeImage: -5, duration: 5 },
        { title: "B", bullets: [], insertBeforeImage: 99, duration: 5 },
      ],
    });
    const result = parsePlanResponse(plan, 2);
    expect(result!.textSlides[0].insertBeforeImage).toBe(0);
    expect(result!.textSlides[1].insertBeforeImage).toBe(2);
  });

  it("truncates textSlide title to 60 chars", () => {
    const longTitle = "A".repeat(100);
    const plan = JSON.stringify({
      imageOrder: [0],
      textSlides: [{ title: longTitle, bullets: [], duration: 5 }],
    });
    const result = parsePlanResponse(plan, 1);
    expect(result!.textSlides[0].title.length).toBeLessThanOrEqual(60);
  });

  it("caps bullets at 3 items, each 60 chars", () => {
    const longBullet = "B".repeat(80);
    const plan = JSON.stringify({
      imageOrder: [0],
      textSlides: [
        {
          title: "Test",
          bullets: [longBullet, "b2", "b3", "b4", "b5"],
          duration: 5,
        },
      ],
    });
    const result = parsePlanResponse(plan, 1);
    expect(result!.textSlides[0].bullets).toHaveLength(3);
    expect(result!.textSlides[0].bullets[0].length).toBeLessThanOrEqual(60);
  });

  it("clamps textSlide duration to [3, 8]", () => {
    const plan = JSON.stringify({
      imageOrder: [0],
      textSlides: [
        { title: "Short", bullets: [], duration: 1 },
        { title: "Long", bullets: [], duration: 20 },
      ],
    });
    const result = parsePlanResponse(plan, 1);
    expect(result!.textSlides[0].duration).toBe(3);
    expect(result!.textSlides[1].duration).toBe(8);
  });

  it("defaults backgroundColor to '#1a1a2e' when missing", () => {
    const plan = JSON.stringify({
      imageOrder: [0],
      textSlides: [{ title: "Test", bullets: [] }],
    });
    const result = parsePlanResponse(plan, 1);
    expect(result!.textSlides[0].backgroundColor).toBe("#1a1a2e");
  });

  it("defaults duration to 5 when missing", () => {
    const plan = JSON.stringify({
      imageOrder: [0],
      textSlides: [{ title: "Test", bullets: [] }],
    });
    const result = parsePlanResponse(plan, 1);
    expect(result!.textSlides[0].duration).toBe(5);
  });

  it("skips textSlides without title", () => {
    const plan = JSON.stringify({
      imageOrder: [0],
      textSlides: [{ bullets: ["a"] }, { title: "Valid", bullets: ["b"] }],
    });
    const result = parsePlanResponse(plan, 1);
    expect(result!.textSlides).toHaveLength(1);
    expect(result!.textSlides[0].title).toBe("Valid");
  });

  it("parses svgPlacements with valid fields", () => {
    const result = parsePlanResponse(validPlan, 3);
    expect(result!.svgPlacements[0]).toEqual({
      svgIndex: 0,
      onSlide: 1,
      position: { x: 80, y: 20 },
      widthPercent: 15,
    });
  });

  it("skips svgPlacements with invalid position", () => {
    const plan = JSON.stringify({
      imageOrder: [0],
      svgPlacements: [
        { svgIndex: 0, onSlide: 0 },
        { svgIndex: 0, onSlide: 0, position: { x: 50 } },
      ],
    });
    const result = parsePlanResponse(plan, 1);
    expect(result!.svgPlacements).toHaveLength(0);
  });

  it("returns empty textSlides and svgPlacements when fields are absent", () => {
    const minimal = JSON.stringify({ imageOrder: [0, 1] });
    const result = parsePlanResponse(minimal, 2);
    expect(result!.textSlides).toEqual([]);
    expect(result!.svgPlacements).toEqual([]);
  });
});
