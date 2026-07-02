// src/features/admin/questions/services/resolve-question-update.ts
//
// Status-transition rules + `questions` update payload for the admin PATCH
// route. Pure computation (aside from the `updated_at` timestamp): no DB
// access. Throws Error with a user-facing message when a transition is
// invalid; the route's try/catch converts that into a 500 response (same
// behavior as the previous inline code).

import { log } from "@/shared/utils/logging";
import type { QuestionUpdateBody } from "./question-update-schema";

export interface CurrentQuestionForUpdate {
  status: string;
  reviewer_id: string | null;
}

export interface ResolvedQuestionUpdate {
  /** Payload for the main `questions` UPDATE. */
  validQuestionFields: Record<string, unknown>;
  /** True when this update transitions the question to published for the first time. */
  isFirstTimePublishing: boolean;
}

export function resolveQuestionUpdate(input: {
  currentQuestion: CurrentQuestionForUpdate;
  body: QuestionUpdateBody;
  userId: string;
}): ResolvedQuestionUpdate {
  const { currentQuestion, body, userId } = input;
  const { questionData, isPatchEdit, updateType, reviewerId } = body;

  // For published questions with minor/major edits, change status to pending_review
  let statusToSet = questionData?.status;
  const reviewerToSet = reviewerId || currentQuestion.reviewer_id;
  if (
    currentQuestion.status === "published" &&
    !isPatchEdit &&
    updateType &&
    ["minor", "major"].includes(updateType)
  ) {
    // Check if there's a reviewer (either newly assigned or existing)
    if (!reviewerToSet) {
      // No reviewer assigned - cannot move to pending_review due to constraint
      log.debug(
        `PATCH - Cannot change status to pending_review for ${updateType} edit: no reviewer assigned. Question will remain published.`
      );
      throw new Error(
        `This ${updateType} edit requires review, but no reviewer is assigned. Please either: (1) Make only patch-level edits (typos, minor fixes), or (2) Have an admin assign a reviewer first using the 'Submit for Review' option.`
      );
    }
    statusToSet = "pending_review";
    log.debug(
      `PATCH - Changing status from published to pending_review for ${updateType} edit, using reviewer: ${reviewerToSet}`
    );
  }

  // Validate status change to pending_review requires a reviewer.
  // Allow updating questions that are ALREADY pending_review (they already have
  // a reviewer), but prevent NEW transitions to pending_review without one.
  const finalStatus = statusToSet || questionData?.status;
  const isChangingToPendingReview =
    finalStatus === "pending_review" && currentQuestion.status !== "pending_review";

  if (isChangingToPendingReview && !reviewerToSet && !questionData?.reviewer_id) {
    throw new Error(
      "Cannot set status to pending_review without a reviewer. Please use the 'Submit for Review' button to assign a reviewer and change the status."
    );
  }

  const willBePendingReview = finalStatus === "pending_review";

  // First time publishing (transition to published status)?
  const isFirstTimePublishing =
    statusToSet === "published" && currentQuestion.status !== "published";

  const validQuestionFields = {
    ...(questionData?.title && { title: questionData.title }),
    ...(questionData?.stem && { stem: questionData.stem }),
    ...(questionData?.difficulty && { difficulty: questionData.difficulty }),
    ...(questionData?.teaching_point && { teaching_point: questionData.teaching_point }),
    ...(questionData?.question_references !== undefined && {
      question_references: questionData.question_references,
    }),
    ...(questionData?.lesson !== undefined && { lesson: questionData.lesson }),
    ...(questionData?.topic !== undefined && { topic: questionData.topic }),
    // DB column is text; clients send Anki's numeric card id
    ...(questionData?.anki_card_id !== undefined && {
      anki_card_id: questionData.anki_card_id === null ? null : String(questionData.anki_card_id),
    }),
    ...(questionData?.anki_deck_name !== undefined && {
      anki_deck_name: questionData.anki_deck_name,
    }),
    ...(statusToSet && { status: statusToSet }),
    ...(questionData?.question_set_id !== undefined && {
      question_set_id: questionData.question_set_id,
    }),
    // Initialize version to 1.0.0 when publishing for the first time
    ...(isFirstTimePublishing && {
      version_major: 1,
      version_minor: 0,
      version_patch: 0,
    }),
    // Ensure reviewer_id is always set when status is or will be pending_review (required by constraint)
    ...(willBePendingReview &&
      (reviewerToSet || questionData?.reviewer_id) && {
        reviewer_id: reviewerToSet || questionData?.reviewer_id,
      }),
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };

  return { validQuestionFields, isFirstTimePublishing };
}
