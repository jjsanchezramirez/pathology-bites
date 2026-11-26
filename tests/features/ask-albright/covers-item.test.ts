import { describe, expect, it } from "vitest";
import { coversItem } from "@/features/user/ask-albright/lib/ask";

describe("coversItem", () => {
  const PMBL = "Primary mediastinal large B-cell lymphoma";
  it("accepts a page title that names the item", () => {
    expect(coversItem("classic Hodgkin lymphoma", "Classic Hodgkin lymphoma")).toBe(true);
  });
  it("accepts PathologyOutlines' shortened titles ('primary mediastinal' for PMBL)", () => {
    expect(coversItem("primary mediastinal", PMBL)).toBe(true);
  });
  it("refuses a different diagnosis that shares words", () => {
    expect(coversItem("mediastinal gray zone lymphoma", PMBL)).toBe(false);
    expect(
      coversItem("classic Hodgkin lymphoma", "Nodular lymphocyte predominant Hodgkin lymphoma")
    ).toBe(false);
    expect(coversItem("CHL nodular sclerosis", "Classic Hodgkin lymphoma")).toBe(false);
  });
  it("refuses one-word or generic titles", () => {
    expect(coversItem("lymphoma", PMBL)).toBe(false);
    expect(coversItem("large cell", PMBL)).toBe(false);
    expect(coversItem("B cell lymphoma", PMBL)).toBe(false);
  });
});
