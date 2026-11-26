import { describe, expect, it } from "vitest";
import {
  SITE_GUIDE,
  guideFollowUps,
  matchGuide,
} from "@/features/user/ask-albright/lib/site-guide";

describe("matchGuide — how-to questions find their entry", () => {
  it.each([
    ["How do I create a quiz?", "create-quiz"],
    ["What's the difference between tutor mode and practice mode?", "create-quiz"],
    ["How do I make a timed quiz with only CP questions?", "create-quiz"],
    ["How do I skip a question?", "take-quiz"],
    ["Can I cross out answer choices?", "take-quiz"],
    ["How do I pause a quiz?", "pause-quiz"],
    ["How can I resume my quiz?", "pause-quiz"],
    ["Where can I see my quiz results?", "quiz-review"],
    ["How do I flag a question?", "flag-question"],
    ["I think the answer key is wrong, how do I report a question?", "flag-question"],
    ["How do I bookmark a question?", "favorites"],
    ["Where is my quiz history?", "my-quizzes"],
    ["Can I retake a quiz?", "my-quizzes"],
    ["How do I build a study calendar?", "study-plan-setup"],
    ["How do I add my exam date to the study plan?", "study-plan-setup"],
    ["I fell behind, how do I rebalance my plan?", "study-plan-use"],
    ["How do slide-based questions work?", "wsi-questions"],
    ["How do I zoom in on the slide?", "slide-viewer"],
    ["Where can I find virtual slides of DLBCL?", "virtual-slides"],
    ["How do I use the Anki deck?", "anki"],
    ["How does the cell counter work?", "cell-counter"],
    ["How do I use the IHC panel builder?", "ihc-panel"],
    ["What free tools do you have?", "tools"],
    ["Where can I see my performance analytics?", "performance"],
    ["How do I unlock achievements?", "achievements"],
    ["When will learning modules be available?", "coming-soon"],
    ["How do I change my password?", "profile"],
    ["How do I turn on dark mode?", "settings"],
    ["How do I delete my account?", "delete-account"],
    ["How do I report a bug?", "contact"],
    ["What can you do?", "albright"],
    ["How do I log out?", "sign-in"],
  ])("%j → %s", (q, id) => expect(matchGuide(q)?.id).toBe(id));
});

describe("matchGuide — pathology questions are left alone", () => {
  it.each([
    "What is the IHC profile of synovial sarcoma?",
    "What is the performance of CD30 in classic Hodgkin lymphoma?",
    "What are the phases of the cell cycle?",
    "How do I distinguish PEComa from leiomyosarcoma?",
    "Is pan-cytokeratin positive in epithelioid sarcoma?",
    "What is the Milan system for salivary gland cytopathology?",
    "What does a starry-sky pattern suggest?",
    "Dr. Albright, what is CD30 positive in?",
    "How do I interpret a lupus anticoagulant panel?",
    "How do you grade follicular lymphoma?",
    "What is the contrast between PTC and NIFTP?",
    "How do I count mitoses in GIST?",
    "Which stains separate chromophobe RCC from oncocytoma?",
    "What resources describe the WHO classification of lung tumours?",
  ])("%j", (q) => expect(matchGuide(q)).toBeNull());
});

describe("guide content", () => {
  it("has unique ids, in-site links only, and resolvable related entries", () => {
    const ids = new Set(SITE_GUIDE.map((e) => e.id));
    expect(ids.size).toBe(SITE_GUIDE.length);
    for (const e of SITE_GUIDE) {
      expect(e.href.startsWith("/")).toBe(true);
      for (const [, href] of e.answer.matchAll(/\]\(([^)]+)\)/g)) {
        expect(href, `${e.id}: ${href}`).toMatch(/^\/(?!\/)/);
      }
      for (const r of e.related ?? []) expect(ids.has(r), `${e.id} → ${r}`).toBe(true);
      for (const p of e.phrases) expect(p, `${e.id}: ${p}`).toBe(p.toLowerCase());
    }
  });

  it("each entry's own follow-up question finds that entry", () => {
    for (const e of SITE_GUIDE) expect(matchGuide(e.ask)?.id, e.ask).toBe(e.id);
  });

  it("turns related entries into follow-up questions", () => {
    const e = SITE_GUIDE.find((x) => x.id === "study-plan-setup")!;
    expect(guideFollowUps(e)).toEqual(["How do I rebalance my study plan?"]);
  });
});
