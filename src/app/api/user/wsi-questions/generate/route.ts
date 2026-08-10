import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getApiKey,
  getModelProvider,
  resolveModelId,
  TEXT_FALLBACK_CHAIN,
} from "@/shared/config/ai-models";
import { VirtualSlide } from "@/shared/types/virtual-slides";
import { parseBody } from "@/shared/utils/api/parse-body";
import { classifyError as classifyProviderError } from "@/shared/services/ai-fallback";
import { log } from "@/shared/utils/logging";

// wsi is a loosely-structured VirtualSlide-ish blob (normalized downstream by
// normalizeWSI) and context is prompt metadata — keep both loose.
const generateQuestionSchema = z.object({
  wsi: z.record(z.unknown()),
  context: z.unknown().optional(),
  modelIndex: z.number().optional(),
  customPrompt: z.string().optional(),
  modelOverride: z.string().optional(),
  responseMode: z.string().optional(),
});
import { buildQuestionPrompt } from "./wsi-question-prompt";
import { type QuestionData, parseAndValidateQuestionFast } from "./wsi-question-parsing";
import { callAIService, normalizeWSI } from "./wsi-question-providers";

// WSI question generation uses TEXT_FALLBACK_CHAIN — image_url is referenced
// in the prompt as metadata, not sent to vision API.
const WSI_FALLBACK_MODELS = TEXT_FALLBACK_CHAIN;

// Retry configuration for transient errors. Only genuine "briefly busy" (503)
// errors retry the same model now, so one quick retry is enough — the fallback
// chain handles everything else. Kept small to fail over fast.
const RETRY_CONFIG = {
  maxRetries: 1,
  baseDelay: 400,
  maxDelay: 2000,
  backoffMultiplier: 2,
};

/**
 * Retry-vs-fallback decision, delegated to the shared classifier.
 *
 * This route used to carry its own copy, which drifted: it tested the
 * "briefly busy" patterns first, and one of them was the bare substring
 * "try again". Groq phrases a daily-token-cap 429 as "Rate limit reached …
 * Please try again in 44m58s", so every quota exhaustion matched "try again",
 * was labelled retryable, and re-hit the same model 400ms later — against a
 * limit that needed 45 minutes. The shared version checks rate limits first.
 */
function classifyError(error: unknown): "retryable" | "fallback" {
  return classifyProviderError(error).action === "retry" ? "retryable" : "fallback";
}

// Sleep utility for retry delays
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Calculate retry delay with exponential backoff
function getRetryDelay(attempt: number): number {
  const delay = RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
  return Math.min(delay, RETRY_CONFIG.maxDelay);
}

export const maxDuration = 45; // 45 seconds timeout (longer than diagnostic search due to AI complexity)

// Fast WSI preprocessing - Extract and validate required data upfront
function preprocessWSI(wsi: VirtualSlide): {
  normalizedWSI: VirtualSlide;
  isValid: boolean;
  error?: string;
} {
  const normalizedWSI = normalizeWSI(wsi);

  if (!normalizedWSI.image_url) {
    return {
      normalizedWSI,
      isValid: false,
      error: "No valid image URL found in WSI object (checked image_url, slide_url, case_url)",
    };
  }

  return { normalizedWSI, isValid: true };
}

// Fast prompt builder - Pre-compute prompt structure
function buildOptimizedPrompt(
  normalizedWSI: VirtualSlide,
  context: unknown | null = null,
  customPrompt?: string
): string {
  if (customPrompt) return customPrompt;
  return buildQuestionPrompt(normalizedWSI, context as Record<string, unknown> | null);
}

