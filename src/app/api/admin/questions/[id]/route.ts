import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/shared/utils/api/api-guard";
import { createServiceRoleClient } from "@/shared/services/service-role-client";
import { parseBody } from "@/shared/utils/api/parse-body";
import { revalidateQuestions } from "@/shared/utils/api/revalidation";
import { formatVersion } from "@/shared/utils/version";
import { log } from "@/shared/utils/logging";
import { canEditQuestion } from "@/features/admin/questions/services/can-edit-question";
import { questionUpdateBodySchema } from "@/features/admin/questions/services/question-update-schema";
import { resolveQuestionUpdate } from "@/features/admin/questions/services/resolve-question-update";
import { syncAnswerOptions } from "@/features/admin/questions/services/sync-answer-options";
import {
  syncQuestionImages,
  syncQuestionTags,
  updateQuestionCategory,
} from "@/features/admin/questions/services/sync-question-relations";
import { applyQuestionVersioning } from "@/features/admin/questions/services/question-versioning";

/**
 * @swagger
 * /api/admin/questions/{id}:
 *   get:
 *     summary: Get question details
 *     description: Retrieve full question details including options, tags, images, and metadata. Requires authentication and appropriate permissions.
 *     tags:
 *       - Admin - Questions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Question ID
 *     responses:
 *       200:
 *         description: Successfully retrieved question
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 question:
 *                   type: object
 *                   description: Full question object with nested relations
 *       401:
 *         description: Unauthorized - missing authentication
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Question not found
 *       500:
 *         description: Internal server error
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: questionId } = await params;

    // Auth is handled by middleware - get user ID and role from headers
    const auth = requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;
    const userRole = auth.role;

    log.debug("GET - User authenticated:", userId, "Role:", userRole);

    // Use admin client for the actual operations
    const adminClient = await createServiceRoleClient();

    // First, try a simple query to see if the question exists
    const { data: simpleQuestion, error: simpleError } = await adminClient
      .from("questions")
      .select(
        "id, title, stem, status, created_by, updated_by, version_major, version_minor, version_patch"
      )
      .eq("id", questionId)
      .single();

    if (simpleError || !simpleQuestion) {
      log.error("Simple question fetch error:", simpleError);
      log.error("Question ID:", questionId);
      return NextResponse.json(
        { error: "Question not found in simple query", details: simpleError?.message },
        { status: 404 }
      );
    }

    // Now try the complex query
    const { data: question, error: questionError } = await adminClient
      .from("questions")
      .select(
        `
        id,
        title,
        stem,
        difficulty,
        teaching_point,
        question_references,
        status,
        question_set_id,
        category_id,
        lesson,
        topic,
        anki_card_id,
        anki_deck_name,
        created_by,
        updated_by,
        reviewer_id,
        created_at,
        updated_at,
        version_major,
        version_minor,
        version_patch,
        question_set:question_sets(
          id,
          name,
          source_type,
          source_details,
          short_form
        ),
        category:categories(
          id,
          name
        ),
        created_by_user:users!questions_created_by_fkey(
          first_name,
          last_name
        ),
        updated_by_user:users!questions_updated_by_fkey(
          first_name,
          last_name
        ),
        question_images(
          image_id,
          question_section,
          order_index,
          image:images(
            id,
            url,
            alt_text,
            description,
            category
          )
        ),
        question_options(
          id,
          text,
          is_correct,
          explanation,
          order_index
        ),
        question_tags(
          tag:tags(
            id,
            name,
            created_at
          )
        )
      `
      )
      .eq("id", questionId)
      .single();

    if (questionError || !question) {
      log.error("Question fetch error:", questionError);
      log.error("Question ID:", questionId);
      log.error("Question data:", question);
      return NextResponse.json(
        { error: "Question not found", details: questionError?.message },
        { status: 404 }
      );
    }

    // Check permissions based on question status and user role
    const canAccess =
      userRole === "admin" ||
      (question.created_by === userId && ["admin", "creator"].includes(userRole || "")) ||
      (["reviewer", "admin"].includes(userRole || "") && question.status === "pending_review");

    if (!canAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions to access this question" },
        { status: 403 }
      );
    }

    // Flatten the tags structure and add user names for easier consumption
    const questionWithFlattenedTags = {
      ...question,
      tags:
        (
          (question.question_tags || []) as unknown as Array<{
            tag: { id: string; name: string; created_at: string } | null;
          }>
        )
          .map((qt) => qt.tag)
          .filter((tag): tag is NonNullable<typeof tag> => tag !== null) || [],
      created_by_name: question.created_by_user
        ? `${(question.created_by_user as { first_name?: string }).first_name || ""} ${(question.created_by_user as { last_name?: string }).last_name || ""}`.trim() ||
          "Unknown"
        : "Unknown",
      updated_by_name: question.updated_by_user
        ? `${(question.updated_by_user as { first_name?: string }).first_name || ""} ${(question.updated_by_user as { last_name?: string }).last_name || ""}`.trim() ||
          "Unknown"
        : "Unknown",
    };

    return NextResponse.json({
      success: true,
      question: questionWithFlattenedTags,
    });
  } catch (error) {
    log.error("Error fetching question:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/admin/questions/{id}:
 *   patch:
 *     summary: Update a question
 *     description: |
 *       Update question with role-based permissions and versioning.
 *
 *       Permission Rules:
 *       - Admins: Can edit any question
 *       - Creators: Can edit own draft/rejected/pending questions
 *       - Reviewers: Can make patch edits to assigned pending questions
 *
 *       Versioning:
 *       - Published questions create version history
 *       - Supports patch (typos), minor (updates), and major (breaking) changes
 *     tags:
 *       - Admin - Questions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Question ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               questionData:
 *                 type: object
 *                 properties:
 *                   title:
 *                     type: string
 *                   stem:
 *                     type: string
 *                   difficulty:
 *                     type: string
 *                     enum: [easy, medium, hard]
 *                   teaching_point:
 *                     type: string
 *                   question_references:
 *                     type: string
 *                   question_set_id:
 *                     type: string
 *                     format: uuid
 *                   lesson:
 *                     type: string
 *                   topic:
 *                     type: string
 *                   status:
 *                     type: string
 *                     enum: [draft, pending_review, published, rejected]
 *               answerOptions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     text:
 *                       type: string
 *                     is_correct:
 *                       type: boolean
 *                     explanation:
 *                       type: string
 *               questionImages:
 *                 type: array
 *                 items:
 *                   type: object
 *               tagIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *               isPatchEdit:
 *                 type: boolean
 *                 description: Minor typo/wording fixes
 *               patchEditReason:
 *                 type: string
 *               updateType:
 *                 type: string
 *                 enum: [patch, minor, major]
 *               reviewerId:
 *                 type: string
 *                 format: uuid
 *               changeSummary:
 *                 type: string
 *     responses:
 *       200:
 *         description: Question updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 question:
 *                   type: object
 *                 versionId:
 *                   type: string
 *                   format: uuid
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request - invalid data
 *       401:
 *         description: Unauthorized - missing authentication
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Question not found
 *       500:
 *         description: Internal server error
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: questionId } = await params;

    // Auth is handled by middleware - get user ID and role from headers
    const auth = requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;
    const userRole = auth.role;

    log.debug("PATCH - User authenticated:", userId, "Role:", userRole);

    const body = await parseBody(request, questionUpdateBodySchema);
    if (body instanceof NextResponse) return body;
    const { answerOptions, questionImages, tagIds, categoryId, isPatchEdit } = body;

    // Use admin client for the actual operations
    const adminClient = createServiceRoleClient();

    // Get current question to check status and permissions
    log.debug("PATCH - Fetching question with ID:", questionId);
    const { data: currentQuestion, error: questionError } = await adminClient
      .from("questions")
      .select(
        "id, status, created_by, reviewer_id, version_major, version_minor, version_patch, title, stem, difficulty, teaching_point, question_references, question_set_id, category_id, lesson, topic, anki_card_id, anki_deck_name"
      )
      .eq("id", questionId)
      .single();

    log.debug("PATCH - Question fetch result:", {
      found: !!currentQuestion,
      error: questionError?.message,
      status: currentQuestion?.status,
    });

    if (questionError || !currentQuestion) {
      log.error("PATCH - Question fetch error:", {
        questionId,
        error: questionError,
        message: questionError?.message,
        details: questionError?.details,
        hint: questionError?.hint,
        code: questionError?.code,
      });
      return NextResponse.json(
        {
          error: "Question not found",
          details: questionError?.message,
          questionId,
        },
        { status: 404 }
      );
    }

    // Role/status/ownership permission matrix — see canEditQuestion
    const permission = canEditQuestion({
      role: userRole,
      userId,
      question: currentQuestion,
      isPatchEdit: !!isPatchEdit,
    });
    if (!permission.allowed) {
      return NextResponse.json(
        { error: permission.error, message: permission.message },
        { status: 403 }
      );
    }

    // Start transaction-like operations
    try {
      // Status-transition rules + main questions UPDATE payload
      const { validQuestionFields, isFirstTimePublishing } = resolveQuestionUpdate({
        currentQuestion,
        body,
        userId,
      });

      const { error: updateError } = await adminClient
        .from("questions")
        .update(validQuestionFields)
        .eq("id", questionId);

      if (updateError) {
        throw new Error(`Failed to update question: ${updateError.message}`);
      }

      // Update answer options if provided
      if (answerOptions) {
        await syncAnswerOptions(adminClient, questionId, answerOptions);
      } else {
        log.debug("No answer options to update");
      }

      // Update question images if provided
      if (questionImages) {
        await syncQuestionImages(adminClient, questionId, questionImages);
      }

      // Update question tags if provided
      if (tagIds !== undefined) {
        await syncQuestionTags(adminClient, questionId, tagIds);
      }

      // Update category if provided
      if (categoryId !== undefined) {
        await updateQuestionCategory(adminClient, questionId, categoryId);
      }

      // Handle versioning (initial publish / patch / minor / major)
      const versionId = await applyQuestionVersioning(adminClient, {
        questionId,
        userId,
        currentQuestion,
        body,
        isFirstTimePublishing,
      });

      // Get updated question data
      const { data: updatedQuestion, error: fetchError } = await adminClient
        .from("questions")
        .select("id, version_major, version_minor, version_patch, updated_at, status")
        .eq("id", questionId)
        .single();

      if (fetchError) {
        log.error("Error fetching updated question:", fetchError);
        return NextResponse.json(
          { error: "Question updated but failed to fetch updated data" },
          { status: 500 }
        );
      }

      // Revalidate caches to update all admin pages
      revalidateQuestions({ questionId, includeDashboard: true });

      const versionString = formatVersion(
        updatedQuestion.version_major,
        updatedQuestion.version_minor,
        updatedQuestion.version_patch,
        false
      );

      return NextResponse.json({
        success: true,
        question: updatedQuestion,
        versionId,
        message: versionId
          ? `Question updated to version ${versionString}`
          : "Question updated successfully",
      });
    } catch (error) {
      log.error("Error during question update:", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to update question" },
        { status: 500 }
      );
    }
  } catch (error) {
    log.error("Error in question update API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
