import { describe, it, expect } from "vitest";
import {
  buildAnswerPrompt,
  heuristicSource,
  normalizeQuestion,
  questionTerms,
  relevantExcerpt,
  splitFollowUps,
  hitTokenCap,
  tidyAnswer,
  dropUnaskedGaps,
} from "@/features/user/ask-albright/lib/router";
import { hitsFromFrames, parseSse } from "@/shared/services/pathtalk";

describe("heuristicSource", () => {
  it("routes classification and grading to WHO", () => {
    expect(heuristicSource("WHO grade of meningioma")).toBe("who");
    expect(heuristicSource("Classification of high-grade B-cell lymphoma")).toBe("who");
  });
  it("routes outcomes and studies to PubMed", () => {
    expect(heuristicSource("5-year survival in MSI-high colon cancer")).toBe("pubmed");
    expect(heuristicSource("recent studies on TRPS1")).toBe("pubmed");
  });
  it("defaults to the textbook", () => {
    expect(heuristicSource("Histologic features of Warthin tumor")).toBe("outlines");
  });
  it("does not match 'who' inside other words", () => {
    expect(heuristicSource("Patients whose tumors express CK7")).toBe("outlines");
  });
});

describe("normalizeQuestion", () => {
  it("ignores case, spacing and trailing punctuation", () => {
    expect(normalizeQuestion("  What is  CK7? ")).toBe(normalizeQuestion("what is ck7"));
  });
});

describe("questionTerms", () => {
  it("drops stopwords and duplicates", () => {
    expect(questionTerms("What is the WHO grading of the meningioma grading?")).toEqual([
      "grading",
      "meningioma",
    ]);
  });
});

describe("relevantExcerpt", () => {
  it("leaves short text alone but collapses whitespace", () => {
    expect(relevantExcerpt("a\n\n b   c", "anything", 50)).toBe("a b c");
  });
  it("picks the window about the question, not the head", () => {
    const filler = "Authors and affiliations listed here. ".repeat(20);
    const body = `${filler}Grading: meningiomas are WHO grade 1, 2 or 3 by mitotic count. ${filler}`;
    const out = relevantExcerpt(body, "What is the WHO grading of meningioma?", 120);
    expect(out).toContain("Grading: meningiomas are WHO grade 1, 2 or 3");
    expect(out.startsWith("… ")).toBe(true);
    expect(out.endsWith(" …")).toBe(true);
  });
  it("matches word prefixes, so 'stain' finds 'staining'", () => {
    const body = "x ".repeat(300) + "CK7 staining is diffuse in chromophobe. " + "y ".repeat(300);
    expect(relevantExcerpt(body, "CK7 stain chromophobe", 80)).toContain("CK7 staining is diffuse");
  });
  it("respects the length budget", () => {
    const out = relevantExcerpt("word ".repeat(1000), "word", 100);
    expect(out.length).toBeLessThanOrEqual(104);
  });
});

describe("buildAnswerPrompt", () => {
  it("numbers the sources in order", () => {
    const p = buildAnswerPrompt("Q?", [
      { title: "One", text: "alpha" },
      { title: "Two", text: "beta" },
    ]);
    expect(p).toBe("Sources:\n[1] One: alpha\n[2] Two: beta\n\nQuestion: Q?");
  });
});

describe("PathTalk frame parsing", () => {
  it("unwraps SSE frames and double-encoded hits", () => {
    const hit = { title: "oncocytoma", source: "po", href: "https://x/onco", body: "CK7 patchy" };
    const sse =
      "event: message\n" +
      `data: ${JSON.stringify({ result: { content: [{ type: "text", text: JSON.stringify(hit) }] } })}\n\n`;
    expect(hitsFromFrames(parseSse(sse))).toEqual([hit]);
  });
  it("throws on a tool error frame", () => {
    expect(() => hitsFromFrames([{ error: { message: "bad" } }])).toThrow(/bad/);
  });
  it("throws when no result frame arrived, so a dropped reply is retried, not read as 'no hits'", () => {
    expect(() => hitsFromFrames(parseSse(": keep-alive\n"))).toThrow(/no result frame/);
  });
  it("returns [] for a real empty result", () => {
    const sse = `data: ${JSON.stringify({ result: { content: [] } })}\n`;
    expect(hitsFromFrames(parseSse(sse))).toEqual([]);
  });
});

describe("splitFollowUps", () => {
  it("splits the trailing follow-ups line off the answer", () => {
    expect(
      splitFollowUps("CK7 is diffuse [1].\nFollow-ups: What about S100A1? | Is Hale iron used?")
    ).toEqual({
      answer: "CK7 is diffuse [1].",
      followUps: ["What about S100A1?", "Is Hale iron used?"],
    });
  });
  it("tolerates bold and bullets", () => {
    expect(
      splitFollowUps(
        "Answer.\n\n**Follow-ups:** 1. First question here? | 2. Second question here?"
      ).followUps
    ).toEqual(["First question here?", "Second question here?"]);
  });
  it("splits follow-ups that follow a sentence on the same line", () => {
    expect(
      splitFollowUps("They differ in CD30. Follow-ups: What about MEF2B? | Is OCT2 useful?")
    ).toEqual({
      answer: "They differ in CD30.",
      followUps: ["What about MEF2B?", "Is OCT2 useful?"],
    });
  });

  it("does not cut an answer that mentions follow-up in passing", () => {
    const text = "Patients need follow-up of 5 years [1].";
    expect(splitFollowUps(text)).toEqual({ answer: text, followUps: [] });
  });
  it("returns no follow-ups when the line is missing", () => {
    expect(splitFollowUps("Just an answer.")).toEqual({ answer: "Just an answer.", followUps: [] });
  });
});

describe("tidyAnswer / hitTokenCap", () => {
  it("collapses alignment padding but keeps lines", () => {
    expect(tidyAnswer("| A          | B    |\n| x   | y |   \n\nText.")).toBe(
      "| A | B |\n| x | y |\n\nText."
    );
  });
  it("flags an answer that used its whole budget", () => {
    expect(hitTokenCap(360)).toBe(true);
    expect(hitTokenCap(357)).toBe(true);
    expect(hitTokenCap(200)).toBe(false);
    expect(hitTokenCap(undefined)).toBe(false);
  });
});

describe("dropUnaskedGaps", () => {
  it("drops a trailing unasked 'sources do not mention' sentence after a cited answer", () => {
    expect(
      dropUnaskedGaps("RS cells are CD30+ and CD15+ [1]. The sources do not mention CD99.")
    ).toBe("RS cells are CD30+ and CD15+ [1].");
    expect(
      dropUnaskedGaps(
        "Barrett is columnar metaplasia [1]. The sources do not provide a percentage of cases with goblet cells."
      )
    ).toBe("Barrett is columnar metaplasia [1].");
  });
  it("keeps a whole-answer 'not covered' (nothing cited)", () => {
    const t = "The sources do not discuss TRPS1 in triple-negative carcinoma.";
    expect(dropUnaskedGaps(t)).toBe(t);
  });
});
