import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireContentRole } from "@/shared/utils/api/api-guard";
import { parseBody } from "@/shared/utils/api/parse-body";
import { createServiceRoleClient } from "@/shared/services/service-role-client";
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
  order_index: z.number().int(),
});

const createQuestionSchema = z.object({
  title: z.string().min(1),
  stem: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  teaching_point: z.string().nullish(),
  question_references: z.string().nullish(),
  question_set_id: z.string().nullish(),
  category_id: z.string().nullish(),
  lesson: z.string().nullish(),
  topic: z.string().nullish(),
  question_options: z.array(questionOptionInputSchema),
  tag_ids: z.array(z.string()).optional(),
  question_images: z.array(questionImageInputSchema).optional(),
  allowDuplicate: z.boolean().optional(), // Allow creating question with duplicate topic combination
});

type QuestionOptionInput = z.infer<typeof questionOptionInputSchema>;
type QuestionImageInput = z.infer<typeof questionImageInputSchema>;

/**
 * @swagger
 * /api/admin/questions/create:
 *   post:
 *     summary: Create a new question
 *     description: Create a new draft question with options, tags, and images. Requires admin, creator, or reviewer role.
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
 *         description: Forbidden - requires admin, creator, or reviewer role
 *       500:
 *         description: Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check - require admin, creator, or reviewer role
    const auth = requireContentRole(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    // Use service role client for database operations to bypass RLS
    const supabase = createServiceRoleClient();

    const questionData = await parseBody(request, createQuestionSchema);
    if (questionData instanceof NextResponse) return questionData;

    // Check for duplicate topic combination if not explicitly allowed
    if (
      !questionData.allowDuplicate &&
      questionData.category_id &&
      questionData.lesson &&
      questionData.topic
    ) {
      const { data: existingQuestions, error: checkError } = await supabase
        .from("questions")
        .select("id, title")
        .eq("category_id", questionData.category_id)
        .eq("lesson", questionData.lesson)
        .eq("topic", questionData.topic)
        .limit(5);

      if (checkError) {
        log.error("Error checking for duplicates:", checkError);
        // Don't fail the request, just continue
      } else if (existingQuestions && existingQuestions.length > 0) {
        return NextResponse.json(
          {
            error: "DUPLICATE_TOPIC",
            message: "A question with this topic combination already exists",
            existingQuestions: existingQuestions.map((q) => ({
              id: q.id,
              title: q.title,
            })),
            details: {
              category_id: questionData.category_id,
              lesson: questionData.lesson,
              topic: questionData.topic,
            },
          },
          { status: 409 } // 409 Conflict
        );
      }
    }

    // Start a transaction to create the question and related data
    const { data: question, error: questionError } = await supabase
      .from("questions")
      .insert({
        title: questionData.title,
        stem: questionData.stem,
        difficulty: questionData.difficulty,
        teaching_point: questionData.teaching_point,
        question_references: questionData.question_references,
        status: "draft",
        question_set_id: questionData.question_set_id,
        category_id: questionData.category_id,
        lesson: questionData.lesson,
        topic: questionData.topic,
        created_by: userId,
        updated_by: userId,
        version_major: 1,
        version_minor: 0,
        version_patch: 0,
      })
      .select()
      .single();

    if (questionError) {
      log.error("Error creating question:", questionError);

      // Check if it's a duplicate constraint error (in case our check missed it)
      if (
        questionError.code === "23505" &&
        questionError.message.includes("idx_questions_unique_topic_combination")
      ) {
        return NextResponse.json(
          {
            error: "DUPLICATE_TOPIC",
            message: "A question with this topic combination already exists",
            details: questionError.message,
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Failed to create question", details: questionError.message },
        { status: 500 }
      );
    }

    // Create question options
    if (questionData.question_options && questionData.question_options.length > 0) {
      const answerOptions = questionData.question_options.map(
        (option: QuestionOptionInput, index: number) => ({
          question_id: question.id,
          text: option.text,
          is_correct: option.is_correct ?? false,
          explanation: option.explanation || null,
          order_index: option.order_index ?? index,
          // Note: Don't include 'id' field - let database generate UUID
        })
      );

      const { error: optionsError } = await supabase.from("question_options").insert(answerOptions);

      if (optionsError) {
        log.error("Error creating answer options:", optionsError);
        log.error("Options data:", answerOptions);
        // Clean up the question if options failed
        await supabase.from("questions").delete().eq("id", question.id);
        return NextResponse.json(
          {
            error: "Failed to create answer options",
            details: optionsError.message,
          },
          { status: 500 }
        );
      }
    }

    // Create question tags
    if (questionData.tag_ids && questionData.tag_ids.length > 0) {
      const questionTags = questionData.tag_ids.map((tagId: string) => ({
        question_id: question.id,
        tag_id: tagId,
      }));

      const { error: tagsError } = await supabase.from("question_tags").insert(questionTags);

      if (tagsError) {
        log.error("Error creating question tags:", tagsError);
        // Don't fail the entire operation for tags
      }
    }

    // Handle question images if provided
    if (questionData.question_images && questionData.question_images.length > 0) {
      const questionImages = questionData.question_images.map((img: QuestionImageInput) => ({
        question_id: question.id,
        image_id: img.image_id, // This should be set after image upload
        question_section: img.question_section,
        order_index: img.order_index,
      }));

      const { error: imagesError } = await supabase.from("question_images").insert(questionImages);

      if (imagesError) {
        log.error("Error creating question images:", imagesError);
        // Don't fail the entire operation for images
      }
    }

    // Revalidate caches to update all admin pages
    revalidateQuestions({ questionId: question.id, includeDashboard: true });

    return NextResponse.json({
      success: true,
      question: {
        id: question.id,
        title: question.title,
        status: question.status,
      },
    });
  } catch (error) {
    log.error("Error in create question API:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}
