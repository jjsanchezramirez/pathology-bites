import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/shared/utils/api/api-guard";
import { createServiceRoleClient } from "@/shared/services/service-role-client";
import { parseBody } from "@/shared/utils/api/parse-body";
import { revalidateQuestions } from "@/shared/utils/api/revalidation";
import { formatVersion } from "@/shared/utils/version";
import { log } from "@/shared/utils/logging";
import {
  questionUpdateBodySchema,
  type QuestionUpdateBody,
} from "@/features/admin/questions/services/question-update-schema";
import {
  saveQuestion,
  transitionQuestion,
  writeErrorResponse,
  type LiveUpdateType,
  type QuestionAction,
  type QuestionPayload,
} from "@/features/admin/questions/services/question-service";
import { notifyTransition } from "@/features/admin/questions/services/question-notifications";

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

    // Admins; authors (create_questions) on their own questions; reviewers on
    // questions awaiting review.
    const canAccess =
      userRole === "admin" ||
      (question.created_by === userId && auth.can("create_questions")) ||
      (auth.can("review_questions") && question.status === "pending_review");

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

/** Maps the edit form's body onto the save_question payload (same field rules as before). */
function toPayload(body: QuestionUpdateBody, isLiveMinorOrMajor: boolean): QuestionPayload {
  const q = body.questionData ?? {};
  const payload: QuestionPayload = {
    // Empty title, stem, difficulty or teaching point are left unchanged, as before.
    ...(q.title && { title: q.title }),
    ...(q.stem && { stem: q.stem }),
    ...(q.difficulty && { difficulty: q.difficulty }),
    ...(q.teaching_point && { teaching_point: q.teaching_point }),
    ...(q.question_references !== undefined && { question_references: q.question_references }),
    ...(q.lesson !== undefined && { lesson: q.lesson }),
    ...(q.topic !== undefined && { topic: q.topic }),
    ...(q.question_set_id !== undefined && { question_set_id: q.question_set_id }),
    ...(q.anki_card_id !== undefined && {
      anki_card_id: q.anki_card_id === null ? null : String(q.anki_card_id),
    }),
    ...(q.anki_deck_name !== undefined && { anki_deck_name: q.anki_deck_name }),
    ...(body.categoryId !== undefined && { category_id: body.categoryId }),
  };
  if (body.answerOptions) {
    payload.options = body.answerOptions.map((o) => ({
      ...(o.id && { id: o.id }),
      text: o.text,
      is_correct: o.is_correct,
      explanation: o.explanation || null,
    }));
  }
  if (body.questionImages) {
    payload.images = body.questionImages.map((img) => ({
      image_id: img.image_id,
      question_section: img.question_section,
    }));
  }
  if (body.tagIds !== undefined) {
    payload.tag_ids = (body.tagIds ?? []).filter((id): id is string => !!id);
  }
  const reviewer = body.reviewerId || q.reviewer_id;
  if (isLiveMinorOrMajor && reviewer) payload.reviewer_id = reviewer;
  return payload;
}

/** A status change requested through the edit form becomes the matching review action. */
function statusChangeAction(from: string, to: string): QuestionAction | "invalid" | null {
  if (!to || to === from) return null;
  if (to === "pending_review") return "submit";
  if (to === "published") return "approve";
  if (to === "archived") return "archive";
  if (to === "draft" && from === "archived") return "restore";
  return "invalid";
}

/**
 * @swagger
 * /api/admin/questions/{id}:
 *   patch:
 *     summary: Edit a question
 *     description: >
 *       Saves the edit atomically through save_question and stores a full after-save snapshot.
 *       Published and flagged questions take a patch (default), minor or major edit; minor and
 *       major edits go back to review and need a reviewer. A status change in questionData is
 *       applied afterwards as the matching review action (submit, approve, archive, restore).
 *     tags:
 *       - Admin - Questions
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: questionId } = await params;

    const auth = requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const body = await parseBody(request, questionUpdateBodySchema);
    if (body instanceof NextResponse) return body;

    const adminClient = createServiceRoleClient();
    const { data: current, error: currentError } = await adminClient
      .from("questions")
      .select("id, status, reviewer_id")
      .eq("id", questionId)
      .maybeSingle();
    if (currentError) {
      log.error("PATCH - question fetch failed:", currentError);
      return NextResponse.json({ error: "Failed to load the question" }, { status: 500 });
    }
    if (!current) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const isLive = current.status === "published" || current.status === "flagged";
    let updateType: LiveUpdateType | null = null;
    if (isLive) {
      updateType =
        body.isPatchEdit || !body.updateType || !["minor", "major"].includes(body.updateType)
          ? "patch"
          : (body.updateType as LiveUpdateType);
    }

    const targetStatus = body.questionData?.status ?? "";
    // A minor/major edit already sends the question to review; don't submit it twice.
    const action =
      updateType === "minor" || updateType === "major"
        ? null
        : statusChangeAction(current.status ?? "", targetStatus);
    if (action === "invalid") {
      return NextResponse.json(
        { error: `Use the review actions to move a question to ${targetStatus}` },
        { status: 400 }
      );
    }

    const saved = await saveQuestion({
      actor: userId,
      questionId,
      payload: toPayload(body, updateType === "minor" || updateType === "major"),
      changeSummary: body.changeSummary || body.patchEditReason || null,
      updateType,
    }).catch(writeErrorResponse);
    if (saved instanceof NextResponse) return saved;

    let status = saved.status;
    let versionId = saved.version_id;
    if (action) {
      const transitioned = await transitionQuestion({
        actor: userId,
        questionId,
        action,
        reviewerId: body.reviewerId || body.questionData?.reviewer_id || current.reviewer_id,
      }).catch((error) => error);
      if (transitioned instanceof Error) {
        revalidateQuestions({ questionId, includeDashboard: true });
        const response = writeErrorResponse(transitioned);
        const { error } = (await response.json()) as { error: string };
        return NextResponse.json(
          { error: `Your changes were saved, but the status was not changed: ${error}` },
          { status: response.status }
        );
      }
      status = transitioned.status;
      versionId = transitioned.version_id;
      await notifyTransition(transitioned, userId);
    } else if (saved.status === "pending_review" && current.status !== "pending_review") {
      // A minor or major edit of a live question went back to review.
      await notifyTransition(
        {
          question_id: questionId,
          action: "submit",
          previous_status: current.status ?? "",
          status: saved.status,
          reviewer_id: saved.reviewer_id,
          created_by: saved.created_by,
          title: saved.title,
          version_id: saved.version_id,
        },
        userId
      );
    }

    revalidateQuestions({ questionId, includeDashboard: true });

    const { major, minor, patch } = saved.version;
    const versionString = formatVersion(major, minor, patch, false);
    return NextResponse.json({
      success: true,
      question: {
        id: questionId,
        version_major: major,
        version_minor: minor,
        version_patch: patch,
        status,
      },
      versionId,
      message: isLive
        ? `Question updated to version ${versionString}`
        : "Question updated successfully",
    });
  } catch (error) {
    log.error("Error in question update API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
