import { describe, it, expect } from "vitest";
import { inlineLinks, parseAnswerBlocks } from "@/features/user/ask-albright/lib/answer-blocks";

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
      { kind: "list", title: null, items: ["First [1].", "Second [2]."], inline: false },
      { kind: "p", text: "After." },
    ]);
  });

  it("leaves a dash inside a sentence alone", () => {
    expect(parseAnswerBlocks("CK7 - patchy in oncocytoma [1].")).toEqual([
      { kind: "p", text: "CK7 - patchy in oncocytoma [1]." },
    ]);
  });

  it("turns labels into group titles and keeps indented bullets in their group (CCRCC shape)", () => {
    const text = [
      "- **Positive stains for CCRCC:**",
      "  - PAX8 [1, 3]",
      "  - CAIX (diffuse, membranous in 75 - 100% of cases) [1, 3]",
      "  - CD10 [1, 3]",
      "  - PAX2 [3]",
      "  - Vimentin [1, 3]",
      "- **Negative stains for CCRCC:**",
      "  - CK7 [1, 2]",
      "  - CK20 [3]",
      "  - Inhibin [3]",
    ].join("\n");
    expect(parseAnswerBlocks(text)).toEqual([
      {
        kind: "list",
        title: "Positive stains for CCRCC",
        items: [
          "PAX8 [1, 3]",
          "CAIX (diffuse, membranous in 75 - 100% of cases) [1, 3]",
          "CD10 [1, 3]",
          "PAX2 [3]",
          "Vimentin [1, 3]",
        ],
        inline: true,
      },
      {
        kind: "list",
        title: "Negative stains for CCRCC",
        items: ["CK7 [1, 2]", "CK20 [3]", "Inhibin [3]"],
        inline: true,
      },
    ]);
  });

  it("accepts plain and ### headings", () => {
    const blocks = parseAnswerBlocks("**Positive:**\n- A\n- B\n- C\n### Genetics\n- VHL loss [1]");
    expect(blocks.map((b) => (b.kind === "list" ? b.title : null))).toEqual([
      "Positive",
      "Genetics",
    ]);
  });

  it("keeps long items as bullets, short panels inline", () => {
    const long = "A".repeat(60);
    expect(parseAnswerBlocks(`- ${long}\n- ${long}\n- ${long}`)[0]).toMatchObject({
      inline: false,
    });
    expect(parseAnswerBlocks("- A\n- B")[0]).toMatchObject({ inline: false }); // fewer than 3
  });

  it("keeps a label with nothing under it as bold text", () => {
    expect(parseAnswerBlocks("**Genetic findings:**")).toEqual([
      { kind: "p", text: "**Genetic findings**" },
    ]);
  });

  it("drops groups whose only bullet is a placeholder like 'None'", () => {
    const text =
      "**Positive — normal tissue:**\n- None\n**Positive — tumors:**\n- Ewing sarcoma [1]\n- Synovial sarcoma [1]";
    expect(parseAnswerBlocks(text)).toEqual([
      {
        kind: "list",
        title: "Positive — tumors",
        items: ["Ewing sarcoma [1]", "Synovial sarcoma [1]"],
        inline: false,
      },
    ]);
  });
});

describe("parseAnswerBlocks while streaming", () => {
  const head = "| Marker | CHL | NLPHL |\n|---|---|---|\n";

  it("shows a table from its header on, pending, without the row being written", () => {
    const blocks = parseAnswerBlocks(`Intro.\n${head}| CD30 | Posi`, { streaming: true });
    expect(blocks).toEqual([
      { kind: "p", text: "Intro." },
      { kind: "table", header: ["Marker", "CHL", "NLPHL"], rows: [], pending: true },
    ]);
  });

  it("adds rows as they complete and stops pending once text follows the table", () => {
    const mid = parseAnswerBlocks(`${head}| CD30 | + | - |\n| CD20 |`, { streaming: true });
    expect(mid).toEqual([
      {
        kind: "table",
        header: ["Marker", "CHL", "NLPHL"],
        rows: [["CD30", "+", "-"]],
        pending: true,
      },
    ]);
    const after = parseAnswerBlocks(`${head}| CD30 | + | - |\nCHL is CD30+ [1].`, {
      streaming: true,
    });
    expect(after[0]).toMatchObject({ kind: "table" });
    expect(after[0]).not.toHaveProperty("pending");
  });

  it("never shows raw pipes for a half-written header or separator", () => {
    for (const partial of ["| Mar", "| Marker | CHL |\n|--", "| Marker | CHL |\n|---|---|\n| C"]) {
      const text = parseAnswerBlocks(partial, { streaming: true })
        .filter((b) => b.kind === "p")
        .map((b) => (b as { text: string }).text)
        .join(" ");
      expect(text).not.toContain("|");
    }
  });

  it("leaves finished answers unchanged (a lone header line is still plain text)", () => {
    expect(parseAnswerBlocks("| Marker | CHL |")).toEqual([
      { kind: "p", text: "| Marker | CHL |" },
    ]);
  });
});

describe("inlineLinks", () => {
  it("links in-site Markdown links and the About page", () => {
    expect(inlineLinks("Open [My Quizzes](/dashboard/quizzes) or see our About page.")).toEqual([
      { text: "Open " },
      { text: "My Quizzes", href: "/dashboard/quizzes" },
      { text: " or see our " },
      { text: "About page", href: "/about" },
      { text: "." },
    ]);
  });

  it("never links off-site or protocol-relative URLs", () => {
    for (const t of [
      "[x](https://evil.example)",
      "[x](//evil.example)",
      "[x](javascript:alert(1))",
    ]) {
      expect(inlineLinks(t).every((p) => !p.href)).toBe(true);
    }
  });

  it("leaves plain text and citation markers alone", () => {
    expect(inlineLinks("CD30 is positive [1].")).toEqual([{ text: "CD30 is positive [1]." }]);
  });
});

describe("comparison tables", () => {
  it("drops rows where no item has a value, keeps rows with one", () => {
    const text = [
      "| Feature | CHL | NLPHL | PMBL |",
      "| --- | --- | --- | --- |",
      "| CD30 | Positive [1] | 27% [4] | 90-100% [3] |",
      "| CD23 | not stated | not stated | Positive [3] |",
      "| CD274 | not stated | Not stated | not stated [2] |",
      "| CD8 | — | N/A | not stated. |",
    ].join("\n");
    const [t] = parseAnswerBlocks(text);
    expect(t).toMatchObject({ kind: "table" });
    expect((t as { rows: string[][] }).rows.map((r) => r[0])).toEqual(["CD30", "CD23"]);
  });

  it("drops a table whose every row was empty, without leaving raw pipes", () => {
    const text =
      "Intro.\n| Feature | A | B |\n| --- | --- | --- |\n| X | not stated | not stated |";
    expect(parseAnswerBlocks(text)).toEqual([{ kind: "p", text: "Intro." }]);
  });
});
