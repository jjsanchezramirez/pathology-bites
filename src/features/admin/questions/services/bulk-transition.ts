import "server-only";
import { log } from "@/shared/utils/logging";
import { notifyTransition } from "./question-notifications";
import {
  QuestionWriteError,
  transitionQuestion,
  type QuestionAction,
  type TransitionResult,
} from "./question-service";

export interface BulkTransitionOutcome {
  done: TransitionResult[];
  errors: { id: string; error: string }[];
}

/**
 * Runs one review transition on each question in turn. Each question is its own transaction,
 * so one refusal (wrong status, missing permission, incomplete question) is reported for that
 * question and the rest still go through. Notifications go out for the ones that succeeded.
 */
export async function runBulkTransition(
  actor: string,
  questionIds: string[],
  action: QuestionAction,
  args: { reviewerId?: string | null; feedback?: string | null; notes?: string | null } = {}
): Promise<BulkTransitionOutcome> {
  const done: TransitionResult[] = [];
  const errors: { id: string; error: string }[] = [];

  for (const id of questionIds) {
    try {
      done.push(await transitionQuestion({ actor, questionId: id, action, ...args }));
    } catch (error) {
      if (error instanceof QuestionWriteError) {
        errors.push({ id, error: error.message });
      } else {
        log.error(`Bulk ${action} failed for question ${id}:`, error);
        errors.push({ id, error: "Unexpected error" });
      }
    }
  }

  await Promise.allSettled(done.map((result) => notifyTransition(result, actor, args.feedback)));
  return { done, errors };
}