// Enhanced question generation with retry logic for each model
async function generateQuestionWithRetries(
  wsi: VirtualSlide,
  modelId: string,
  context: unknown | null = null,
  customPrompt?: string
): Promise<{
  questionData: QuestionData;
  debug: unknown;
  modelUsed: string;
  tokenUsage?: unknown;
  retryInfo?: unknown;
}> {
  let lastError: unknown = null;
  const retryInfo = { attempts: 0, totalTime: 0, retries: 0 };
  const startTime = Date.now();

  // Fast preprocessing - do validation and normalization upfront
  const { normalizedWSI, isValid, error } = preprocessWSI(wsi);
  if (!isValid) {
    throw new Error(error);
  }

  // Fast prompt building - pre-compute once
  const prompt = buildOptimizedPrompt(normalizedWSI, context, customPrompt);

  // Try the specified model with retries for transient errors
  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    retryInfo.attempts = attempt + 1;

    try {
      if (attempt === 0) {
        log.debug(`[Question Gen] Starting generation with model: ${modelId}`);
      } else {
        log.debug(
          `[Question Gen] Retry ${attempt}/${RETRY_CONFIG.maxRetries} for model: ${modelId}`
        );
        retryInfo.retries = attempt;
      }

      const result = await generateQuestionSingle(normalizedWSI, modelId, prompt);
      retryInfo.totalTime = Date.now() - startTime;

      if (attempt === 0) {
        log.debug(
          `[Question Gen] ✅ Success on first attempt with ${modelId} in ${retryInfo.totalTime}ms`
        );
      } else {
        log.debug(
          `[Question Gen] ✅ Success after ${attempt} retries with ${modelId} in ${retryInfo.totalTime}ms`
        );
      }

      return { ...result, retryInfo };
    } catch (error) {
      lastError = error;
      const errorType = classifyError(error);

      log.warn(
        `[Question Gen] Attempt ${attempt + 1} failed (${errorType}):`,
        error instanceof Error ? error.message : error
      );

      // If error is not retryable, stop trying this model
      if (errorType !== "retryable") {
        log.debug(`[Question Gen] ${errorType} error - stopping retries for ${modelId}`);
        break;
      }

      // If retryable and not the last attempt, wait before retrying
      if (attempt < RETRY_CONFIG.maxRetries) {
        const delay = getRetryDelay(attempt);
        log.debug(`[Question Gen] Retrying ${modelId} in ${delay}ms...`);
        await sleep(delay);
      } else {
        log.debug(`[Question Gen] Max retries reached for ${modelId}`);
      }
    }
  }

  // All retries exhausted for this model
  retryInfo.totalTime = Date.now() - startTime;
  throw lastError || new Error(`Model ${modelId} failed after ${RETRY_CONFIG.maxRetries} retries`);
}

// Fast API configuration lookup
function getAPIConfig(modelId: string): { provider: string; apiKey: string } {
  const provider = getModelProvider(modelId);
  const apiKey = getApiKey(provider);

  if (!apiKey) {
    throw new Error(`No API key found for model: ${modelId}`);
  }

  return { provider, apiKey };
}

// Single question generation attempt (no retries) - optimized
async function generateQuestionSingle(
  wsi: VirtualSlide,
  modelId: string,
  prompt: string
): Promise<{
  questionData: QuestionData;
  debug: unknown;
  modelUsed: string;
  tokenUsage?: unknown;
}> {
  // Fast config lookup
  const { provider, apiKey } = getAPIConfig(modelId);

  log.debug(`[Question Gen] Using model: ${modelId} (${provider})`);

  // Fast AI service dispatch - use computed provider directly
  const apiResponse = await callAIService(provider, prompt, modelId, apiKey);

  log.debug(`[Question Gen] AI service response received`);
  log.debug(`[Question Gen] Token usage from AI service:`, apiResponse.tokenUsage);

  const tokenUsage = apiResponse.tokenUsage || null;
  const generatedText = apiResponse.content;

  if (!generatedText) {
    throw new Error("No content received from AI service");
  }

  log.debug("[Question Gen] Parsing AI response...");

  // Fast parsing and validation
  const questionData = parseAndValidateQuestionFast(generatedText);

  return {
    questionData,
    debug: {
      prompt_length: prompt.length,
      response_length: generatedText.length,
      model_provider: provider,
      raw_response: generatedText.substring(0, 1000),
    },
    modelUsed: modelId,
    tokenUsage,
  };
}

