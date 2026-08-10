import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveModelId } from "@/shared/config/ai-models";
import { VirtualSlide } from "@/shared/types/virtual-slides";
import { parseBody } from "@/shared/utils/api/parse-body";
import { runAITask } from "@/shared/services/ai-fallback";
import { log } from "@/shared/utils/logging";
import { buildQuestionPrompt, WSI_SYSTEM_PROMPT, normalizeWSI } from "./wsi-question-prompt";
import { parseAndValidateQuestionFast } from "./wsi-question-parsing";

// wsi is a loosely-structured VirtualSlide-ish blob (normalized downstream by
// normalizeWSI) and context is prompt metadata — keep both loose.
const generateQuestionSchema = z.object({
  wsi: z.record(z.unknown()),
  context: z.unknown().optional(),
  customPrompt: z.string().optional(),
  modelOverride: z.string().optional(),
  responseMode: z.string().optional(),
});

// The whole fallback chain now runs inside this one invocation, bounded by the
// task profile's deadlineMs (35s) — comfortably inside this limit.
export const maxDuration = 45;

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
 *               modelOverride:
 *                 type: string
 *                 description: Pin one model exactly, skipping the fallback chain
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
 * *                 debug:
 *                   type: object
 *       400:
 *         description: Bad request - missing WSI parameter or all models exhausted
 *       500:
 *         description: Every model in the fallback chain failed
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
 * */ export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await parseBody(request, generateQuestionSchema);
    if (body instanceof NextResponse) return body;
    const { context, customPrompt, modelOverride, responseMode } = body;
    const wsi = body.wsi as unknown as VirtualSlide;

    // An explicitly named model is honoured exactly — no fallback.
    const pinnedModel = modelOverride ? resolveModelId(modelOverride as string) : undefined;

    // responseMode === "raw" → skip the strict stem/answer_options validator.
    // Caller ships its own prompt with a non-standard JSON shape (e.g. the
    // wsi-walker combined multi-question schema) and parses the text itself.
    if (responseMode === "raw") {
      if (!customPrompt) {
        return NextResponse.json(
          { success: false, error: "responseMode 'raw' requires customPrompt" },
          { status: 400 }
        );
      }
      const raw = await runAITask("wsi-question", customPrompt, {
        system: WSI_SYSTEM_PROMPT,
        modelOverride: pinnedModel,
        label: "Question Gen (raw)",
      });
      return NextResponse.json(
        {
          success: true,
          rawContent: raw.content,
          metadata: {
            generated_at: new Date().toISOString(),
            generation_time_ms: Date.now() - startTime,
            model: raw.model,
            diagnosis: wsi.diagnosis,
            token_usage: raw.tokenUsage,
          },
        },
        { status: 200, headers: { "Cache-Control": "no-cache, no-store, must-revalidate" } }
      );
    }

    const { normalizedWSI, isValid, error } = preprocessWSI(wsi);
    if (!isValid) {
      return NextResponse.json({ success: false, error }, { status: 400 });
    }

    const prompt = buildOptimizedPrompt(normalizedWSI, context, customPrompt);

    // The chain is walked here, server-side, in one request. Parsing runs inside
    // each attempt, so a model returning malformed JSON falls through to the
    // next model rather than failing the whole generation.
    const result = await runAITask("wsi-question", prompt, {
      system: WSI_SYSTEM_PROMPT,
      modelOverride: pinnedModel,
      label: "Question Gen",
      parse: parseAndValidateQuestionFast,
    });

    log.debug(`[Question Gen] Generated with ${result.model} in ${Date.now() - startTime}ms`);

    return NextResponse.json(
      {
        success: true,
        question: result.parsed,
        metadata: {
          generated_at: new Date().toISOString(),
          generation_time_ms: Date.now() - startTime,
          model: result.model,
          diagnosis: wsi.diagnosis,
          token_usage: result.tokenUsage,
        },
        debug: {
          prompt_length: prompt.length,
          response_length: result.content.length,
          raw_response: result.content.substring(0, 1000),
        },
      },
      { status: 200, headers: { "Cache-Control": "no-cache, no-store, must-revalidate" } }
    );
  } catch (error) {
    // Every model in the chain failed (or the deadline ran out). There is no
    // "try the next one" for the client to do — that already happened here.
    const details = error instanceof Error ? error.message : "Unknown error";
    log.error("[Question Gen] All models failed:", details);
    return NextResponse.json(
      {
        success: false,
        error: "Question generation failed. Please try again.",
        details,
        generation_time_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
