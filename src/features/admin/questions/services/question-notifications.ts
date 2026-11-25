import "server-only";
import { NotificationTriggers } from "@/shared/services/notification-triggers";
import { log } from "@/shared/utils/logging";
import type { TransitionResult } from "./question-service";

/**
 * Sends the in-app notification for a review transition. Notifications are best-effort: the
 * transition is already committed, so a failure here is logged and never fails the request.
 */
export async function notifyTransition(
  result: TransitionResult,
  actor: string,
  feedback?: string | null
): Promise<void> {
  try {
    const triggers = new NotificationTriggers();
    switch (result.action) {
      case "submit":
      case "reassign":
        if (result.reviewer_id) {
          await triggers.onQuestionSubmittedForReview(
            result.reviewer_id,
            result.question_id,
            result.title,
            result.created_by
          );
        }
        break;
      case "approve":
        await triggers.onQuestionApproved(
          result.created_by,
          result.question_id,
          result.title,
          actor
        );
        break;
      case "reject":
        await triggers.onQuestionRejected(
          result.created_by,
          result.question_id,
          result.title,
          actor,
          feedback ?? ""
        );
        break;
      default:
        break;
    }
  } catch (error) {
    log.error(`Error sending ${result.action} notification:`, error);
  }
}
