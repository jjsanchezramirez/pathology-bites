import { QuestionWithDetails } from "@/shared/types/questions";

/**
 * Who may delete a question (mirrors DELETE /api/admin/questions/[id]/delete):
 * - Only draft questions can be deleted
 * - Admins can delete any draft question
 * - Holders of create_questions can delete their own draft questions
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

  if (question.status !== "draft") {
    return {
      canDelete: false,
      reason: `Cannot delete ${question.status} questions. Only draft questions can be deleted.`,
    };
  }

  if (access.isAdmin) return { canDelete: true };

  if (access.canCreate) {
    return question.created_by === access.userId
      ? { canDelete: true }
      : { canDelete: false, reason: "You can only delete your own questions." };
  }

  return { canDelete: false, reason: "You do not have permission to delete questions." };
}

/**
 * Check if the delete button should be shown for a question
 */
export function shouldShowDeleteButton(
  question: QuestionWithDetails | null,
  access: DeleteAccess
): boolean {
  return canDeleteQuestion(question, access).canDelete;
}
