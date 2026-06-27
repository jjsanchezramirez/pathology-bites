// Admin question generation — request types + the board-style question prompt builder.

export interface QuestionGenerationRequest {
  mode?: "educational_content" | "refinement" | "metadata_suggestion";
  content?: QuestionGenerationContent;
  currentQuestion?: QuestionGenerationCurrent;
  instructions: string;
  additionalContext?: string;
  model?: string;
}

interface QuestionGenerationContent {
  category: string;
  subject: string;
  lesson: string;
  topic: string;
  content?: unknown;
  // For metadata suggestion mode
  title?: string;
  stem?: string;
  teaching_point?: string;
  available_categories?: Array<{ id: string; name: string }>;
  available_question_sets?: Array<{ id: string; name: string }>;
  available_tags?: Array<{ id: string; name: string }>;
}

interface QuestionGenerationCurrent {
  title: string;
  stem: string;
  answer_options: Array<{
    text: string;
    is_correct: boolean;
    explanation: string;
  }>;
  teaching_point: string;
  question_references: string;
}

// Categories that typically have histologic/microscopic images attached
const IMAGE_CATEGORIES = new Set([
  // All Anatomic Pathology subjects have images
  "Anatomic Pathology",
]);
// CP subjects that also have images
const IMAGE_CP_SUBJECTS = new Set(["Hematopathology"]);

function hasImageByDefault(category: string, subject: string): boolean {
  if (IMAGE_CATEGORIES.has(category)) return true;
  if (category === "Clinical Pathology" && IMAGE_CP_SUBJECTS.has(subject)) return true;
  return false;
}

