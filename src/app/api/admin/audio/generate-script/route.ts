import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/shared/utils/api/api-guard";
import { parseBody } from "@/shared/utils/api/parse-body";
import { getModelProvider, resolveModelId, ACTIVE_AI_MODELS } from "@/shared/config/ai-models";
import { runAITask } from "@/shared/services/ai-fallback";
import { log } from "@/shared/utils/logging";

// Vercel Hobby caps at 60s; Claude calls observed ~10s, chain walk worst case ~15s.
export const maxDuration = 30;

const AUDIO_SCRIPT_SYSTEM =
  "You are an expert medical educator creating concise, engaging educational audio scripts for students. Your scripts should be clear, accurate, and suitable for text-to-speech conversion.";

// Accept all available models for admin audio script generation
const ADMIN_AI_MODELS = ACTIVE_AI_MODELS.filter((model) => model.available).map(
  (model) => model.id
);

const generateScriptSchema = z.object({
  content: z.object({
    category: z.string().min(1),
    subject: z.string().min(1),
    lesson: z.string().min(1),
    topic: z.string().min(1),
    content: z.unknown().optional(),
  }),
  additionalInstructions: z.string().optional(),
  model: z.string().optional(),
  modelOverride: z.string().optional(),
});

type EducationalContent = z.infer<typeof generateScriptSchema>["content"];

function buildTTSPrompt(content: EducationalContent, additionalInstructions: string): string {
  return `Topic: ${content.topic}

Task: Write a script for an audio segment covering the following:

1. Definition and classification of the entity or spectrum
2. Key morphologic features distinguishing each entity
3. Relevant molecular or immunohistochemical profile
4. Related entities and where this fits within a broader pathologic pathway or continuum

Educational Context:
Category: ${content.category}
Subject: ${content.subject}
Lesson: ${content.lesson}

${additionalInstructions ? `Additional Instructions:\n${additionalInstructions}\n\n` : ""}Constraints:

1. NO hyphens (text will be read aloud - use "to" instead of ranges like "5 to 10" not "5-10")
2. Use precise pathology terminology but keep sentence structure flowing for narration
3. Avoid vague clinical advice like "warrants follow up"; anchor concepts instead
4. Target length: 150 to 180 words (approximately 1 minute when spoken)
5. Write in flowing paragraphs - NO bullet points, lists, or special formatting
6. Follow the four-beat framework: what is it → what does it look like → what drives it molecularly → where does it sit in the bigger picture

Return ONLY the script text with no additional commentary, metadata, titles, or formatting. The text should be ready for direct text-to-speech conversion.`;
}

/**
 * @swagger
 * /api/admin/audio/generate-script:
 *   post:
 *     summary: Generate audio script using AI
 *     description: Generate an educational audio script using AI based on educational content metadata. Supports multiple AI models (Groq, Cerebras, Google Gemini, Mistral). Requires admin role.
 *     tags:
 *       - Admin - Audio
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: object
 *                 required:
 *                   - category
 *                   - subject
 *                   - lesson
 *                   - topic
 *                 properties:
 *                   category:
 *                     type: string
 *                     description: Educational category
 *                     example: "Pathology"
 *                   subject:
 *                     type: string
 *                     description: Subject area
 *                     example: "Gastrointestinal"
 *                   lesson:
 *                     type: string
 *                     description: Lesson name
 *                     example: "Inflammatory Bowel Disease"
 *                   topic:
 *                     type: string
 *                     description: Specific topic
 *                     example: "Crohn's Disease"
 *               additionalInstructions:
 *                 type: string
 *                 description: Additional instructions for the AI
 *                 example: "Focus on microscopic features"
 *               model:
 *                 type: string
 *                 description: AI model to use
 *                 default: "gemini-2.5-flash-lite"
 *                 enum: ["gemini-2.5-flash-lite", "llama-3.3-70b-versatile", "gpt-oss-120b", "mistral-large-latest"]
 *     responses:
 *       200:
 *         description: Script generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 text:
 *                   type: string
 *                   description: Generated script text
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     generated_at:
 *                       type: string
 *                       format: date-time
 *                     generation_time_ms:
 *                       type: number
 *                     model:
 *                       type: string
 *                     provider:
 *                       type: string
 *                     word_count:
 *                       type: number
 *       400:
 *         description: Bad request - missing or invalid content
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - admin privileges required
 *       500:
 *         description: Internal server error - AI service failure
 */
export async function POST(request: NextRequest) {
  try {
    const auth = requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const body = await parseBody(request, generateScriptSchema);
    if (body instanceof NextResponse) return body;
    const { content, additionalInstructions = "", model, modelOverride } = body;

    // Named model honoured exactly; otherwise walk the shared chain.
    const requestedModel = modelOverride || model;
    const pinnedModel = requestedModel ? resolveModelId(requestedModel) : undefined;

    if (pinnedModel && !ADMIN_AI_MODELS.includes(pinnedModel)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported model: ${pinnedModel}. Supported: ${ADMIN_AI_MODELS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    log.debug(
      `[TTS Text Gen] Generating text using ${pinnedModel ?? "fallback chain"} for ${content.subject} > ${content.lesson} > ${content.topic}`
    );

    const prompt = buildTTSPrompt(content, additionalInstructions);
    const startTime = Date.now();
    const aiResponse = await runAITask("audio-script", prompt, {
      system: AUDIO_SCRIPT_SYSTEM,
      modelOverride: pinnedModel,
      label: "TTS Text Gen",
    });
    const selectedModel = aiResponse.model;
    const generationTime = Date.now() - startTime;

    log.debug(
      `[TTS Text Gen] Generated text in ${generationTime}ms (${aiResponse.content.length} chars, ${aiResponse.content.trim().split(/\s+/).length} words)`
    );

    return NextResponse.json({
      success: true,
      text: aiResponse.content.trim(),
      metadata: {
        generated_at: new Date().toISOString(),
        generation_time_ms: generationTime,
        model: selectedModel,
        provider: getModelProvider(selectedModel),
        word_count: aiResponse.content.trim().split(/\s+/).length,
        educational_content: {
          category: content.category,
          subject: content.subject,
          lesson: content.lesson,
          topic: content.topic,
        },
      },
    });
  } catch (error) {
    log.error("[TTS Text Gen] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
