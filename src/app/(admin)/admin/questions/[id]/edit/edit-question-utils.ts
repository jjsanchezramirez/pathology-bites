// Pure helpers extracted from edit-question-client.tsx so the status-banner,
// reviewer-feedback, and patch-disable logic are unit-testable in isolation
// (see edit-question-utils.test.ts).

export interface ContextBanner {
  variant: "default";
  title: string;
  description: string;
}

/** Status-driven banner shown above the edit form (null when no banner applies). */
export function getContextBanner(status: string | undefined): ContextBanner | null {
  if (status === "draft") {
    return {
      variant: "default",
      title: "Editing Draft",
      description: "This question has not been submitted for review yet.",
    };
  }
  if (status === "flagged") {
    return {
      variant: "default",
      title: "Editing Flagged Question",
      description:
        "This question was flagged for review. Make necessary changes and resubmit for review.",
    };
  }
  if (status === "published") {
    return {
      variant: "default",
      title: "Patch Editing Published Question",
      description:
        "Making changes to a published question. Select the appropriate edit type below.",
    };
  }
  if (status === "pending_review") {
    return {
      variant: "default",
      title: "Editing Question Under Review",
      description: "This question is currently being reviewed. Changes will require resubmission.",
    };
  }
  return null;
}

/** Reviewer feedback is only surfaced for flagged/rejected questions. */
export function getReviewerFeedback(question: {
  status: string;
  reviewer_feedback?: string | null;
}): string | null {
  return question.status === "flagged" || question.status === "rejected"
    ? (question.reviewer_feedback ?? null)
    : null;
}

/**
 * Patch edits are disallowed once the correct answer or the image set changes
 * (those require review). Compares current selections against the originals.
 */
export function computePatchDisabled(
  originalCorrectAnswerId: string | null,
  currentCorrectOptionId: string | undefined,
  originalImages: { image_id?: string }[],
  currentImages: { image_id?: string }[]
): boolean {
  const correctAnswerChanged = currentCorrectOptionId !== originalCorrectAnswerId;

  let imagesChanged = false;
  if (originalImages.length > 0 || currentImages.length > 0) {
    imagesChanged =
      currentImages.length !== originalImages.length ||
      currentImages.some(
        (img, idx) => !originalImages[idx] || img.image_id !== originalImages[idx].image_id
      );
  }

  return correctAnswerChanged || imagesChanged;
}