export function buildAdminQuestionPrompt(
  content: QuestionGenerationContent,
  instructions: string,
  additionalContext: string,
  mode: string = "educational_content"
): string {
  if (mode === "educational_content") {
    const hasImage = hasImageByDefault(content.category, content.subject);

    const imageInstruction = hasImage
      ? "This question will have a histologic/microscopic image attached. Do NOT describe the image in the question stem — instead reference that images are shown (e.g., 'histologic sections are shown'). Detailed histopathological descriptions belong in the answer explanations, not the question stem."
      : "This question does NOT have an associated image. The question stem should be self-contained with all necessary clinical and laboratory information. Do not reference any images or histologic findings unless the additional context below specifies that an image will be provided.";

    return `Create a high-quality medical/pathology question based on the following educational content.

EDUCATIONAL CONTENT:
Category: ${content.category}
Subject: ${content.subject}
Lesson: ${content.lesson}
Topic: ${content.topic}

${additionalContext ? `ADDITIONAL CONTEXT (IMPORTANT — follow these instructions closely):\n${additionalContext}\n` : ""}IMAGE CONTEXT:
${imageInstruction}

QUESTION STRUCTURE:
Write the question following this four-beat framework:
1. DEFINITION AND CLASSIFICATION — What is this entity? How is it classified?
2. KEY MORPHOLOGIC FEATURES — What does it look like microscopically/macroscopically? What distinguishes it?
3. MOLECULAR/IMMUNOHISTOCHEMICAL PROFILE — What drives it molecularly? What markers are relevant?
4. BROADER PATHOLOGIC CONTEXT — Where does this fit in a broader pathway or continuum?

CONSTRAINTS:
- NO hyphens (text will be read aloud — use "to" instead of ranges like "5-10")
- Use precise pathology terminology but keep sentence structure flowing for narration
- Avoid vague clinical advice like "warrants follow up" — anchor concepts instead
- Teaching points must state a specific, testable fact related to the question topic and answer options — NOT a generic importance statement. Bad: "Understanding X is essential for Y." Good: "GBS is uniquely identified by its hippurate hydrolysis positivity and CAMP test positivity, distinguishing it from other beta-hemolytic streptococci."
- Write the question stem as SHORT, separate sentences — NOT one long run-on sentence. Present the clinical scenario in 2 to 4 crisp sentences, then ask the question as its own final sentence ending in a question mark. Bad: "A 45-year-old woman presents with X, and her labs show Y, and she has Z, what is the mechanism?" Good: "A 45-year-old woman presents with petechiae and ecchymoses following severe trauma and sepsis. Laboratory studies show a low platelet count, elevated D-dimer, and decreased fibrinogen. What is the most likely underlying mechanism?"
- Do NOT prefix option text with its own letter label (e.g., "A. Adenocarcinoma" is wrong — just write "Adenocarcinoma")
- Explanations must NOT use AI reasoning language. Bad: "This is incorrect because the question states…", "Based on the clinical scenario…". Good: Write explanations as standalone medical facts, as if in a textbook.
- The stem and image type must be consistent. If the question references a gross image, do not describe histologic/microscopic features in the stem (and vice versa).
- The correct answer must directly and precisely match the clinical presentation, lab values, and history given in the stem. Do not choose a correct answer that only partially fits.

CRITICAL REQUIREMENTS:
1. Create a clinically relevant multiple-choice question
2. Include exactly 5 answer options (A, B, C, D, E) with one clearly correct answer
3. Provide detailed explanations for ALL 5 answer options (not just the correct one)
4. Include a meaningful teaching point that summarizes the key learning objective
5. Use appropriate medical terminology and pathology concepts
6. Make the question challenging but fair for medical students/residents
7. Base the question on the provided educational content
8. Focus on clinical correlation and diagnostic reasoning
9. The question stem should focus on clinical presentation, patient demographics, and clinical context
10. Follow the four-beat framework: what is it → what does it look like → what drives it molecularly → where does it sit in the bigger picture

Return your response in this EXACT JSON format (no markdown, no code blocks, just pure JSON):

{
  "title": "Brief descriptive title for the question",
  "stem": "The question text ending with a clear question mark",
  "question_options": [
    {
      "text": "First answer option",
      "is_correct": false,
      "explanation": "Detailed explanation why this is incorrect, including clinical and pathological reasoning",
      "order_index": 0
    },
    {
      "text": "Second answer option",
      "is_correct": true,
      "explanation": "Detailed explanation why this is correct, including clinical correlation and key diagnostic features",
      "order_index": 1
    },
    {
      "text": "Third answer option",
      "is_correct": false,
      "explanation": "Detailed explanation why this is incorrect, including differential diagnosis considerations",
      "order_index": 2
    },
    {
      "text": "Fourth answer option",
      "is_correct": false,
      "explanation": "Detailed explanation why this is incorrect, mentioning distinguishing features",
      "order_index": 3
    },
    {
      "text": "Fifth answer option",
      "is_correct": false,
      "explanation": "Detailed explanation why this is incorrect, including clinical and histological differences",
      "order_index": 4
    }
  ],
  "teaching_point": "A specific, testable fact about the topic — not a generic importance statement",
  "suggested_tags": ["Tag1", "Tag2", "Tag3"],
  "difficulty": "medium",
  "status": "draft"
}

IMPORTANT: For suggested_tags, provide 3-5 relevant medical/pathology tags that describe the key concepts, diseases, or techniques in this question. Tags should be:
- Specific medical terms (e.g., "Cervical Neoplasia", "HPV", "Adenocarcinoma In Situ")
- Relevant to the question content
- Useful for categorizing and searching questions
- Concise (1-3 words each)`;
  }

  if (mode === "metadata_suggestion") {
    return `Analyze the following question content and suggest appropriate metadata:

QUESTION CONTENT:
Title: ${content.title}
Stem: ${content.stem}
Teaching Point: ${content.teaching_point || "Not provided"}

AVAILABLE OPTIONS:

Categories:
${content.available_categories?.map((cat) => `- ${cat.name} (ID: ${cat.id})`).join("\n") || "None available"}

Question Sets:
${content.available_question_sets?.map((qs) => `- ${qs.name} (ID: ${qs.id})`).join("\n") || "None available"}

Available Tags:
${content.available_tags?.map((tag) => `- ${tag.name} (ID: ${tag.id})`).join("\n") || "None available"}

INSTRUCTIONS:
Based on the question content, suggest the most appropriate:
1. Category ID (from the available categories)
2. Question Set ID (from the available question sets)
3. Difficulty level (easy, medium, or hard)
4. Tag IDs (select 3-5 most relevant tags from available tags)

Return your response in this EXACT JSON format:
{
  "category_id": "most_appropriate_category_id_or_null",
  "question_set_id": "most_appropriate_question_set_id_or_null",
  "difficulty": "easy_medium_or_hard",
  "suggested_tag_ids": ["tag_id_1", "tag_id_2", "tag_id_3"]
}

IMPORTANT: Only use IDs that exist in the available options above. If no appropriate option exists, use null for that field.`;
  }

  // For refinement mode - handle both answerOptions (from frontend) and answer_options (normalized)
  const contentData = content as {
    title?: string;
    stem?: string;
    teaching_point?: string;
    question_references?: string;
    answerOptions?: Array<{ text: string; is_correct: boolean; explanation: string }>;
    answer_options?: Array<{ text: string; is_correct: boolean; explanation: string }>;
  };

  const answerOptions = contentData.answerOptions || contentData.answer_options || [];

  return `Refine the following medical/pathology question based on the provided instructions:

CURRENT QUESTION:
Title: ${contentData.title || ""}
Stem: ${contentData.stem || ""}
Teaching Point: ${contentData.teaching_point || ""}
References: ${contentData.question_references || ""}

CURRENT ANSWER OPTIONS:
${answerOptions
  .map(
    (opt, i) =>
      `${String.fromCharCode(65 + i)}. ${opt.text} ${opt.is_correct ? "(CORRECT)" : "(INCORRECT)"}\n   Explanation: ${opt.explanation}`
  )
  .join("\n")}

REFINEMENT INSTRUCTIONS:
${instructions}
${additionalContext ? `\nADDITIONAL CONTEXT (IMPORTANT — follow these instructions closely):\n${additionalContext}\n` : ""}
CRITICAL REQUIREMENTS:
1. ONLY modify the specific fields the user's instructions refer to. Leave all other fields EXACTLY as they are — do not rephrase, reword, or "improve" fields that were not mentioned in the instructions. For example, if the user asks to edit the teaching point, return the stem, title, answer option texts, and explanations unchanged word-for-word.
2. Maintain exactly 5 answer options (A, B, C, D, E) with one clearly correct answer
3. Provide detailed explanations for ALL 5 answer options (copy them verbatim unless the instructions ask you to change them)
4. Keep the same clinical relevance and educational value
5. Apply the refinement instructions while preserving the question structure
6. Do NOT prefix option text with its own letter label (e.g., "A. Adenocarcinoma" is wrong — just write "Adenocarcinoma")
7. Explanations must NOT use AI reasoning language (e.g., "This is incorrect because the question states…"). Write explanations as standalone medical facts.
8. The correct answer must directly and precisely match the clinical presentation, lab values, and history given in the stem.

Return your response in this EXACT JSON format:
{
  "title": "Question title here",
  "stem": "Question stem/body here",
  "question_options": [
    {
      "text": "Option A text",
      "is_correct": false,
      "explanation": "Detailed explanation for option A"
    },
    {
      "text": "Option B text",
      "is_correct": true,
      "explanation": "Detailed explanation for option B"
    },
    {
      "text": "Option C text",
      "is_correct": false,
      "explanation": "Detailed explanation for option C"
    },
    {
      "text": "Option D text",
      "is_correct": false,
      "explanation": "Detailed explanation for option D"
    },
    {
      "text": "Option E text",
      "is_correct": false,
      "explanation": "Detailed explanation for option E"
    }
  ],
  "teaching_point": "A specific, testable fact about the topic — not a generic importance statement",
  "question_references": "Relevant citations or references",
  "difficulty": "medium",
  "status": "draft"
}`;
}
