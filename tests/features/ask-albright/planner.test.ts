import { describe, it, expect } from "vitest";
import {
  FORMAT_INSTRUCTION,
  PLANNER_SYSTEM,
  answerSystem,
  fallbackPlan,
  namesMarker,
  parsePlan,
} from "@/features/user/ask-albright/lib/planner";
import { ANSWER_RULES } from "@/features/user/ask-albright/lib/router";

const Q = "Is J chain expressed by Hodgkin/Reed-Sternberg cells?";

describe("parsePlan", () => {
  it("accepts a well-formed plan", () => {
    const raw = JSON.stringify({
      scope: "ok",
      source: "pubmed",
      fallback: "outlines",
      query: "J chain Hodgkin Reed-Sternberg",
      focus: "J chain status in HRS cells",
      format: "sentence",
      items: [],
    });
    expect(parsePlan(raw, Q)).toEqual({
      scope: "ok",
      source: "pubmed",
      fallback: "outlines",
      query: "J chain Hodgkin Reed-Sternberg",
      focus: "J chain status in HRS cells",
      format: "sentence",
      items: [],
    });
  });

  it("only allows a table for real comparisons", () => {
    const table = JSON.stringify({ format: "table", query: "CD117 oncocytoma" });
    expect(parsePlan(table, "Is CD117 positive in renal oncocytoma?").format).toBe("sentence");
    expect(parsePlan(table, "Immunophenotype of oncocytoma").format).toBe("paragraph");
    expect(parsePlan(table, "CK7 vs CD117 in oncocytoma").format).toBe("table");
    expect(
      parsePlan(table, "Are MEF2B and J chain useful in distinguishing NLPHL from CHL?").format
    ).toBe("sentence");
    expect(parsePlan(table, "Is there a table of CK7 vs CK20 patterns?").format).toBe("table");
    const items = JSON.stringify({ format: "table", items: ["CHL", "NLPHL"] });
    expect(parsePlan(items, "CHL and NLPHL markers").format).toBe("table");
  });

  it("uses the marker shape only when the question names a marker", () => {
    const marker = JSON.stringify({ format: "marker", query: "x y z" });
    expect(parsePlan(marker, "what does CD99 stain").format).toBe("marker");
    expect(parsePlan(marker, "TTF-1 positive tumors").format).toBe("marker");
    expect(parsePlan(marker, "desmin positive tumors").format).toBe("marker");
    expect(parsePlan(marker, "Reed Sternberg cell markers").format).toBe("bullets");
    expect(namesMarker("Reed Sternberg cell markers")).toBe(false);
  });

  it("turns an explicit 'X vs Y' into a table, but not a yes/no question", () => {
    const para = JSON.stringify({ format: "paragraph", query: "x y z" });
    expect(parsePlan(para, "necrotizing vs non necrotizing granuloma causes").format).toBe("table");
    expect(parsePlan(para, "Is CK7 better vs CD10?").format).toBe("paragraph");
  });

  it("keeps up to four compared items, dropping junk", () => {
    const plan = parsePlan(
      JSON.stringify({
        items: ["Classic Hodgkin lymphoma", 3, "", "Primary mediastinal large B-cell lymphoma"],
      }),
      Q
    );
    expect(plan.items).toEqual([
      "Classic Hodgkin lymphoma",
      "Primary mediastinal large B-cell lymphoma",
    ]);
  });

  it("finds the JSON inside chatter or a code fence", () => {
    const raw =
      'Sure:\n```json\n{"scope":"off_topic","source":"who","query":"x x x","format":"sentence"}\n```';
    expect(parsePlan(raw, Q).scope).toBe("off_topic");
  });

  it("repairs bad fields one by one", () => {
    const plan = parsePlan('{"scope":"maybe","source":"google","query":"ab","format":"poem"}', Q);
    expect(plan.scope).toBe("ok");
    expect(plan.source).toBe(fallbackPlan(Q).source);
    expect(plan.query).toBe(Q);
    expect(plan.format).toBe(fallbackPlan(Q).format);
  });

  it("never lets the fallback corpus equal the first", () => {
    const plan = parsePlan('{"source":"pubmed","fallback":"pubmed","query":"abc def"}', Q);
    expect(plan.fallback).not.toBe("pubmed");
  });

  it("returns the fallback plan for non-JSON", () => {
    expect(parsePlan("I think WHO", Q)).toEqual(fallbackPlan(Q));
  });
});

describe("fallbackPlan", () => {
  it("searches as asked, guessing the corpus from keywords", () => {
    expect(fallbackPlan("What is the WHO grade of atypical meningioma?")).toMatchObject({
      scope: "ok",
      source: "who",
      query: "What is the WHO grade of atypical meningioma?",
    });
  });
  it("asks for a table when the question compares", () => {
    expect(fallbackPlan("Compare CK7 in chromophobe vs oncocytoma").format).toBe("table");
  });
});

describe("planner prompt and answer system", () => {
  it("tells the planner never to answer in the focus", () => {
    expect(PLANNER_SYSTEM).toMatch(/Never state an answer/);
  });
  it("adds the planned format to the shared answer rules", () => {
    expect(answerSystem("bullets")).toBe(`${ANSWER_RULES} ${FORMAT_INSTRUCTION.bullets}`);
  });
  it("puts no concrete findings or numbers in the answer rules (they leak into answers)", () => {
    // "positive in 9 of 10 cases", meant as an example, came back as an HPV table cell.
    expect(ANSWER_RULES.replace(/\[\d\]/g, "")).not.toMatch(/\d/);
  });
});
