import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/shared/utils/api/api-guard";
import { parseBody } from "@/shared/utils/api/parse-body";
import { createServiceRoleClient } from "@/shared/services/service-role-client";
import {
  saveQuestion,
  writeErrorResponse,
} from "@/features/admin/questions/services/question-service";
import { revalidateQuestions } from "@/shared/utils/api/revalidation";
import { log } from "@/shared/utils/logging";

const questionOptionInputSchema = z.object({
  text: z.string(),
  is_correct: z.boolean().optional(),
  explanation: z.string().nullish(),
  order_index: z.number().int().optional(),
});

const questionImageInputSchema = z.object({
  image_id: z.string(),
  question_section: z.string(),
  order_index: z.number().int().optional(),
});

const createQuestionSchema = z.object({
  title: z.string().min(1),
  stem: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  // NOT NULL in the database but empty strings are allowed (drafts can be saved without
  // one), so a missing value becomes "" instead of a null that failed the insert with a 500.
  teaching_point: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  question_references: z.string().nullish(),
  question_set_id: z.string().nullish(),
  category_id: z.string().nullish(),
  lesson: z.string().nullish(),
  topic: z.string().nullish(),
  question_options: z.array(questionOptionInputSchema),
  tag_ids: z.array(z.string()).optional(),
  question_images: z.array(questionImageInputSchema).optional(),
  allowDuplicate: z.boolean().optional(), // Allow creating question with duplicate topic combination
  // Where the question came from. Required for people; ignored for bot accounts, whose
  // questions are always recorded as llm_batch by the database.
  source: z.enum(["manual", "ai_assisted", "llm_batch", "import"]).optional(),
  source_detail: z.record(z.string(), z.unknown()).optional(),
  anki_card_id: z.union([z.string(), z.number()]).nullish(),
  anki_deck_name: z.string().nullish(),
});

/**
 * @swagger
 * /api/admin/questions/create:
 *   post:
 *     summary: Create a new question
 *     description: Create a new draft question with options, tags, and images. Requires the create_questions permission (admins hold every permission).
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
 *               - title
 *               - stem
 *               - question_options
 *             properties:
 *               title:
 *                 type: string
 *                 description: Question title
 *               stem:
 *                 type: string
 *                 description: Question body/stem
 *               difficulty:
 *                 type: string
 *                 enum: [easy, medium, hard]
 *                 description: Question difficulty level
 *               teaching_point:
 *                 type: string
 *                 description: Key learning objective
 *               question_references:
 *                 type: string
 *                 description: Academic references
 *               question_set_id:
 *                 type: string
 *                 format: uuid
 *                 description: Associated question set
 *               category_id:
 *                 type: string
 *                 format: uuid
 *                 description: Associated category
 *               lesson:
 *                 type: string
 *                 description: Lesson name
 *               topic:
 *                 type: string
 *                 description: Topic name
 *               question_options:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - text
 *                   properties:
 *                     text:
 *                       type: string
 *                     is_correct:
 *                       type: boolean
 *                       default: false
 *                     explanation:
 *                       type: string
 *                     order_index:
 *                       type: integer
 *               tag_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Tag IDs to associate
 *               question_images:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - image_id
 *                     - question_section
 *                     - order_index
 *                   properties:
 *                     image_id:
 *                       type: string
 *                       format: uuid
 *                     question_section:
 *                       type: string
 *                       enum: [stem, option, explanation]
 *                     order_index:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Question created successfully
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
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     title:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [draft]
 *       400:
 *         description: Bad request - missing required fields
 *       401:
 *         description: Unauthorized - missing authentication
 *       403:
 *         description: Forbidden - requires create_questions permission
 *       500:
 *         description: Internal server error
 */
// Options are stored in array order; honour order_index when every option sends one.
function sortByOrderIndex<T extends { order_index?: number }>(options: T[]): T[] {
  if (!options.every((o) => typeof o.order_index === "number")) return options;
  return [...options].sort((a, b) => (a.order_index as number) - (b.order_index as number));
}

export async function POST(request: NextRequest) {
  try {
    const auth = requirePermission(request, "create_questions");
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const questionData = await parseBody(request, createQuestionSchema);
    if (questionData instanceof NextResponse) return questionData;

    // Warn about a question on the same category + lesson + topic unless the caller confirmed.
    if (
      !questionData.allowDuplicate &&
      questionData.category_id &&
      questionData.lesson &&
      questionData.topic
    ) {
      const { data: existingQuestions, error: checkError } = await createServiceRoleClient()
        .from("questions")
        .select("id, title")
        .eq("category_id", questionData.category_id)
        .eq("lesson", questionData.lesson)
        .eq("topic", questionData.topic)
        .neq("status", "archived")
        .limit(5);

      if (checkError) {
        log.error("Error checking for duplicates:", checkError);
      } else if (existingQuestions && existingQuestions.length > 0) {
        return NextResponse.json(
          {
            error: "DUPLICATE_TOPIC",
            message: "A question with this topic combination already exists",
            existingQuestions: existingQuestions.map((q) => ({ id: q.id, title: q.title })),
            details: {
              category_id: questionData.category_id,
              lesson: questionData.lesson,
              topic: questionData.topic,
            },
          },
          { status: 409 }
        );
      }
    }

    const result = await saveQuestion({
      actor: userId,
      questionId: null,
      payload: {
        title: questionData.title,
        stem: questionData.stem,
        teaching_point: questionData.teaching_point,
        question_references: questionData.question_references ?? null,
        difficulty: questionData.difficulty ?? null,
        lesson: questionData.lesson ?? null,
        topic: questionData.topic ?? null,
        question_set_id: questionData.question_set_id || null,
        category_id: questionData.category_id || null,
        anki_card_id:
          questionData.anki_card_id === undefined || questionData.anki_card_id === null
            ? null
            : String(questionData.anki_card_id),
        anki_deck_name: questionData.anki_deck_name ?? null,
        ...(questionData.source && { source: questionData.source }),
        ...(questionData.source_detail && { source_detail: questionData.source_detail }),
        options: sortByOrderIndex(questionData.question_options).map((option) => ({
          text: option.text,
          is_correct: option.is_correct ?? false,
          explanation: option.explanation || null,
        })),
        images: (questionData.question_images ?? []).map((img) => ({
          image_id: img.image_id,
          question_section: img.question_section,
          ...(img.order_index !== undefined && { order_index: img.order_index }),
        })),
        tag_ids: questionData.tag_ids ?? [],
      },
    }).catch(writeErrorResponse);
    if (result instanceof NextResponse) return result;

    revalidateQuestions({ questionId: result.question_id, includeDashboard: true });

    return NextResponse.json({
      success: true,
      question: {
        id: result.question_id,
        title: result.title,
        status: result.status,
      },
    });
  } catch (error) {
    log.error("Error in create question API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
