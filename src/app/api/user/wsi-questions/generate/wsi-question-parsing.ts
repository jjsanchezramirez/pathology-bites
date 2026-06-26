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
  if (!Array.isArray(optionsArray) || optionsArray.length < 4) {
    throw new Error("Invalid or insufficient answer options in AI response");
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
