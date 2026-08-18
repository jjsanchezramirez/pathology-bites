// WSI question generation — fast JSON extraction, parsing, and validation of the AI response.
import { log } from "@/shared/utils/logging";

interface QuestionOption {
  id: string;
  text: string;
  is_correct?: boolean;
  isCorrect?: boolean;
  explanation: string;
  order_index?: number;
}

export interface QuestionData {
  title?: string;
  stem?: string;
  question?: string;
  options: QuestionOption[];
  references?: string[];
  teaching_point?: string;
  explanation?: string;
  difficulty?: string;
  learningObjectives?: string[];
  tags?: string[];
  suggested_tags?: string[];
  status?: string;
}

// Normalize WSI object to handle both client-side and server-side formats

function extractJSONFast(response: string): string | null {
  // Strategy 1: Smart brace counting (most common case)
  const firstBrace = response.indexOf("{");
  if (firstBrace === -1) return null;

  let braceCount = 0;
  let i = firstBrace;
  let inString = false;
  let escapeNext = false;

  while (i < response.length) {
    const char = response[i];

    if (escapeNext) {
      escapeNext = false;
    } else if (char === "\\" && inString) {
      escapeNext = true;
    } else if (char === '"' && !escapeNext) {
      inString = !inString;
    } else if (!inString) {
      if (char === "{") {
        braceCount++;
      } else if (char === "}") {
        braceCount--;
        if (braceCount === 0) {
          return response.substring(firstBrace, i + 1);
        }
      }
    }
    i++;
  }

  // Fallback strategies
  const match = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (match) return match[1];

  const greedy = response.match(/\{[\s\S]*\}/);
  return greedy ? greedy[0] : null;
}

// Fast question parsing - optimized validation
export function parseAndValidateQuestionFast(response: string): QuestionData {
  log.debug(`[Question Gen] Fast parsing AI response (${response.length} chars)`);

  // Fast JSON extraction
  const jsonStr = extractJSONFast(response);
  if (!jsonStr) {
    throw new Error("No JSON found in AI response using fast extraction");
  }

  // Fast JSON cleanup
  const cleanedJson = jsonStr
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
    .replace(/,(\s*[}\]])/g, "$1") // Remove trailing commas
    .trim();

  // Fast parsing with error handling
  let parsedQuestion: unknown;
  try {
    parsedQuestion = JSON.parse(cleanedJson);
  } catch (jsonError) {
    // Quick fix for common issues
    const fixedJson = cleanedJson
      .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Add quotes to keys
      .replace(/:\s*'([^']*)'/g, ': "$1"'); // Fix quotes

    try {
      parsedQuestion = JSON.parse(fixedJson);
    } catch {
      throw new Error(
        `JSON parsing failed: ${jsonError instanceof Error ? jsonError.message : "Parse error"}`
      );
    }
  }

  // Fast validation and normalization
  return validateAndNormalizeQuestionFast(parsedQuestion as Record<string, unknown>);
}

