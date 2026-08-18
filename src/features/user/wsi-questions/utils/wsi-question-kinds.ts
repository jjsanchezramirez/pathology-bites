/**
 * Question kinds for slide-based questions, and the prompts behind them.
 *
 * Ported from /debug/wsi-question-lab after it proved the approach. The single
 * idea that matters: for IHC and molecular questions the correct answer is
 * SUPPLIED, not requested. Each PathPresenter case carries the author's own
 * immuno/molecular notes, and a model asked to invent both the question and its
 * own correct answer writes something plausible and wrong — with nothing
 * downstream able to catch it.
 */

import type { VirtualSlide } from "@/shared/types/virtual-slides";
import {
  buildImmunoOptions,
  hasUsableMolecularProfile,
  sanitizeHistory,
} from "./wsi-question-options";

export type WsiQuestionKind = "diagnosis" | "ihc" | "molecular";

export const WSI_QUESTION_KINDS: Array<{
  id: WsiQuestionKind;
  label: string;
  /** For the control bar, where three toggles share a row. */
  short: string;
  /** For a phone, where that row also holds a select, a switch and a button. */
  tiny: string;
  blurb: string;
}> = [
  {
    id: "diagnosis",
    label: "Diagnosis",
    short: "Diagnosis",
    tiny: "Dx",
    blurb: "Identify the entity from the slide",
  },
  {
    id: "ihc",
    label: "Immunohistochemistry",
    short: "IHC",
    tiny: "IHC",
    blurb: "Pick the immunophenotype that fits",
  },
  {
    id: "molecular",
    label: "Molecular",
    short: "Molecular",
    tiny: "Mol",
    blurb: "Pick the defining genetic alteration",
  },
];

export const WSI_KINDS_STORAGE_KEY = "wsi-question-kinds";

/** The set a reader starts with, and what an empty selection falls back to. */
export const DEFAULT_WSI_KINDS: WsiQuestionKind[] = ["diagnosis"];

/**
 * Pick which kind of question this slide gets, among the ones the reader has
 * enabled. Random rather than ordered: with diagnosis and IHC both on, a fixed
 * order would mean every slide recording an immunoprofile always came back as
 * an IHC question and the reader would never see it asked the other way.
 */
export function chooseKind(
  slide: VirtualSlide,
  enabled: WsiQuestionKind[],
  random: () => number = Math.random
): WsiQuestionKind {
  const usable = enabled.filter((k) => slideSupportsKind(slide, k));
  if (usable.length === 0) return "diagnosis";
  return usable[Math.floor(random() * usable.length)];
}

function meta(slide: VirtualSlide): Record<string, unknown> {
  return (slide.source_metadata ?? {}) as Record<string, unknown>;
}

function field(slide: VirtualSlide, key: string): string {
  return String(meta(slide)[key] ?? "").trim();
}

export function immunoProfile(slide: VirtualSlide): string {
  return field(slide, "immuno_profile");
}
export function molecularProfile(slide: VirtualSlide): string {
  return field(slide, "molecular_profile");
}
export function differentialDx(slide: VirtualSlide): string {
  return field(slide, "differential_diagnosis");
}

/**
 * Where the immuno/molecular text came from, which changes what a stem may claim.
 *
 * PathPresenter cases carry the author's notes on the case in front of you, so a
 * stem can present them as this patient's workup. The curated haematolymphoid
 * cases instead borrow WHO's account of the ENTITY — accurate, but not results
 * anyone ran on this specimen, and a stem that reports them as such is inventing
 * a workup.
 */
function profileIsEntityLevel(slide: VirtualSlide): boolean {
  return field(slide, "profile_source") === "who-entity";
}

/**
 * Can this slide carry this kind of question? Diagnosis always works; the other
 * two need the case to actually record the answer.
 */
export function slideSupportsKind(slide: VirtualSlide, kind: WsiQuestionKind): boolean {
  if (kind === "diagnosis") return true;
  // IHC asks the reader to pick a phenotype, so the case must HAVE one — five
  // options over a shared marker set have to be constructible from it. Length
  // alone let notes through: PathPresenter's field is free text, and "CD68
  // positive histiocytes" or "consider Gram, AFB, and GMS stains" was being
  // handed to the writer as the answer key.
  if (kind === "ihc") return buildImmunoOptions(immunoProfile(slide)) !== null;
  // Molecular needs an alteration to key on, not merely 12 characters of text:
  // "No specific or diagnostic molecular abnormaility" passed the old length
  // check and became the correct answer.
  return hasUsableMolecularProfile(molecularProfile(slide));
}

