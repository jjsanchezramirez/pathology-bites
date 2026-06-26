// WSI question generation — prompt builder (streamlined pathology question prompt).
import { VirtualSlide } from "@/shared/types/virtual-slides";

// Build streamlined prompt for pathology question generation
export function buildQuestionPrompt(
  wsi: VirtualSlide,
  context: Record<string, unknown> | null
): string {
  // Extract only key information from WSI data
  const keyInfo = {
    chapter: wsi.category || "Not specified",
    organ: wsi.subcategory || "Not specified",
    diagnosis: wsi.diagnosis || "Not specified",
    // Note: WSI data typically doesn't have differential, immunoprofile, or molecular info
    // These would need to be added to WSI metadata if available
    differential: wsi.source_metadata?.differential || null,
    immunoprofile: wsi.source_metadata?.immunoprofile || null,
    molecular: wsi.source_metadata?.molecular || null,
  };

  const contextInfo = context
    ? `Educational Context: ${context.topic}\nFrom: ${context.subject} > ${context.lesson}`
    : "No specific educational context available.";

  return `Create a board-style pathology question using ONLY the following key information:

CASE INFORMATION:
Chapter: ${keyInfo.chapter}
Organ: ${keyInfo.organ}
Diagnosis: ${keyInfo.diagnosis}
Patient Age: ${wsi.age || "Adult"}
Patient Gender: ${wsi.gender || "Not specified"}

${contextInfo}

CRITICAL INSTRUCTIONS:
1. DO NOT include histologic/microscopic descriptions in the question stem (the WSI image will show this)
2. DO NOT make the diagnosis obvious in the question stem
3. Create a clinical scenario that requires the reader to examine the slide to answer
4. Focus on clinical presentation, demographics, and relevant clinical context
5. Use your knowledge of differential diagnoses to create plausible distractors
6. Make this a challenging but fair board-style question
7. End the question stem with "What is the most likely diagnosis?"

Requirements:
1. Create a clinically relevant scenario-based question
2. Include 5 answer choices with one clearly correct answer
3. Provide detailed explanations for each choice that include BOTH clinical correlation AND histological features
4. Ensure the question tests understanding, not just memorization
5. Use appropriate medical terminology
6. Make the question challenging but fair
7. Suggest 2-4 relevant medical/pathology tags that categorize this question
8. Answer explanations must describe key histologic features and their clinical significance

Return the response in this exact JSON format:
{
  "title": "Brief descriptive title",
  "stem": "Clinical scenario and question ending with 'What is the most likely diagnosis?'",
  "difficulty": "easy|medium|hard",
  "teaching_point": "Concise 1-2 sentence key learning point about [specific concept being tested].",
  "suggested_tags": ["Tag1", "Tag2", "Tag3"],
  "question_references": "Relevant citations",
  "status": "draft",
  "answer_options": [
    {
      "text": "Answer choice A text",
      "is_correct": false,
      "explanation": "Clinical and histological explanation for A - describe why this diagnosis is incorrect based on clinical presentation and microscopic features seen in the slide",
      "order_index": 0
    },
    {
      "text": "Answer choice B text",
      "is_correct": true,
      "explanation": "Clinical and histological explanation for B (correct answer) - explain why this is the correct diagnosis based on the clinical scenario AND the specific histologic features visible in the WSI slide",
      "order_index": 1
    },
    {
      "text": "Answer choice C text",
      "is_correct": false,
      "explanation": "Clinical and histological explanation for C - describe why this diagnosis is incorrect, mentioning both clinical factors and the histological features that rule it out",
      "order_index": 2
    },
    {
      "text": "Answer choice D text",
      "is_correct": false,
      "explanation": "Clinical and histological explanation for D - explain the clinical and microscopic differences that distinguish this from the correct diagnosis",
      "order_index": 3
    },
    {
      "text": "Answer choice E text",
      "is_correct": false,
      "explanation": "Clinical and histological explanation for E - describe the clinical presentation and histologic appearance that would be expected for this diagnosis and how it differs from what is shown",
      "order_index": 4
    }
  ]
}`;
}

/**
 * @swagger
 * /api/user/wsi-questions/generate:
 *   post:
 *     summary: Generate AI question from whole slide image
 *     description: Generate a board-style pathology multiple-choice question from a whole slide image (WSI) using AI models. Supports multiple fallback models for reliability. Requires authentication.
 *     tags:
 *       - User - WSI Questions
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - wsi
 *             properties:
 *               wsi:
 *                 type: object
 *                 description: Virtual slide image object with metadata
 *                 properties:
 *                   category:
 *                     type: string
 *                   subcategory:
 *                     type: string
 *                   diagnosis:
 *                     type: string
 *                   age:
 *                     type: string
 *                   gender:
 *                     type: string
 *                   image_url:
 *                     type: string
 *               context:
 *                 type: object
 *                 description: Educational context for question generation
 *                 properties:
 *                   topic:
 *                     type: string
 *                   subject:
 *                     type: string
 *                   lesson:
 *                     type: string
 *               modelIndex:
 *                 type: integer
 *                 default: 0
 *                 description: Index of model to use from fallback chain (0-based)
 *               customPrompt:
 *                 type: string
 *                 description: Custom prompt to override default question generation prompt
 *     responses:
 *       200:
 *         description: Question generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 question:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                     stem:
 *                       type: string
 *                     difficulty:
 *                       type: string
 *                       enum: [easy, medium, hard]
 *                     teaching_point:
 *                       type: string
 *                     suggested_tags:
 *                       type: array
 *                       items:
 *                         type: string
 *                     options:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           text:
 *                             type: string
 *                           is_correct:
 *                             type: boolean
 *                           explanation:
 *                             type: string
 *                           order_index:
 *                             type: integer
 *                     references:
 *                       type: array
 *                       items:
 *                         type: string
 *                     status:
 *                       type: string
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     generated_at:
 *                       type: string
 *                       format: date-time
 *                     generation_time_ms:
 *                       type: integer
 *                     model:
 *                       type: string
 *                     modelIndex:
 *                       type: integer
 *                     diagnosis:
 *                       type: string
 *                     token_usage:
 *                       type: object
 *                       properties:
 *                         prompt_tokens:
 *                           type: integer
 *                         completion_tokens:
 *                           type: integer
 *                         total_tokens:
 *                           type: integer
 *                     retry_info:
 *                       type: object
 *                       properties:
 *                         attempts:
 *                           type: integer
 *                         retries:
 *                           type: integer
 *                         totalTime:
 *                           type: integer
 *                 debug:
 *                   type: object
 *       400:
 *         description: Bad request - missing WSI parameter or all models exhausted
 *       500:
 *         description: Model failed - includes next model information for retry
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 error:
 *                   type: string
 *                 details:
 *                   type: string
 *                 errorType:
 *                   type: string
 *                   enum: [retryable, fallback, fatal]
 *                 nextModelIndex:
 *                   type: integer
 *                   nullable: true
 *                 nextModel:
 *                   type: string
 *                   nullable: true
 *                 currentModelIndex:
 *                   type: integer
 *                 availableModels:
 *                   type: integer
 *                 retryExhausted:
 *                   type: boolean
 */

// Set timeout for WSI question generation to prevent 504 errors
