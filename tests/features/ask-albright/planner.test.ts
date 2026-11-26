import { describe, it, expect } from "vitest";
import {
  FORMAT_INSTRUCTION,
  CHAT_SYSTEM,
  PLANNER_SYSTEM,
  answerSystem,
  fallbackPlan,
  isChat,
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
      visual: "none",
    });
    expect(parsePlan(raw, Q)).toEqual({
      scope: "ok",
      source: "pubmed",
      fallback: "outlines",
      query: "J chain Hodgkin Reed-Sternberg",
      focus: "J chain status in HRS cells",
      format: "sentence",
      items: [],
      visual: "none",
    });
  });

  it("lets clear wording decide the visual, and the planner add one otherwise", () => {
    const plan = (v: unknown, q = "x y z") => parsePlan(JSON.stringify({ visual: v }), q).visual;
    expect(plan("diagram")).toBe("diagram");
    expect(plan("images")).toBe("images");
    expect(plan("sculpture")).toBe("none");
    // The planner said none; the wording says algorithm.
    expect(plan("none", "Hans algorithm for DLBCL")).toBe("diagram");
    expect(plan(undefined, "Hans algorithm for DLBCL")).toBe("diagram");
    expect(plan(undefined, "What does a granular cell tumor look like?")).toBe("images");
    expect(plan(undefined, "Is CD117 positive in oncocytoma?")).toBe("none");
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

  it("answers a yes/no marker question directly, not as a whole marker profile", () => {
    const marker = JSON.stringify({ format: "marker", query: "x y z" });
    expect(parsePlan(marker, "Is CD117 positive in renal oncocytoma?").format).toBe("sentence");
    expect(parsePlan(marker, "Does TTF-1 stain mesothelioma?").format).toBe("sentence");
    expect(parsePlan(marker, "What does INSM1 immunostaining indicate?").format).toBe("marker");
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
  it("tells the planner a bare eponym or named algorithm is in scope", () => {
    expect(PLANNER_SYSTEM).toMatch(/off_topic only if clearly not/);
    expect(PLANNER_SYSTEM).toMatch(/named algorithm/);
  });

  it("forbids completing a partly stated rule and moving numbers between subjects", () => {
    expect(ANSWER_RULES).toMatch(/never work out the missing branches/);
    expect(ANSWER_RULES).toMatch(/never move a figure/);
  });

  it("puts no concrete findings or numbers in the answer rules (they leak into answers)", () => {
    // "positive in 9 of 10 cases", meant as an example, came back as an HPV table cell.
    expect(ANSWER_RULES.replace(/\[\d\]/g, "")).not.toMatch(/\d/);
  });

  it("treats joke requests as chat, and keeps the joke rules in the persona", () => {
    for (const q of [
      "Tell me a joke",
      "Tell me something funny",
      "Can you tell me a pathology joke?",
      "Tell me a joke about pathology residents please",
      "Make me laugh",
      "Got any jokes?",
      "Another pun",
    ])
      expect(isChat(q)).toBe(true);
    expect(isChat("Tell me something about CD30")).toBe(false);
    expect(isChat("Is a joke stain a real thing in histotechnology labs today?")).toBe(false);
    // Jokes come from the list, so the model is never asked for one.
    expect(CHAT_SYSTEM).not.toMatch(/joke/i);
  });

  it("treats questions about what Dr. Albright is as chat", () => {
    for (const q of [
      "What are you?",
      "What is Dr. Albright?",
      "What can you do?",
      "How do you work?",
      "How does this work?",
      "Are you an AI?",
      "Are you a real doctor?",
      "What is this?",
    ])
      expect(isChat(q)).toBe(true);
    expect(isChat("What is this lesion?")).toBe(false);
    expect(isChat("What is it that stains with CD117 in GIST?")).toBe(false);
    expect(CHAT_SYSTEM).toMatch(/you are a neuron/);
    // "Dr." and "MD" both say physician: chat uses "Dr. <name>"; the About page uses "<name>, MD".
    expect(CHAT_SYSTEM).toMatch(/founded by Dr\. Juan Jose Sanchez Ramirez, a hematopathology/);
    expect(CHAT_SYSTEM).not.toMatch(/Sanchez Ramirez, MD/);
    expect(CHAT_SYSTEM).toMatch(/you are an AI assistant, not a person or a real doctor/);
  });

  it("treats short small talk and questions about the site as chat, nothing else", () => {
    for (const q of ["Hi", "Hey there", "How are you?", "What's on your mind?", "Thanks!"])
      expect(isChat(q)).toBe(true);
    expect(isChat("Who developed this site? I really like the question bank")).toBe(true);
    for (const q of [
      "Histology of Barrett esophagus",
      "Yolk sac tumor IHC",
      "What is this lesion?",
      "Hi, what does a granular cell tumor look like on H&E?",
    ])
      expect(isChat(q)).toBe(false);
    expect(parsePlan(JSON.stringify({ scope: "off_topic" }), "Hey").scope).toBe("chat");
    // The planner can't turn a pathology question into small talk.
    expect(
      parsePlan(
        JSON.stringify({ scope: "chat" }),
        "What does diffuse large B-cell lymphoma look like?"
      ).scope
    ).toBe("ok");
  });

  it("allows one visual only: a table, or a diagram/images/figure", () => {
    // Asked for an algorithm, planned as a table: the diagram wins, without a table.
    const algo = parsePlan(JSON.stringify({ format: "table" }), "Algorithm for MMR testing");
    expect(algo.visual).toBe("diagram");
    expect(algo.format).not.toBe("table");
    // Asked for a comparison: the table wins, no diagram.
    const cmp = parsePlan(
      JSON.stringify({ format: "table", items: ["A x", "B y"] }),
      "Compare the workup of A vs B"
    );
    expect(cmp).toMatchObject({ visual: "none", format: "table" });
  });
});
