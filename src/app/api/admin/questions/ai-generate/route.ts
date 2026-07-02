import { NextRequest, NextResponse } from "next/server";
import { requireContentRole } from "@/shared/utils/api/api-guard";
import { getApiKey, getModelProvider, ACTIVE_AI_MODELS } from "@/shared/config/ai-models";
import { log } from "@/shared/utils/logging";
import { callAIService } from "./ai-providers";
import { type QuestionGenerationRequest, buildAdminQuestionPrompt } from "./ai-question-prompt";
import { extractJSON } from "./ai-json-parsing";

// Vercel Hobby caps at 60s; Claude calls observed up to 17-80s.
export const maxDuration = 60;

// Accept all available models for admin question generation
const ADMIN_AI_MODELS = ACTIVE_AI_MODELS.filter((model) => model.available).map(
  (model) => model.id
);

/**
 * @swagger
 * /api/admin/questions/ai-generate:
 *   post:
 *     summary: AI-generate or refine questions
 *     description: Use AI models to generate new questions from educational content, refine existing questions, or suggest metadata. Supports multiple AI models (LLAMA, Google Gemini, Mistral). Requires admin, creator, or reviewer role.
 *     tags:
 *       - Admin - Questions
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - instructions
 *             properties:
 *               mode:
 *                 type: string
 *                 enum: [educational_content, refinement, metadata_suggestion]
 *                 default: educational_content
 *                 description: AI generation mode
 *               content:
 *                 type: object
 *                 description: Content depends on mode (educational content, current question, or metadata context)
 *               instructions:
 *                 type: string
 *                 description: Instructions for the AI model
 *               additionalContext:
 *                 type: string
 *                 description: Additional context or constraints
 *               model:
 *                 type: string
 *                 default: Llama-3.3-8B-Instruct
 *                 description: AI model to use for generation
 *     responses:
 *       200:
 *         description: Successfully generated AI response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 title:
 *                   type: string
 *                 stem:
 *                   type: string
 *                 answer_options:
 *                   type: array
 *                   items:
 *                     type: object
 *                 teaching_point:
 *                   type: string
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
 *                     provider:
 *                       type: string
 *                     mode:
 *                       type: string
 *       400:
 *         description: Bad request - missing required fields or unsupported model
 *       401:
 *         description: Unauthorized - missing authentication
 *       403:
 *         description: Forbidden - requires admin, creator, or reviewer role
 *       500:
 *         description: Internal server error or AI API error
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check - require admin, creator, or reviewer role
    const auth = requireContentRole(request);
    if (auth instanceof NextResponse) return auth;

    const body: QuestionGenerationRequest & { modelOverride?: string } = await request.json();
    const {
      mode = "educational_content",
      content,
      instructions,
      additionalContext = "",
      model,
      modelOverride,
    } = body;

    // Validate inputs based on mode
    if (mode === "educational_content") {
      if (!content || !instructions) {
        return NextResponse.json(
          {
            success: false,
            error: "Missing required fields for educational_content mode: content, instructions",
          },
          { status: 400 }
        );
      }
    } else if (mode === "refinement") {
      if (!content || !instructions) {
        return NextResponse.json(
          {
            success: false,
            error: "Missing required fields for refinement mode: content, instructions",
          },
          { status: 400 }
        );
      }
    } else if (mode === "metadata_suggestion") {
      if (!content || !content.title || !content.stem) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Missing required fields for metadata_suggestion mode: content.title, content.stem",
          },
          { status: 400 }
        );
      }
    }

    // Use default model for educational content mode if not specified
    const selectedModel = modelOverride || model || "Llama-3.3-8B-Instruct";

    // Validate model
    if (!ADMIN_AI_MODELS.includes(selectedModel)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported model: ${selectedModel}. Supported: ${ADMIN_AI_MODELS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Get API configuration
    const provider = getModelProvider(selectedModel);
    const apiKey = getApiKey(provider);

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: `No API key found for provider: ${provider}` },
        { status: 500 }
      );
    }

    log.debug(
      `[Admin AI] Generating question using ${selectedModel} (${provider}) in ${mode} mode`
    );

    // Build the prompt based on mode
    const promptData = mode === "refinement" ? content : content;
    const prompt = buildAdminQuestionPrompt(promptData, instructions, additionalContext, mode);

    // Call AI service
    const startTime = Date.now();
    const aiResponse = await callAIService(provider, prompt, selectedModel, apiKey);
    const generationTime = Date.now() - startTime;

    log.debug(`[Admin AI] Generated response in ${generationTime}ms`);
    log.debug(
      `[Admin AI] Raw AI response (${mode} mode):`,
      aiResponse.content.substring(0, 500) + "..."
    );

    // Parse the AI response
    let questionData: Record<string, unknown>;
    try {
      questionData = extractJSON(aiResponse.content) as Record<string, unknown>;
      log.debug(`[Admin AI] Extracted JSON (${mode} mode):`, JSON.stringify(questionData, null, 2));
    } catch (parseError) {
      log.error(`[Admin AI] JSON extraction failed for model ${selectedModel} (${provider})`);
      throw parseError;
    }

    // Normalize options field - AI models sometimes use different field names despite our prompt
    // Accept question_options (preferred), answer_options, or options, then normalize to question_options
    if (!questionData.question_options && (questionData.answer_options || questionData.options)) {
      log.debug(
        "[Admin AI] Normalizing options field from:",
        questionData.answer_options ? "answer_options" : "options"
      );
      questionData.question_options = questionData.answer_options || questionData.options;
      // Clean up the old field
      delete questionData.answer_options;
      delete questionData.options;
    }

    // Validate the response structure based on mode
    if (mode === "metadata_suggestion") {
      // For metadata suggestion, we expect different fields
      const hasMetadataFields =
        questionData.category_id ||
        questionData.question_set_id ||
        questionData.difficulty ||
        questionData.suggested_tag_ids;

      if (!hasMetadataFields) {
        log.error("[Admin AI] Metadata suggestion validation failed. Response structure:", {
          hasCategoryId: !!questionData.category_id,
          hasQuestionSetId: !!questionData.question_set_id,
          hasDifficulty: !!questionData.difficulty,
          hasSuggestedTagIds: !!questionData.suggested_tag_ids,
          actualKeys: Object.keys(questionData),
          mode: mode,
        });
        throw new Error(
          "AI response missing metadata fields. Expected at least one of: category_id, question_set_id, difficulty, suggested_tag_ids"
        );
      }
    } else {
      // For question generation modes, validate question structure
      const hasRequiredFields =
        questionData.stem &&
        questionData.question_options &&
        Array.isArray(questionData.question_options);

      if (!hasRequiredFields) {
        log.error("[Admin AI] Validation failed. Response structure:", {
          hasTitle: !!questionData.title,
          hasStem: !!questionData.stem,
          hasQuestionOptions: !!questionData.question_options,
          hasAnswerOptions: !!questionData.answer_options,
          hasOptions: !!questionData.options,
          isQuestionOptionsArray: Array.isArray(questionData.question_options),
          actualKeys: Object.keys(questionData),
          mode: mode,
        });
        throw new Error(
          `AI response missing required fields for ${mode} mode. Required: stem, question_options (array)`
        );
      }

      // For refinement mode, title is optional (can keep existing)
      if (mode === "educational_content" && !questionData.title) {
        throw new Error("AI response missing title field (required for educational_content mode)");
      }

      if ((questionData.question_options as unknown[]).length !== 5) {
        throw new Error("AI response must contain exactly 5 options");
      }

      const correctCount = (
        questionData.question_options as Array<{ is_correct?: boolean }>
      ).filter((opt) => opt.is_correct).length;
      if (correctCount !== 1) {
        throw new Error(`AI response must have exactly 1 correct answer, found ${correctCount}`);
      }
    }

    // Return the data in the format expected by the frontend
    let responseData: Record<string, unknown>;

    if (mode === "metadata_suggestion") {
      responseData = {
        category_id: questionData.category_id || null,
        question_set_id: questionData.question_set_id || null,
        difficulty: questionData.difficulty || null,
        suggested_tag_ids: questionData.suggested_tag_ids || [],
      };
    } else {
      responseData = {
        title:
          questionData.title || (mode === "refinement" ? "Refined Question" : "Generated Question"),
        stem: questionData.stem,
        answer_options: questionData.question_options || questionData.answer_options,
        teaching_point: questionData.teaching_point || "",
        question_references: "",
        difficulty: questionData.difficulty || "medium",
        status: questionData.status || "draft",
        suggested_tags: questionData.suggested_tags || [],
      };
    }

    return NextResponse.json({
      success: true,
      ...responseData,
      metadata: {
        generated_at: new Date().toISOString(),
        generation_time_ms: generationTime,
        model: selectedModel,
        provider: provider,
        token_usage: aiResponse.tokenUsage,
        mode: mode,
      },
    });
  } catch (error) {
    log.error("[Admin AI] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
