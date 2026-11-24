import { describe, it, expect } from "vitest";
import { parseAnswerBlocks } from "@/features/user/ask-albright/lib/answer-blocks";

describe("parseAnswerBlocks", () => {
  it("parses a Markdown table and keeps the text around it in order", () => {
    // Shape of the real NLPHL answer that rendered as raw pipes.
    const text = [
      "| Marker | NLPHL | CHL |",
      "| --- | --- | --- |",
      "| **MEF2B** | Expressed in LP cells [1], [3] | Not expressed [1] |",
      "| **J chain** | Expressed [1] | Not expressed [1] |",
      "The sources do not cover NLPHL vs THRLBCL.",
    ].join("\n");
    expect(parseAnswerBlocks(text)).toEqual([
      {
        kind: "table",
        header: ["Marker", "NLPHL", "CHL"],
        rows: [
          ["**MEF2B**", "Expressed in LP cells [1], [3]", "Not expressed [1]"],
          ["**J chain**", "Expressed [1]", "Not expressed [1]"],
        ],
      },
      { kind: "p", text: "The sources do not cover NLPHL vs THRLBCL." },
    ]);
  });

  it("pads short rows to the header width", () => {
    const blocks = parseAnswerBlocks("| A | B | C |\n|---|---|---|\n| 1 | 2 |");
    expect(blocks[0]).toEqual({ kind: "table", header: ["A", "B", "C"], rows: [["1", "2", ""]] });
  });

  it("keeps a lone pipe line (no header + row) as text", () => {
    expect(parseAnswerBlocks("| just one line |")).toEqual([
      { kind: "p", text: "| just one line |" },
    ]);
  });

  it("splits run-together bullets and keeps paragraphs before and after in order", () => {
    expect(parseAnswerBlocks("Intro. - First [1]. - Second [2].\nAfter.")).toEqual([
      { kind: "p", text: "Intro." },
      { kind: "ul", items: ["First [1].", "Second [2]."] },
      { kind: "p", text: "After." },
    ]);
  });

  it("leaves a dash inside a sentence alone", () => {
    expect(parseAnswerBlocks("CK7 - patchy in oncocytoma [1].")).toEqual([
      { kind: "p", text: "CK7 - patchy in oncocytoma [1]." },
    ]);
  });
});
