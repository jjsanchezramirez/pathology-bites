import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/shared/services/service-role-client";
import { requireUser } from "@/shared/utils/api/api-guard";
import { revalidateQuestions } from "@/shared/utils/api/revalidation";
import { log } from "@/shared/utils/logging";
import { notifyTransition } from "./question-notifications";
import { transitionQuestion, writeErrorResponse, type QuestionAction } from "./question-service";

/**
 * Shared body of the single-question review routes (submit, approve, reject, reassign,
 * archive, restore). Permission and state checks live in transition_question; this runs it,
 * sends the notification, revalidates caches and returns the updated question row.
 */
export async function runTransitionRoute(
  request: NextRequest,
  questionId: string,
  action: QuestionAction,
  args: { reviewerId?: string | null; feedback?: string | null; notes?: string | null } = {}
): Promise<NextResponse> {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const result = await transitionQuestion({
    actor: auth.userId,
    questionId,
    action,
    ...args,
  }).catch(writeErrorResponse);
  if (result instanceof NextResponse) return result;

  await notifyTransition(result, auth.userId, args.feedback);
  revalidateQuestions({ questionId, includeDashboard: true });

  const { data: question, error } = await createServiceRoleClient()
    .from("questions")
    .select("*")
    .eq("id", questionId)
    .maybeSingle();
  if (error) log.error(`Fetching question after ${action} failed:`, error);

  return NextResponse.json({
    success: true,
    question: question ?? { id: questionId, status: result.status },
  });
}