const JSON_SHAPE = (suppliedOptions: string[] | null) => `Return ONLY this JSON:
{
  "title": "Brief descriptive title",
  "stem": "Clinical scenario ending in the question",
  "difficulty": "easy|medium|hard",
  "teaching_point": "1-2 sentence key learning point.",
  "suggested_tags": ["Tag1", "Tag2"],
  "question_references": "Relevant citations",
  "status": "draft",
  "answer_options": [
${
  suppliedOptions
    ? suppliedOptions
        .map(
          (text, i) =>
            `    { "text": ${JSON.stringify(text)}, "is_correct": ${i === 0}, "explanation": "...", "order_index": ${i} }`
        )
        .join(",\n")
    : `    { "text": "...", "is_correct": false, "explanation": "...", "order_index": 0 },
    { "text": "...", "is_correct": true,  "explanation": "...", "order_index": 1 },
    { "text": "...", "is_correct": false, "explanation": "...", "order_index": 2 },
    { "text": "...", "is_correct": false, "explanation": "...", "order_index": 3 },
    { "text": "...", "is_correct": false, "explanation": "...", "order_index": 4 }`
}
  ]
}${suppliedOptions ? "\n\nCopy the option texts and is_correct flags above EXACTLY. Write only the explanations." : ""}`;

/**
 * The constraints a model has to be told, and only those.
 *
 * Everything checkable is checked in code instead (see enforceQuestionContract):
 * duplicate options, the entity in the stem, one marker set per immunophenotype
 * question, narration of the slide, the answer's own gene symbols leaking into
 * the stem. Repeating them here bought nothing — the prompt had grown to ~800
 * words with a rules list, then a checklist restating the same rules, then an
 * argument about which rule was most violated.
 */
const RULES = `NEVER:
- Name the entity, an abbreviation of it, or a near-synonym, anywhere in the stem.
- Describe what the slide looks like. The reader is looking at it; narrating it turns a slide
  question into reading comprehension.
- Report a study that is not given above — no FISH, karyotype, flow cytometry or sequencing
  result. Inventing one is how a stem ends up contradicting the case ("FISH reveals no IRF4
  translocation" on an IRF4-rearranged lymphoma).
- Contradict the specimen, or name one when none is stated.

ALWAYS:
- Keep the stem under 120 words: presentation, relevant clinical findings, then the question.
- Give every option a 1-2 sentence explanation naming the entity it belongs to.`;

function siteIsReliable(slide: VirtualSlide): boolean {
  const repository = (slide.repository || "PathPresenter").trim();
  return repository === "PathPresenter";
}

/**
 * What the reader is looking at, in the words a stem would use.
 *
 * Without it the writer invents a procedure — for Sezary syndrome it wrote "a
 * skin punch biopsy is performed" over a peripheral blood smear. The site is
 * only used as a fallback for PathPresenter, whose organ comes from the case's
 * own chapter; the curated cases inherit an unreliable one (a Leeds ALCL whose
 * history reads "generalised lymphadenopathy" is filed under Bone Marrow).
 */
function specimenLine(slide: VirtualSlide): string {
  const specimen = String(meta(slide)["specimen"] ?? "").trim();
  const stain = (slide.stain_type || "").trim();
  const described =
    specimen || (siteIsReliable(slide) && slide.subcategory ? `${slide.subcategory} specimen` : "");

  // Always say SOMETHING about the slide. Curated cases often record no specimen
  // and have an unusable site, which left this line empty — and a writer with no
  // way to say what is on screen narrates it instead ("a skin biopsy shows a
  // dense infiltrate..."). Haem cases failed the narration check three times as
  // often as PathPresenter ones for exactly this reason. The stain alone is
  // enough to anchor a stem, and it is always known.
  if (!described) {
    return stain
      ? `Specimen shown: a ${stain}-stained slide (the preparation is not recorded — refer to it only as "the slide")`
      : `Specimen shown: not recorded — refer to it only as "the slide"`;
  }

  return `Specimen shown: ${described}${stain ? `, stained ${stain}` : ""}`;
}