// Fast question validation - streamlined checks
function validateAndNormalizeQuestionFast(questionObj: Record<string, unknown>): QuestionData {
  const normalizedQuestion: QuestionData = {
    options: [],
  };

  // Fast field extraction
  normalizedQuestion.title = typeof questionObj.title === "string" ? questionObj.title : undefined;
  normalizedQuestion.stem = typeof questionObj.stem === "string" ? questionObj.stem : "";
  normalizedQuestion.difficulty =
    typeof questionObj.difficulty === "string" ? questionObj.difficulty : "medium";
  normalizedQuestion.teaching_point =
    typeof questionObj.teaching_point === "string" ? questionObj.teaching_point : undefined;
  normalizedQuestion.suggested_tags = Array.isArray(questionObj.suggested_tags)
    ? questionObj.suggested_tags.map(String)
    : [];
  normalizedQuestion.status = typeof questionObj.status === "string" ? questionObj.status : "draft";

  // Fast reference handling
  if (typeof questionObj.question_references === "string") {
    normalizedQuestion.references = [questionObj.question_references];
  } else if (Array.isArray(questionObj.references)) {
    normalizedQuestion.references = questionObj.references.map(String);
  } else {
    normalizedQuestion.references = ["Robbins and Cotran Pathologic Basis of Disease, 10th ed"];
  }

  // Fast validation checks
  if (!normalizedQuestion.stem) {
    throw new Error("No question stem found in AI response");
  }

  // Fast options processing
  const optionsArray = questionObj.answer_options || questionObj.options;
  // Exactly five. "At least four" let a six-option question through, where the
  // extra option was a second true alteration presented as a distractor — so the
  // question had two right answers and marked one of them wrong.
  if (!Array.isArray(optionsArray) || optionsArray.length !== 5) {
    throw new Error(
      `Expected exactly 5 answer options, found ${Array.isArray(optionsArray) ? optionsArray.length : 0}`
    );
  }

  // Strip AI-supplied positional metadata (id, order_index) before shuffling.
  // The prompt template hardcodes the correct answer at index 1, so the AI
  // tends to emit the correct option as B unless we randomize position here.
  const rebuilt = optionsArray.map((opt: unknown): QuestionOption => {
    if (typeof opt === "object" && opt !== null) {
      const optObj = opt as Record<string, unknown>;
      return {
        id: "",
        text: String(optObj.text || ""),
        is_correct: Boolean(optObj.is_correct),
        explanation: String(optObj.explanation || ""),
      };
    }
    return {
      id: "",
      text: String(opt),
      is_correct: false,
      explanation: "",
    };
  });
  for (let i = rebuilt.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rebuilt[i], rebuilt[j]] = [rebuilt[j], rebuilt[i]];
  }
  normalizedQuestion.options = rebuilt.map((opt, index) => ({
    ...opt,
    id: String.fromCharCode(65 + index),
    order_index: index,
  }));

  // Fast correctness validation
  const correctCount = normalizedQuestion.options.filter((opt) => opt.is_correct).length;
  if (correctCount !== 1) {
    throw new Error(`Expected exactly 1 correct answer, found ${correctCount}`);
  }

  log.debug(
    `[Question Gen] Fast validation completed: ${normalizedQuestion.options.length} options`
  );
  return normalizedQuestion;
}

/**
 * Contract checks the prompt asks for but the model does not reliably honour.
 *
 * Run inside the parse step, so a violation throws and the runner moves to the
 * next model rather than shipping a broken question. Measured over 80 generated
 * questions: 3 leaked the answer into the stem, 11 of 16 immunophenotype
 * questions built each option from a different marker set (so the odd one out is
 * findable without the slide), and one repeated an option verbatim.
 *
 * Deliberately limited to violations that are unambiguous from the text alone.
 * Style tells — an overlong correct answer, a stem that narrates the microscopy —
 * are handled in the prompt, because retrying on a judgement call costs a model
 * call per question and can never converge.
 */
/**
 * A stem narrating the slide, detected structurally rather than by vocabulary.
 *
 * The first version matched a list of morphology words, and the list can never be
 * finished: "Excisional biopsy shows a nodular architecture with expanded mantle
 * zones" contains none of spindle/nuclei/mitoses/necrosis and sailed through.
 *
 * What actually distinguishes the two cases is grammatical. "The slide is shown"
 * hands the reader the image; "the slide shows X" hands them the findings. So the
 * rule is: a slide or specimen paired with a verb of showing, followed by any
 * substantive object, is narration — whatever words that object happens to use.
 */
const SLIDE_SUBJECT =
  "slide|sections?|h&e[- ]stained sections?|microscopy|microscopic examination|histolog\\w+|" +
  "photomicrograph|histopatholog\\w+|image";
// "Peripheral blood shows..." and "Bone marrow examination reveals..." were
// narrating the slide while sliding past a list that only knew "smear" and
// "aspirate". Name the tissue as well as the preparation.
const SPECIMEN_SUBJECT =
  "biopsy|excision|resection|aspirate|smear|specimen|core|section|" +
  "peripheral blood|blood film|bone marrow(?:\\s+\\w+)?|marrow|trephine|lymph node|touch prep";
const SHOWING =
  "show|shows|showed|shown|reveal|reveals|revealed|demonstrat\\w+|exhibit\\w+|display\\w+|" +
  "contain\\w*|consist\\w*|is notable for|are notable for";