// Fast JSON extraction - optimized for performance
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
 *                   enum: [retryable, fallback]
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
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    log.debug("[Question Gen] Starting unified question generation request");

    // Parse request body
    const body = await parseBody(request, generateQuestionSchema);
    if (body instanceof NextResponse) return body;
    const { context, modelIndex = 0, customPrompt, modelOverride, responseMode } = body;
    const wsi = body.wsi as unknown as VirtualSlide;

    // responseMode === "raw" → skip the strict stem/answer_options validator.
    // Caller ships its own prompt with a non-standard JSON shape (e.g. the
    // wsi-walker combined multi-question schema). We return the model's raw
    // text verbatim and let the caller parse client-side.
    if (responseMode === "raw") {
      if (!customPrompt) {
        return NextResponse.json(
          { success: false, error: "responseMode 'raw' requires customPrompt" },
          { status: 400 }
        );
      }
      const idx =
        typeof modelIndex === "number" && modelIndex >= 0 && modelIndex < WSI_FALLBACK_MODELS.length
          ? modelIndex
          : 0;
      const selectedModel = resolveModelId((modelOverride as string) || WSI_FALLBACK_MODELS[idx]);
      const { provider, apiKey } = getAPIConfig(selectedModel);
      try {
        const apiResponse = await callAIService(provider, customPrompt, selectedModel, apiKey);
        return NextResponse.json(
          {
            success: true,
            rawContent: apiResponse.content,
            metadata: {
              generated_at: new Date().toISOString(),
              generation_time_ms: Date.now() - startTime,
              model: selectedModel,
              modelIndex: modelOverride ? -1 : idx,
              diagnosis: wsi.diagnosis,
              token_usage: apiResponse.tokenUsage,
            },
          },
          {
            status: 200,
            headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
          }
        );
      } catch (rawError) {
        const errorType = classifyError(rawError);
        const nextModelIndex = idx + 1;
        const hasMoreModels = !modelOverride && nextModelIndex < WSI_FALLBACK_MODELS.length;
        return NextResponse.json(
          {
            success: false,
            error: `Model ${selectedModel} failed`,
            details: rawError instanceof Error ? rawError.message : "Unknown error",
            errorType,
            nextModelIndex: hasMoreModels ? nextModelIndex : null,
            nextModel: hasMoreModels ? WSI_FALLBACK_MODELS[nextModelIndex] : null,
            currentModelIndex: idx,
            availableModels: WSI_FALLBACK_MODELS.length,
          },
          { status: 500 }
        );
      }
    }

    // modelOverride bypasses the chain — single-model mode for debug testing
    if (modelOverride) {
      const selectedModel = resolveModelId(modelOverride as string);
      log.debug(`[Question Gen] modelOverride mode: ${selectedModel}`);
      const questionResult = await generateQuestionWithRetries(
        wsi,
        selectedModel,
        context,
        customPrompt
      );
      return NextResponse.json(
        {
          success: true,
          question: questionResult.questionData,
          metadata: {
            generated_at: new Date().toISOString(),
            generation_time_ms: Date.now() - startTime,
            model: questionResult.modelUsed,
            modelIndex: -1,
            diagnosis: wsi.diagnosis,
            token_usage: questionResult.tokenUsage,
            retry_info: questionResult.retryInfo,
            modelOverride: true,
          },
          debug: questionResult.debug,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        }
      );
    }

    // Validate modelIndex
    if (modelIndex >= WSI_FALLBACK_MODELS.length) {
      return NextResponse.json(
        {
          success: false,
          error: "All fallback models have been exhausted",
          nextModelIndex: null,
          availableModels: WSI_FALLBACK_MODELS.length,
        },
        { status: 400 }
      );
    }

    const selectedModel = WSI_FALLBACK_MODELS[modelIndex];
    log.debug(
      `[Question Gen] Generating question for: ${wsi.diagnosis} using model ${modelIndex + 1}/${WSI_FALLBACK_MODELS.length}: ${selectedModel}`
    );

    try {
      // Generate question using AI with enhanced retry logic
      const questionResult = await generateQuestionWithRetries(
        wsi,
        selectedModel,
        context,
        customPrompt
      );

      const generationTime = Date.now() - startTime;
      log.debug(`[Question Gen] Question generation completed in ${generationTime}ms`);

      const result = {
        success: true,
        question: questionResult.questionData,
        metadata: {
          generated_at: new Date().toISOString(),
          generation_time_ms: generationTime,
          model: questionResult.modelUsed,
          modelIndex: modelIndex,
          diagnosis: wsi.diagnosis,
          token_usage: questionResult.tokenUsage,
          retry_info: questionResult.retryInfo,
        },
        debug: questionResult.debug,
      };

      log.debug("[Question Gen] Final API response token_usage:", result.metadata.token_usage);

      return NextResponse.json(result, {
        status: 200,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
    } catch (modelError) {
      const errorType = classifyError(modelError);
      log.error(`[Question Gen] Model ${selectedModel} failed (${errorType}):`, modelError);

      // Determine next action based on error type
      const nextModelIndex = modelIndex + 1;
      const hasMoreModels = nextModelIndex < WSI_FALLBACK_MODELS.length;

      // Provide more informative error messages
      let errorMessage = `Model ${selectedModel} failed`;
      if (errorType === "retryable") {
        errorMessage += " (transient error - retries exhausted)";
      } else if (errorType === "fallback") {
        errorMessage += " (fundamental error - trying next model)";
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          details: modelError instanceof Error ? modelError.message : "Unknown error",
          errorType: errorType,
          nextModelIndex: hasMoreModels ? nextModelIndex : null,
          nextModel: hasMoreModels ? WSI_FALLBACK_MODELS[nextModelIndex] : null,
          currentModelIndex: modelIndex,
          availableModels: WSI_FALLBACK_MODELS.length,
          retryExhausted: errorType === "retryable",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    log.error("[Question Gen] Unexpected error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate question",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
