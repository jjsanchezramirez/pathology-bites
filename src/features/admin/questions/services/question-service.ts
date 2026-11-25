import "server-only";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/shared/services/service-role-client";
import { log } from "@/shared/utils/logging";
import type { QuestionSource } from "@/shared/types/questions";

/**
 * The one write path for questions. Every create, edit and status change goes through the
 * `save_question` / `transition_question` database functions, which check the acting user's
 * permissions, apply the change atomically and store a full after-save snapshot in
 * `question_versions`. Routes call these helpers with the user id from the middleware headers;
 * the functions are executable by service_role only (auth.uid() is NULL there, hence `actor`).
 */

export type { QuestionSource };
export type LiveUpdateType = "patch" | "minor" | "major";
export type QuestionAction = "submit" | "approve" | "reject" | "reassign" | "archive" | "restore";

export interface QuestionPayload {
  title?: string;
  stem?: string;
  teaching_point?: string | null;
  question_references?: string | null;
  difficulty?: "easy" | "medium" | "hard" | null;
  lesson?: string | null;
  topic?: string | null;
  question_set_id?: string | null;
  category_id?: string | null;
  anki_card_id?: string | null;
  anki_deck_name?: string | null;
  source?: QuestionSource;
  source_detail?: Record<string, unknown>;
  reviewer_id?: string;
  options?: Array<{ id?: string; text: string; is_correct?: boolean; explanation?: string | null }>;
  images?: Array<{ image_id: string; question_section: string; order_index?: number }>;
  tag_ids?: string[];
}

export interface SaveResult {
  question_id: string;
  status: string;
  reviewer_id: string | null;
  created_by: string;
  title: string;
  update_type: "create" | "edit" | LiveUpdateType;
  version: { major: number; minor: number; patch: number };
  version_id: string;
}

export interface TransitionResult {
  question_id: string;
  action: QuestionAction;
  previous_status: string;
  status: string;
  reviewer_id: string | null;
  created_by: string;
  title: string;
  version_id: string;
}

/** A refusal from the database functions, carrying the HTTP status it maps to. */
export class QuestionWriteError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "QuestionWriteError";
  }
}

// Custom SQLSTATEs raised by the functions, plus the Postgres errors bad input can cause.
const STATUS_BY_CODE: Record<string, number> = {
  PBA01: 403,
  PBN01: 404,
  PBV01: 400,
  PBC01: 409,
  "22P02": 400, // invalid uuid / enum / boolean text
  "23502": 400, // a required value is missing
  "23503": 400, // a referenced category, set, image, tag or reviewer does not exist
  "23505": 409,
  "23514": 400, // a check constraint
  "40001": 409, // serialization failure
  "40P01": 409, // deadlock
};

function toWriteError(
  error: { code?: string; message: string; details?: string | null },
  context: string
): QuestionWriteError {
  const status = (error.code && STATUS_BY_CODE[error.code]) || 500;
  if (status === 500) log.error(`${context} failed:`, error);
  const message =
    status === 500
      ? "Failed to save the question"
      : error.code?.startsWith("PB")
        ? error.message
        : `Invalid data: ${error.message}`;
  return new QuestionWriteError(message, status, error.code);
}

export async function saveQuestion(input: {
  actor: string;
  questionId: string | null;
  payload: QuestionPayload;
  changeSummary?: string | null;
  updateType?: LiveUpdateType | null;
}): Promise<SaveResult> {
  const { data, error } = await createServiceRoleClient().rpc("save_question", {
    p_actor: input.actor,
    p_question_id: input.questionId as string,
    p_payload: input.payload as never,
    p_change_summary: input.changeSummary ?? undefined,
    p_update_type: input.updateType ?? undefined,
  });
  if (error) throw toWriteError(error, "save_question");
  return data as unknown as SaveResult;
}

export async function transitionQuestion(input: {
  actor: string;
  questionId: string;
  action: QuestionAction;
  reviewerId?: string | null;
  feedback?: string | null;
  notes?: string | null;
}): Promise<TransitionResult> {
  const { data, error } = await createServiceRoleClient().rpc("transition_question", {
    p_actor: input.actor,
    p_question_id: input.questionId,
    p_action: input.action,
    p_reviewer_id: input.reviewerId ?? undefined,
    p_feedback: input.feedback ?? undefined,
    p_notes: input.notes ?? undefined,
  });
  if (error) throw toWriteError(error, "transition_question");
  return data as unknown as TransitionResult;
}

/** Route helper: a QuestionWriteError becomes its JSON response; anything else is rethrown. */
export function writeErrorResponse(error: unknown): NextResponse {
  if (error instanceof QuestionWriteError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  throw error;
}
