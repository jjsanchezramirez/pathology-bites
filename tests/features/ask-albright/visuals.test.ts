import { describe, it, expect } from "vitest";
import {
  imageSubject,
  shortCredit,
  pickImages,
  legendCovers,
  shortLegend,
  splitDiagram,
  validDiagram,
} from "@/features/user/ask-albright/lib/visuals";

const DIAGRAM = `flowchart TD
  A{"CD10 positive?"} -->|Yes| B["GCB"]
  A -->|No| C{"BCL6 positive?"}
  C -->|No| D["Non-GCB"]`;

describe("splitDiagram", () => {
  it("takes the mermaid block off the answer, wherever it sits", () => {
    const text = `Answer [1].\n\n\`\`\`mermaid\n${DIAGRAM}\n\`\`\`\nFollow-ups: A? | B?`;
    const out = splitDiagram(text);
    expect(out.code).toBe(validDiagram(DIAGRAM));
    expect(out.code).toMatch(/^flowchart TD\n  n1\{"CD10 positive\?"\}/);
    expect(out.text).toBe("Answer [1].\n\nFollow-ups: A? | B?");
  });

  it("drops a block the token cap cut off, and leaves plain answers alone", () => {
    expect(splitDiagram("Answer.\n```mermaid\nflowchart TD\n  A --> ")).toEqual({
      text: "Answer.",
      code: null,
    });
    expect(splitDiagram("Just text [1].")).toEqual({ text: "Just text [1].", code: null });
  });
});

describe("validDiagram", () => {
  it("rebuilds the model's id-less near-Mermaid as canonical Mermaid", () => {
    const out = validDiagram(
      'flowchart TD\n  "DLBCL" --> {"CD10+"}\n  {"CD10+"} -->|Yes| "GCB"\n  {"CD10+"} -->|No| "non-GCB [1]"'
    );
    expect(out).toBe(
      [
        "flowchart TD",
        '  n1["DLBCL"]',
        '  n2{"CD10+"}',
        '  n3["GCB"]',
        '  n4["non-GCB"]',
        "  n1 --> n2",
        "  n2 -->|Yes| n3",
        "  n2 -->|No| n4",
      ].join("\n")
    );
  });

  it("keeps model ids consistent and reads '-- label -->' edges", () => {
    const out = validDiagram(
      'flowchart TD\n  A{"CD10?"} -->|Yes| B["GCB"]\n  A -- No --> C["Next"]'
    )!;
    expect(out).toContain('n1{"CD10?"}');
    expect(out).toContain("n1 -->|No| n3");
  });

  it("drops styling, click handlers and markup; refuses other diagram types and tiny charts", () => {
    const out = validDiagram(
      `${DIAGRAM}\n  click A "javascript:alert(1)"\n  style A fill:#f00\n  D --> E["<b>x</b>"]`
    )!;
    expect(out).not.toMatch(/click|style|javascript|<b>/);
    expect(validDiagram("sequenceDiagram\n A->>B: hi\n B->>A: ok")).toBeNull();
    expect(validDiagram('flowchart TD\n  A["one"] --> B["two"]')).toBeNull();
  });
});

describe("figure and image helpers", () => {
  it("accepts a legend only when most key terms are in it", () => {
    const legend =
      "Decision algorithm described by Hans et al for classifying DLBCL into GCB and ABC";
    expect(legendCovers(legend, ["hans", "algorithm", "dlbcl"])).toBe(true);
    expect(
      legendCovers("Heatmap of gene expression in breast cancer", ["hans", "algorithm", "dlbcl"])
    ).toBe(false);
    expect(legendCovers(legend, [])).toBe(false);
  });

  it("names the diagnosis to look up, not the kind of question", () => {
    expect(imageSubject(["Granular cell tumor", "Schwannoma"], "q")).toBe("Granular cell tumor");
    expect(imageSubject([], "granular cell tumor histology appearance")).toBe(
      "granular cell tumor"
    );
  });

  it("shortens a long legend at a sentence end", () => {
    const s = shortLegend(`${"First sentence is long enough here. ".repeat(6)}Tail words`, 120);
    expect(s.endsWith(".…")).toBe(true);
    expect(s.length).toBeLessThanOrEqual(122);
  });
});

describe("pickImages", () => {
  const im = (alt: string, category = "microscopic") => ({ alt_text: alt, category });

  it("keeps only images whose title names the subject (the clear cell RCC case)", () => {
    const out = pickImages(
      [
        im("ELOC-mutated renal cell carcinoma"),
        im("TFE3-rearranged renal cell carcinoma"),
        im("Clear cell renal cell carcinoma (ccRCC)"),
      ],
      ["clear cell renal cell carcinoma"],
      "Histology of clear cell renal cell carcinoma"
    );
    expect(out.map((x) => x.alt_text)).toEqual(["Clear cell renal cell carcinoma (ccRCC)"]);
  });

  it("puts gross images first when the question asks about gross appearance", () => {
    const out = pickImages(
      [im("Granular cell tumor"), im("Granular cell tumour, cut surface", "gross")],
      ["granular cell tumor"],
      "Gross appearance of granular cell tumor"
    );
    expect(out[0].category).toBe("gross");
    expect(out).toHaveLength(2);
  });

  it("matches an abbreviation in the title's parentheses, and ignores 'on H&E'", () => {
    expect(imageSubject([], "DLBCL H&E")).toBe("DLBCL");
    const out = pickImages(
      [im("Diffuse large B cell lymphoma (DLBCL)"), im("Burkitt lymphoma")],
      ["DLBCL"],
      "Show me what DLBCL looks like on H&E"
    );
    expect(out.map((x) => x.alt_text)).toEqual(["Diffuse large B cell lymphoma (DLBCL)"]);
  });
});

describe("shortCredit", () => {
  it("shows a URL credit as its site, and keeps or trims the rest", () => {
    expect(
      shortCredit(
        "https:-www.virtualpathology.leeds.ac.uk:slides:library:view.php?path=%2FResearch"
      )
    ).toBe("virtualpathology.leeds.ac.uk");
    expect(shortCredit("Pathology Bites")).toBe("Pathology Bites");
    expect(shortCredit("x".repeat(100))!.length).toBe(80);
    expect(shortCredit(null)).toBeNull();
  });
});
