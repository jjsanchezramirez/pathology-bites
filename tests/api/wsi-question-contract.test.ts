/**
 * The contract a generated question has to satisfy before it reaches a reader.
 *
 * These are not style preferences — each one was measured failing in a batch of
 * 80 generated questions, and each defeats the point of a slide-based question:
 * a stem that names the entity or narrates the morphology can be answered
 * without the slide, and immunophenotype options built from different marker
 * sets can be told apart without it too.
 *
 * Enforcement runs inside the parse step, so a violation falls through to the
 * next model rather than reaching the reader.
 */
import { describe, it, expect } from "vitest";

import {
  enforceQuestionContract,
  parseAndValidateQuestionFast,
} from "@/app/api/user/wsi-questions/generate/wsi-question-parsing";

const options = (texts: string[]) =>
  texts.map((text, i) => ({
    id: String(i),
    text,
    is_correct: i === 0,
    explanation: "",
  }));

const question = (
  stem: string,
  texts = ["Follicular lymphoma", "Mantle cell", "DLBCL", "MZL", "Burkitt lymphoma"]
) => ({ stem, options: options(texts) }) as Parameters<typeof enforceQuestionContract>[0];

describe("enforceQuestionContract", () => {
  it("accepts a stem that presents the case without describing the slide", () => {
    const q = question(
      "A 58-year-old woman presents with painless cervical lymphadenopathy for three months. " +
        "An excisional biopsy is performed and the slide is shown. What is the most likely diagnosis?"
    );
    expect(() => enforceQuestionContract(q, "Follicular lymphoma")).not.toThrow();
  });

  it("rejects a stem that narrates the sections", () => {
    const q = question(
      "A 30-year-old man presents with a soft tissue mass. The H&E-stained sections show a " +
        "poorly circumscribed, infiltrative spindle cell neoplasm. What is the most likely diagnosis?"
    );
    expect(() => enforceQuestionContract(q, "Sclerosing rhabdomyosarcoma")).toThrow(
      /describes the microscopy/i
    );
  });

  it("rejects a specimen narrating itself", () => {
    const q = question(
      "A 62-year-old man has fatigue. The biopsy shows sheets of large cells with prominent " +
        "nucleoli. What is the most likely diagnosis?"
    );
    expect(() => enforceQuestionContract(q, "Diffuse large B-cell lymphoma")).toThrow(
      /describes the microscopy/i
    );
  });

  it("rejects narrating the specimen that IS the slide", () => {
    const q = question(
      "A 4-year-old boy has pallor and bruising. A peripheral blood smear shows numerous " +
        "blasts. What is the most likely diagnosis?"
    );
    expect(() =>
      enforceQuestionContract(q, "B-lymphoblastic leukaemia", "peripheral blood smear")
    ).toThrow(/describes the microscopy/i);
  });

  it("allows findings from a DIFFERENT specimen as history", () => {
    // The reader is looking at a trephine; they cannot see the film, so what the
    // film showed is context — the same sentence that would be a giveaway over a
    // smear is ordinary haematology history here.
    const q = question(
      "A 68-year-old man has pancytopenia. The peripheral blood smear shows occasional " +
        "blasts. A trephine biopsy is shown. What is the most likely diagnosis?"
    );
    expect(() =>
      enforceQuestionContract(q, "Myelodysplastic neoplasm", "bone marrow trephine biopsy")
    ).not.toThrow();
  });

  it("rejects narration whose words are in no morphology lexicon", () => {
    // The reported failure. A word-list check passed this: "nodular architecture
    // with expanded mantle zones" contains no spindle, nuclei, mitoses or
    // necrosis. What gives it away is grammatical — the biopsy SHOWS something.
    const q = question(
      "A 45-year-old man presents with an isolated, enlarging cervical lymph node. Excisional " +
        "biopsy shows a nodular architecture with expanded mantle zones on H&E (slide provided). " +
        "Which genetic alteration is most characteristic of this entity?"
    );
    expect(() => enforceQuestionContract(q, "Castleman disease")).toThrow(
      /describes the microscopy/i
    );
  });

  it("allows the slide to be handed over without being described", () => {
    for (const closing of [
      "and the slide is shown.",
      "The slide is shown below.",
      "A slide is provided for review.",
      "The H&E-stained section is shown.",
    ]) {
      const q = question(
        `A 58-year-old woman has cervical lymphadenopathy. ${closing} What is the most likely diagnosis?`
      );
      expect(() => enforceQuestionContract(q, "Follicular lymphoma")).not.toThrow();
    }
  });

  it("rejects a stem that reports the answer's own gene", () => {
    // The reported failure: "Molecular testing reveals a JAK2 mutation" with
    // JAK2 p.V617F as the key. The reader has nothing left to do.
    const q = question(
      "A 62-year-old woman presents with a platelet count of 800 x 10^9/L. Molecular testing " +
        "reveals a JAK2 mutation. Which genetic alteration is most characteristic of this entity?",
      ["JAK2 p.V617F", "t(9;22)(q34;q11.2); BCR::ABL1", "CALR exon 9 mutation", "MPL W515L"]
    );
    expect(() => enforceQuestionContract(q, "Essential thrombocythaemia")).toThrow(
      /names the answer's own symbol/i
    );
  });

  it("rejects a stem that lists the markers an immunophenotype answer contains", () => {
    const q = question(
      "A 58-year-old man has lymphadenopathy. Immunohistochemistry shows CD20+, CD10+, BCL2+. " +
        "Which immunophenotype is most consistent with this case?",
      [
        "CD20+, CD10+, BCL2+, BCL6+, CD5-",
        "CD20+, CD10-, BCL2+, BCL6+, CD5-",
        "CD20+, CD10-, BCL2-, BCL6+, CD5+",
        "CD20+, CD10+, BCL2-, BCL6-, CD5-",
      ]
    );
    expect(() => enforceQuestionContract(q, "Follicular lymphoma")).toThrow(
      /names the answer's own symbol/i
    );
  });

  it("does not mistake a results report for narration", () => {
    // Widening the specimen subjects to catch "peripheral blood shows..." also
    // matched "Immunohistochemistry on the specimen shows CD20+..." on the word
    // "specimen" — rejecting the very sentence a molecular question needs.
    const q = question(
      "A 62-year-old man has fatigue. Immunohistochemistry on the specimen shows CD20+, CD19+, " +
        "CD79a+, PAX5+, CD45+. Which genetic alteration is most characteristic of this entity?",
      ["MYD88 L265P", "BRAF V600E", "JAK2 V617F", "CALR exon 9", "KIT D816V"]
    );
    expect(() => enforceQuestionContract(q, "Lymphoplasmacytic lymphoma")).not.toThrow();
  });

  it("leaves immunohistochemistry results alone — molecular stems require them", () => {
    // "Immunohistochemistry shows CD30+, ALK-" is the workup, not the slide, and
    // without it a molecular question is unanswerable from an H&E.
    const q = question(
      "A 22-year-old man presents with lymphadenopathy. Immunohistochemistry shows CD2+, CD5+, " +
        "clusterin+, EMA+, ALK-. Which genetic alteration is most characteristic of this entity?",
      ["DUSP22 rearrangement", "ALK fusion", "TP53 mutation", "JAK2 V617F"]
    );
    expect(() =>
      enforceQuestionContract(q, "ALK-negative anaplastic large cell lymphoma")
    ).not.toThrow();
  });

  it("closes the narration phrasings that slipped past a smear/aspirate word list", () => {
    // Both were found passing in an audit: the subject list knew "smear" and
    // "aspirate" but not the tissue on its own.
    for (const [sentence, specimen] of [
      ["Peripheral blood shows numerous circulating blasts.", "peripheral blood smear"],
      ["Bone marrow examination reveals sheets of atypical cells.", "bone marrow aspirate smear"],
      [
        "Bone-marrow biopsy shows hypercellularity with dysplastic megakaryocytes.",
        "bone marrow specimen",
      ],
    ] as const) {
      const q = question(
        `A 62-year-old man has pancytopenia. ${sentence} What is the most likely diagnosis?`
      );
      expect(() => enforceQuestionContract(q, "Myelodysplastic neoplasm", specimen)).toThrow(
        /describes the microscopy/i
      );
    }
  });

  it("requires exactly five options at the parse step", () => {
    // "At least four" let a six-option question through whose extra option was a
    // second true alteration, presented as a distractor and marked wrong.
    const withOptions = (n: number) =>
      JSON.stringify({
        stem: "A patient has a mass. What is the most likely diagnosis?",
        answer_options: Array.from({ length: n }, (_, i) => ({
          text: `Option ${i}`,
          is_correct: i === 0,
          explanation: "because",
        })),
      });

    expect(() => parseAndValidateQuestionFast(withOptions(6))).toThrow(/exactly 5/i);
    expect(() => parseAndValidateQuestionFast(withOptions(4))).toThrow(/exactly 5/i);
    expect(() => parseAndValidateQuestionFast(withOptions(5))).not.toThrow();
  });

  it("leaves clinical and laboratory findings alone", () => {
    // History is what a stem is FOR; only the slide may not be described.
    const q = question(
      "A 62-year-old man presents with erythroderma and pruritus. Laboratory studies reveal a " +
        "leukocytosis with circulating atypical lymphocytes, and imaging shows lymphadenopathy. " +
        "What is the most likely diagnosis?"
    );
    expect(() => enforceQuestionContract(q, "Sezary syndrome")).not.toThrow();
  });

  it("rejects a stem naming the entity, including a descriptive name", () => {
    const q = question(
      "A 34-year-old woman presents with a breast lump after trauma. Microscopy shows fat " +
        "necrosis. Which immunophenotype is most consistent with this case?"
    );
    expect(() => enforceQuestionContract(q, "Fat necrosis")).toThrow(/names the entity/i);
  });

  it("rejects duplicate options", () => {
    const q = question("A patient presents with a mass. What is the most likely diagnosis?", [
      "Follicular lymphoma",
      "Mantle cell lymphoma",
      "Follicular lymphoma",
      "DLBCL",
    ]);
    expect(() => enforceQuestionContract(q, "Follicular lymphoma")).toThrow(/duplicate/i);
  });

  it("rejects immunophenotype options built from different marker sets", () => {
    const q = question("A patient presents with a mass. Which immunophenotype fits?", [
      "CD20+, CD10+, BCL2+, BCL6+, CD5-",
      "CD20+, CD10-, BCL2+, BCL6+, CD5-",
      "CD3+, CD5+, CD7-, CD4+, CD8-",
      "CD20+, CD10-, BCL2-, BCL6+, CD5+",
    ]);
    expect(() => enforceQuestionContract(q, "Follicular lymphoma")).toThrow(/marker set/i);
  });

  it("accepts immunophenotype options that share one marker set", () => {
    const q = question("A patient presents with a mass. Which immunophenotype fits?", [
      "CD20+, CD10+, BCL2+, BCL6+, CD5-",
      "CD20+, CD10-, BCL2+, BCL6+, CD5-",
      "CD20+, CD10-, BCL2-, BCL6+, CD5+",
      "CD20+, CD10+, BCL2-, BCL6-, CD5-",
    ]);
    expect(() => enforceQuestionContract(q, "Follicular lymphoma")).not.toThrow();
  });
});
