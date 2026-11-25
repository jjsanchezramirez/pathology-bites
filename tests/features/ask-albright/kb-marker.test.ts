import { describe, it, expect, vi } from "vitest";

vi.mock("@/shared/services/server", () => ({ createClient: vi.fn() }));
vi.mock("@/shared/services/openai-compat", () => ({ callOpenAICompatText: vi.fn() }));

import { keepPicked, numbered, profileLists } from "@/features/user/ask-albright/lib/kb-marker";
import { keepCutOff, tidyAnswer } from "@/features/user/ask-albright/lib/router";

const names = new Map([
  ["a", "Lung adenocarcinoma: General overview"],
  ["b", "Thyroid papillary carcinoma"],
  ["c", "Mesothelioma"],
  ["d", "Small cell carcinoma"],
  ["e", "Medullary carcinoma"],
]);

describe("profileLists", () => {
  it("splits by call, best-sourced first, and labels variable and loss", () => {
    const { positive, negative } = profileLists(
      [
        { entity_id: "a", call: "positive", pooled_pct: 75.4, sources: 1 },
        { entity_id: "b", call: "positive", pooled_pct: 98, sources: 3 },
        { entity_id: "c", call: "negative", pooled_pct: null, sources: 2 },
        { entity_id: "d", call: "mixed", pooled_pct: 50, sources: 2 },
        { entity_id: "e", call: "loss", pooled_pct: null, sources: 1 },
      ],
      names
    );
    expect(positive).toEqual([
      "Thyroid papillary carcinoma (98%)",
      "Small cell carcinoma (variable)",
      "Lung adenocarcinoma (75%)",
    ]);
    expect(negative).toEqual(["Mesothelioma", "Medullary carcinoma (loss)"]);
  });

  it("lists a tumour once and skips unknown entities", () => {
    const { positive, negative } = profileLists(
      [
        { entity_id: "a", call: "positive", pooled_pct: 80, sources: 2 },
        { entity_id: "a", call: "negative", pooled_pct: null, sources: 1 },
        { entity_id: "zz", call: "positive", pooled_pct: 90, sources: 4 },
      ],
      names
    );
    expect(positive).toEqual(["Lung adenocarcinoma (80%)"]);
    expect(negative).toEqual([]);
  });
});

describe("keepPicked", () => {
  const list = ["Lung adenocarcinoma (75%)", "Mesothelioma", "Thymoma"];
  it("maps ids back to items in picked order, ignoring the other prefix", () => {
    expect(keepPicked(["P2", "N1", "p1", 3], list, "P", 5)).toEqual([
      "Mesothelioma",
      "Lung adenocarcinoma (75%)",
      "Thymoma",
    ]);
  });
  it("drops out-of-range ids, names and junk; caps and dedupes", () => {
    expect(keepPicked(["P9", "P0", "Mesothelioma", null, "P2", "P2", "P3"], list, "P", 2)).toEqual([
      "Mesothelioma",
      "Thymoma",
    ]);
    expect(keepPicked("P1", list, "P", 5)).toEqual([]);
  });
});

describe("numbered", () => {
  it("prefixes each item with its id", () => {
    expect(numbered(["A", "B"], "N")).toBe("N1 A\nN2 B");
  });
});

describe("keepCutOff", () => {
  it("keeps a cut list minus the partial line and a dangling label", () => {
    const text = "**Positive:**\n- a [1]\n- b [1]\n- c [2]\n**Negative:**\n- d [";
    expect(keepCutOff(text)).toBe("**Positive:**\n- a [1]\n- b [1]\n- c [2]");
  });
  it("keeps a table with two body rows", () => {
    const text = "| X | Y |\n|---|---|\n| a | b |\n| c | d |\n| e | f";
    expect(keepCutOff(text)).toBe("| X | Y |\n|---|---|\n| a | b |\n| c | d |");
  });
  it("returns null when too little survives", () => {
    expect(keepCutOff("| X | Y |\n|---|---|\n|  ")).toBeNull();
    expect(keepCutOff("Some sentence that was cut")).toBeNull();
  });
});

describe("tidyAnswer", () => {
  it("drops a colon left before a bare citation, keeping real details", () => {
    expect(tidyAnswer("- Myeloid sarcoma: [4]\n- CIC sarcoma: patchy [1]\n- X: [3], [4]")).toBe(
      "- Myeloid sarcoma [4]\n- CIC sarcoma: patchy [1]\n- X [3], [4]"
    );
  });
});
