import { describe, it, expect } from "vitest";
import { keyTerms, mergeByHref, rankPages } from "@/features/user/ask-albright/lib/rank";

describe("keyTerms", () => {
  it("keeps the subject, drops the kind-of-answer words", () => {
    expect(keyTerms("Are MEF2B and J chain useful in the diagnosis of NLPHL?")).toEqual([
      "mef2b",
      "chain",
      "nlphl",
    ]);
  });
});

describe("mergeByHref", () => {
  it("joins chunks of one page and ranks pages within each source", () => {
    const pages = mergeByHref([
      { source: "outlines", title: "A", href: "a", body: "one" },
      { source: "outlines", title: "A", href: "a", body: "two" },
      { source: "outlines", title: "B", href: "b", body: "three" },
      { source: "who", title: "W", href: "w", body: "four" },
    ]);
    expect(pages).toEqual([
      { source: "outlines", title: "A", href: "a", body: "one … two", rank: 0 },
      { source: "outlines", title: "B", href: "b", body: "three", rank: 1 },
      { source: "who", title: "W", href: "w", body: "four", rank: 0 },
    ]);
  });
});

describe("rankPages", () => {
  const page = (source: "outlines" | "who" | "pubmed", href: string, body: string, rank = 0) => ({
    source,
    title: href,
    href,
    body,
    rank,
  });

  it("weights rare terms: the page naming MEF2B beats three that only say NLPHL", () => {
    const ranked = rankPages(
      [
        page("outlines", "po1", "NLPHL LP cells CD20 OCT2"),
        page("outlines", "po2", "NLPHL IgD subset", 1),
        page("who", "who", "NLPHL: MEF2B is expressed in LP cells"),
        page("pubmed", "pm", "J chain and MEF2B in NLPHL vs CHL"),
      ],
      "Are MEF2B and J chain useful in the diagnosis of NLPHL?",
      "outlines"
    );
    expect(ranked.map((p) => p.href)).toEqual(["pm", "who", "po1", "po2"]);
  });

  it("matches whole-word prefixes only", () => {
    // "chain" must not match inside "unchained"; "mef2b" must match "MEF2B-positive".
    const ranked = rankPages(
      [page("outlines", "x", "unchained"), page("who", "y", "MEF2B-positive cells")],
      "mef2b chain",
      "outlines"
    );
    expect(ranked[0].href).toBe("y");
  });

  it("lets the router's pick break ties", () => {
    const pages = [
      page("outlines", "po", "meningioma grade"),
      page("who", "who", "meningioma grade"),
    ];
    expect(rankPages(pages, "meningioma grade", "who")[0].href).toBe("who");
    expect(rankPages(pages, "meningioma grade", "outlines")[0].href).toBe("po");
  });
});
