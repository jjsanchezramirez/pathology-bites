import { QuestionWithDetails } from "@/shared/types/questions";

/**
 * Who may archive a question (mirrors transition_question's archive action, which the
 * DELETE /api/admin/questions/[id]/delete route runs; nothing is deleted):
 * - Admins can archive any question that is not already archived
 * - Holders of create_questions can archive their own draft or rejected questions
 */
export interface DeleteAccess {
  isAdmin: boolean;
  canCreate: boolean;
  userId: string | null;
}

export function canDeleteQuestion(
  question: QuestionWithDetails | null,
  access: DeleteAccess
): { canDelete: boolean; reason?: string } {
  if (!question || !access.userId) {
    return { canDelete: false, reason: "Missing required information" };
  }

  if (question.status === "archived") {
    return { canDelete: false, reason: "This question is already archived." };
  }

  if (access.isAdmin) return { canDelete: true };

  if (question.status !== "draft" && question.status !== "rejected") {
    return {
      canDelete: false,
      reason: `Only an admin can archive a ${question.status} question.`,
    };
  }

  if (access.canCreate) {
    return question.created_by === access.userId
      ? { canDelete: true }
      : { canDelete: false, reason: "You can only archive your own questions." };
  }

  return { canDelete: false, reason: "You do not have permission to archive questions." };
}

/**
 * Check if the archive action should be shown for a question
 */
export function shouldShowDeleteButton(
  question: QuestionWithDetails | null,
  access: DeleteAccess
): boolean {
  return canDeleteQuestion(question, access).canDelete;
}