function caseHeader(slide: VirtualSlide): string {
  // Only state demographics the slide actually carries. Defaulting to "Adult"
  // produced a 34-year-old with juvenile myelomonocytic leukaemia — the model
  // takes a supplied age literally even when the entity is paediatric.
  const demographics = [
    slide.age ? `Age: ${slide.age}` : null,
    slide.gender ? `Sex: ${slide.gender}` : null,
  ].filter(Boolean);

  // Stripped in code rather than by instruction: sources write microscopy into
  // the history field, and telling a writer to draw on a description while
  // forbidding it from describing the slide is two instructions in conflict.
  const history = sanitizeHistory(slide.clinical_history || "", slide.diagnosis || "");
  const specimen = specimenLine(slide);
  const differential = differentialDx(slide);

  return [
    "CASE",
    `Entity (the answer — never appears in the stem): ${slide.diagnosis || "Not specified"}`,
    `Chapter: ${slide.category || "Not specified"}`,
    siteIsReliable(slide) && slide.subcategory ? `Organ: ${slide.subcategory}` : "",
    specimen,
    demographics.length
      ? demographics.join(", ")
      : "Demographics: not recorded — invent an age and sex typical for this entity (a paediatric entity needs a child).",
    history ? `Clinical: ${history}` : "",
    differential ? `Published differential: ${differential}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildWsiQuestionPrompt(
  slide: VirtualSlide,
  kind: WsiQuestionKind,
  /** Real alterations from the same chapter, offered as distractor material. */
  candidateAlterations: string[] = []
): string {
  if (kind === "ihc") {
    // Options are built here, not requested in prose: five over one marker set,
    // differing only in signs. Asking for that shape was the most-violated
    // instruction in the whole prompt (11 of 16 questions broke it).
    const built = buildImmunoOptions(immunoProfile(slide));

    return `Write a board-style immunohistochemistry question. The reader sees the slide and must
pick the immunophenotype that fits it.

${caseHeader(slide)}

IMMUNOPHENOTYPE ${
      profileIsEntityLevel(slide)
        ? "of this entity, from the WHO classification"
        : "recorded for this case"
    } (authoritative as far as it goes; not an exhaustive panel):
${immunoProfile(slide)}

${
  built
    ? `The five options are already written for you below — option A is correct. Your job is the
stem and the explanations. Each distractor is one or two sign-flips from the truth: say which
entity that pattern belongs to.`
    : `Build five options from ONE marker set in ONE order, differing only in the +/- signs, e.g.
"CD20+, CD10+, BCL2+, BCL6+, CD5-". Every distractor must be a real entity's phenotype.`
}
- End the stem with "Which immunophenotype is most consistent with this case?"
- The stem may describe the presentation, but must not list immunostain results — those are the
  answer.

${RULES}

${JSON_SHAPE(built ? built.options : null)}`;
  }

  if (kind === "molecular") {
    return `Write a board-style molecular/cytogenetics question. The reader sees the slide and the
immunophenotype, and must pick the alteration that defines the entity.

${caseHeader(slide)}

GENETICS ${
      profileIsEntityLevel(slide)
        ? "of this entity, from the WHO classification (alterations marked defining or diagnostic are the answer)"
        : "recorded for this case"
    }:
${molecularProfile(slide)}
${
  immunoProfile(slide)
    ? `
IMMUNOPHENOTYPE — put this in the stem as the case's immunohistochemistry:
${immunoProfile(slide)}

Morphology alone does not get a reader from an H&E to a named alteration; the phenotype is what
narrows it to one entity. Report only these markers, and omit any whose gene appears in the
correct answer.`
    : `
No immunophenotype is recorded — build the stem from the clinical presentation alone.`
}
- The correct option is the alteration above, in standard nomenclature ("t(8;21)(q22;q22);
  RUNX1::RUNX1T1"). Copy what is given: do NOT add codon numbers, variant coordinates or
  percentages that are not in the text. A frequency like "(seen in ~57%)" is a prevalence, not a
  variant — reading it as one produced a fabricated "MAP2K1 p.K57N".
- Each option is the alteration and nothing else: "t(11;14)(q13;q32); IGH::CCND1". No commentary,
  no "— seen in mantle cell lymphoma", no "— recurrent but not pathognomonic". That belongs in
  the explanation. An option carrying a comment the others lack is pickable without the slide.
- The four distractors must be alterations of entities in THIS case's differential — same organ,
  same chapter, the tumours a pathologist would actually be deciding between. Stock
  haematolymphoid translocations (RUNX1::RUNX1T1, IGH::BCL2, IGH::CCND1, ETV6::RUNX1) under a
  breast or soft-tissue case are not distractors; nobody weighing a breast mass considers them,
  and they mark the odd option out as the answer. Never invent a fusion.${
    candidateAlterations.length
      ? `

REAL ALTERATIONS FROM THIS CHAPTER — draw your four distractors from here. Each is another
entity's defining alteration, named in brackets; drop the brackets when you write the option.
${candidateAlterations.map((a) => `  ${a}`).join("\n")}`
      : ""
  }
- End the stem with "Which genetic alteration is most characteristic of this entity?"

${RULES}

${JSON_SHAPE(null)}`;
  }

  const molecular = molecularProfile(slide);
  const immuno = immunoProfile(slide);

  return `Write a board-style diagnostic question. The reader sees the slide and must name the entity.

${caseHeader(slide)}
${
  immuno || molecular
    ? `
REFERENCE DATA — for the explanations, not the stem:
${immuno ? `Immunophenotype: ${immuno}` : ""}${molecular ? `\nGenetics: ${molecular}` : ""}`
    : ""
}
- The correct option is "${slide.diagnosis || "the recorded diagnosis"}". The four distractors must
  be genuine morphologic mimics.
- The clinical history must not be pathognomonic. If the presentation alone identifies the entity
  — "25-year history of refractory pyothorax", "ulcerative colitis with beaded biliary strictures"
  — the slide is decorative and the question tests recall of an association. Give the presentation
  that brings the patient in, and let the slide do the discriminating.
- End the stem with "What is the most likely diagnosis?"
- Explanations should cite the discriminating histologic features${
    immuno ? " and, where useful, the immunophenotype above" : ""
  }.

${RULES}

${JSON_SHAPE(null)}`;
}