const narrationRe = (subjects: string) =>
  new RegExp(
    `\\b(?:the\\s+|a\\s+|an\\s+)?(?:${subjects})\\b[^.!?]{0,40}?\\b(?:${SHOWING})\\b([^.!?]*)`,
    "i"
  );

const SLIDE_NARRATION = narrationRe(SLIDE_SUBJECT);
const SPECIMEN_NARRATION = narrationRe(SPECIMEN_SUBJECT);

/**
 * Everything a stem may legitimately say after "is shown": nothing of substance.
 * "(slide provided)" and "below" point at the image; a noun phrase describes it.
 */
const EMPTY_TAIL =
  /^(?:\s*(?:below|above|here|for (?:your )?review|for evaluation|in the image|in figure \w+)?\s*[.,;:)("'\u2019\u201d]*\s*)*$/i;

/**
 * Marker calls and lab values — a RESULTS report, not a description of the slide.
 *
 * Widening the specimen subjects to catch "peripheral blood shows..." also
 * caught "Immunohistochemistry on the specimen shows CD20+, CD19+, CD79a+..."
 * on the word "specimen", and rejected it as narration. But a stem reporting
 * stains is doing what a molecular question REQUIRES: the reader cannot get from
 * an H&E to a named alteration without the phenotype. Two or more marker calls
 * (or numbers with units) mean this sentence reports results.
 */
const RESULT_TOKEN =
  /\b[A-Za-z][A-Za-z0-9./-]{1,14}\s*[+\-\u2212]\B|\b\d+(?:\.\d+)?\s*(?:%|g\/dL|×|x)\b/g;

function narratesContent(sentence: string, pattern: RegExp): string | null {
  const match = sentence.match(pattern);
  if (!match) return null;
  const tail = (match[1] || "").replace(/\((?:[^)]*)\)/g, " ").trim();
  if (EMPTY_TAIL.test(tail)) return null;
  if ((tail.match(RESULT_TOKEN) ?? []).length >= 2) return null;
  return tail;
}

export function enforceQuestionContract(
  q: QuestionData,
  diagnosis?: string,
  specimen?: string
): QuestionData {
  const stem = (q.stem || "").toLowerCase();
  const options = q.options || [];

  const texts = options.map((o) => (o.text || "").trim().toLowerCase());
  const duplicate = texts.find((t, i) => t && texts.indexOf(t) !== i);
  if (duplicate) {
    throw new Error(`Duplicate answer option: "${duplicate}"`);
  }

  // The entity, or the head of it before any qualifier, must not appear in the
  // stem — including when the name reads like a description ("fat necrosis",
  // "loose bodies"), which is exactly when the model talks itself into using it.
  const head = (diagnosis || "").toLowerCase().split(/[,(]/)[0].trim();
  if (head.length > 6 && stem.includes(head)) {
    throw new Error(`Stem names the entity ("${head}")`);
  }

  // Immunophenotype options must be the same marker set in the same order,
  // differing only in the signs. Detected from the options themselves: every one
  // being a list of marked-up markers is what an IHC question looks like.
  // Normalised hard, because the rule is about which MARKERS appear, and a model
  // writes the signs a dozen ways: "CD10-", "CD10 (negative)", "CD10 neg",
  // "CD10\u2212" with a Unicode minus. Comparing raw text rejected correct
  // questions and, with every model in the chain rejected the same way, produced
  // an outright generation failure — a worse outcome than the tell it prevents.
  const cleanMarker = (part: string) =>
    part
      .replace(/\((?:\+|-|positive|negative|weak|dim|partial|focal|subset)\)/gi, "")
      .replace(
        /\b(?:positive|negative|neg|pos|weak|dim|partial|focal|subset|bright|variable)\b/gi,
        ""
      )
      .replace(/[+\-\u2212\u2013\u2014\u00b1*/]/g, "")
      .replace(/\s+/g, "")
      .toLowerCase();
  const markerSets = options.map((o) =>
    (o.text || "").split(/[,;]/).map(cleanMarker).filter(Boolean)
  );
  const looksImmuno =
    options.length >= 4 &&
    markerSets.every((set) => set.length >= 3) &&
    options.every((o) => /[+-]\s*(,|;|$)/.test((o.text || "").trim()));
  if (looksImmuno) {
    // Set equality, not order: sharing the markers is what removes the tell, and
    // insisting on the order too only adds ways to fail on a compliant question.
    const signature = markerSets.map((set) => [...new Set(set)].sort().join("|"));
    if (new Set(signature).size > 1) {
      throw new Error("Immunophenotype options do not share one marker set");
    }
  }

  // Options carry the answer, not a gloss on it. A real set read four
  // "— seen in <entity>" against one "— recurrent but not pathognomonic": the odd
  // phrasing IS the key, and no slide is needed to spot it. Rejecting the comment
  // outright is simpler than policing consistency, and the attribution belongs in
  // the explanation, which the reader sees after committing.
  const commentary = /\s(?:\u2014|\u2013|--)\s\S|\s-\s\w+(?:\s+\w+){2,}/;
  const commented = options.find((o) => commentary.test(o.text || ""));
  if (commented) {
    throw new Error(`Option carries a trailing comment: "${(commented.text || "").slice(0, 70)}"`);
  }

  // The stem must not contain the answer's own gene or marker symbols.
  //
  // "Molecular testing reveals a JAK2 mutation ... Which genetic alteration is
  // most characteristic?" with JAK2 p.V617F as the key is not a question. The
  // same rule covers immunophenotype questions, where naming the markers in the
  // stem hands over the option that lists them.
  //
  // Only symbols shared by the stem AND the correct option count, so a stem may
  // still report ALK- alongside a DUSP22 answer — which is exactly the workup a
  // molecular question needs.
  const correctOption = options.find((o) => o.is_correct);
  if (correctOption?.text) {
    const symbols = (text: string) => new Set(text.match(/\b[A-Z][A-Z0-9]{2,}\b/g) ?? []);
    const inAnswer = symbols(correctOption.text);
    const inStem = symbols(q.stem || "");
    const leaked = [...inAnswer].filter((sym) => inStem.has(sym));
    if (leaked.length) {
      throw new Error(`Stem names the answer's own symbol(s): ${leaked.join(", ")}`);
    }
  }

  // The stem must not narrate the slide. This is the whole premise of a
  // slide-based question: describing the morphology in words replaces looking
  // down the microscope with reading comprehension, and the reader could answer
  // without the image at all.
  //
  // Checked per sentence, and only where a narrating subject (the slide, the
  // sections, microscopy, the specimen) is paired with morphology vocabulary —
  // so "a skin punch biopsy is performed and the slide is shown" passes, while
  // "the H&E-stained sections show an infiltrative spindle cell neoplasm" does
  // not. Clinical and laboratory findings are untouched: "laboratory studies
  // reveal a leukocytosis with circulating atypical lymphocytes" is history, not
  // a description of the slide.
  for (const sentence of (q.stem || "").split(/(?<=[.!?])\s+/)) {
    // The slide itself, however named, is never describable.
    if (narratesContent(sentence, SLIDE_NARRATION)) {
      throw new Error(`Stem describes the microscopy: "${sentence.trim().slice(0, 90)}"`);
    }

    // A specimen describing itself only matters when that specimen is the one on
    // screen. "The peripheral blood smear shows numerous blasts" gives the answer
    // away over a blood smear, and is ordinary haematology history over a marrow
    // trephine — the reader cannot see the film, so it is context, not narration.
    const narrated = sentence.match(SPECIMEN_NARRATION);
    if (!narrated || !narratesContent(sentence, SPECIMEN_NARRATION)) continue;
    // Compared against the WHOLE sentence, not just the matched fragment: the
    // fragment for "Bone-marrow biopsy shows hypercellularity" starts at
    // "biopsy", so a specimen of "bone marrow specimen" looked like a different
    // one and the narration was allowed through.
    const shown = (specimen || "").toLowerCase();
    const namesTheShownSlide =
      !shown ||
      sentence
        .toLowerCase()
        .split(/\W+/)
        .some((word) => word.length > 3 && shown.includes(word));
    if (namesTheShownSlide) {
      throw new Error(`Stem describes the microscopy: "${sentence.trim().slice(0, 90)}"`);
    }
  }

  return q;
}
