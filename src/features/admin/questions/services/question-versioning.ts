// src/features/admin/questions/services/question-versioning.ts
//
// Versioning side-effects for the admin question PATCH route:
// - first publish        → initial 1.0.0 history entry (snapshot falls back to
//                          the current row for fields the edit didn't touch)
// - published + patch    → bump version_patch, "patch" history entry
// - published + minor/major → bump version_minor/major, matching history entry
//
// Version-history insert failures are logged and swallowed (the update itself
// already succeeded); version bumps on the questions row throw on failure.
// Returns the new question_versions row id, or null when no entry was created.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/types/supabase";
import { log } from "@/shared/utils/logging";
import type { QuestionUpdateBody } from "./question-update-schema";

export interface CurrentQuestionForVersioning {
  status: string;
  version_major: number;
  version_minor: number;
  version_patch: number;
  title: string;
  stem: string;
  difficulty: string;
  teaching_point: string | null;
  question_references: string | null;
  question_set_id: string | null;
  category_id: string | null;
  lesson: string | null;
  topic: string | null;
}

/**
 * Snapshot stored in question_versions.question_data.
 *
 * With `fallback` (initial publication) fields the edit didn't set fall back
 * to the current row via `||`; without it (patch/minor/major) raw body values
 * are stored as-is — both exactly as the previous inline code did.
 */
function buildQuestionSnapshot(body: QuestionUpdateBody, fallback?: CurrentQuestionForVersioning) {
  const { questionData, answerOptions, questionImages, tagIds, categoryId } = body;
  return {
    title: fallback ? questionData?.title || fallback.title : questionData?.title,
    stem: fallback ? questionData?.stem || fallback.stem : questionData?.stem,
    difficulty: fallback
      ? questionData?.difficulty || fallback.difficulty
      : questionData?.difficulty,
    teaching_point: fallback
      ? questionData?.teaching_point || fallback.teaching_point
      : questionData?.teaching_point,
    question_references: fallback
      ? questionData?.question_references || fallback.question_references
      : questionData?.question_references,
    question_set_id: fallback
      ? questionData?.question_set_id || fallback.question_set_id
      : questionData?.question_set_id,
    category_id: fallback ? categoryId || fallback.category_id : categoryId,
    tag_ids: tagIds || [],
    question_options: answerOptions || [],
    question_images: questionImages || [],
    lesson: fallback ? questionData?.lesson || fallback.lesson : questionData?.lesson,
    topic: fallback ? questionData?.topic || fallback.topic : questionData?.topic,
  };
}

/** Insert a question_versions row; failures are logged, not thrown. */
async function insertVersionHistory(
  adminClient: SupabaseClient<Database>,
  entry: {
    question_id: string;
    version_major: number;
    version_minor: number;
    version_patch: number;
    update_type: "initial" | "patch" | "minor" | "major";
    change_summary: string;
    question_data: ReturnType<typeof buildQuestionSnapshot>;
    changed_by: string;
  }
): Promise<string | null> {
  const { data: newVersionId, error: versionError } = await adminClient
    .from("question_versions")
    .insert(entry)
    .select("id")
    .single();

  if (versionError) {
    log.error(`Error creating ${entry.update_type} version history:`, versionError);
    // Continue without version history rather than failing the entire update
    return null;
  }
  return newVersionId?.id ?? null;
}

export async function applyQuestionVersioning(
  adminClient: SupabaseClient<Database>,
  input: {
    questionId: string;
    userId: string;
    currentQuestion: CurrentQuestionForVersioning;
    body: QuestionUpdateBody;
    isFirstTimePublishing: boolean;
  }
): Promise<string | null> {
  const { questionId, userId, currentQuestion, body, isFirstTimePublishing } = input;
  const { changeSummary, isPatchEdit, patchEditReason, updateType } = body;

  // Create initial version entry when publishing for the first time
  if (isFirstTimePublishing) {
    return insertVersionHistory(adminClient, {
      question_id: questionId,
      version_major: 1,
      version_minor: 0,
      version_patch: 0,
      update_type: "initial",
      change_summary: "Initial publication",
      question_data: buildQuestionSnapshot(body, currentQuestion),
      changed_by: userId,
    });
  }

  // Versioning only applies to already-published questions beyond this point
  if (currentQuestion.status !== "published") {
    return null;
  }

  if (isPatchEdit) {
    // For patch edits, increment patch version only
    const newVersionPatch = (currentQuestion.version_patch || 0) + 1;

    const { error: versionUpdateError } = await adminClient
      .from("questions")
      .update({
        version_patch: newVersionPatch,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", questionId);

    if (versionUpdateError) {
      log.error("Error updating patch version:", versionUpdateError);
      throw new Error(`Failed to update patch version: ${versionUpdateError.message}`);
    }

    return insertVersionHistory(adminClient, {
      question_id: questionId,
      version_major: currentQuestion.version_major || 1,
      version_minor: currentQuestion.version_minor || 0,
      version_patch: newVersionPatch,
      update_type: "patch",
      change_summary: changeSummary || patchEditReason || "Patch edit",
      question_data: buildQuestionSnapshot(body),
      changed_by: userId,
    });
  }

  if (updateType && ["minor", "major"].includes(updateType)) {
    // For minor/major edits, increment appropriate version numbers
    let newVersionMajor = currentQuestion.version_major || 1;
    let newVersionMinor = currentQuestion.version_minor || 0;
    const newVersionPatch = 0;

    if (updateType === "minor") {
      newVersionMinor += 1;
    } else if (updateType === "major") {
      newVersionMajor += 1;
      newVersionMinor = 0;
    }

    const { error: versionUpdateError } = await adminClient
      .from("questions")
      .update({
        version_major: newVersionMajor,
        version_minor: newVersionMinor,
        version_patch: newVersionPatch,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", questionId);

    if (versionUpdateError) {
      log.error("Error updating version:", versionUpdateError);
      throw new Error(`Failed to update version: ${versionUpdateError.message}`);
    }

    return insertVersionHistory(adminClient, {
      question_id: questionId,
      version_major: newVersionMajor,
      version_minor: newVersionMinor,
      version_patch: newVersionPatch,
      update_type: updateType as "minor" | "major",
      change_summary: changeSummary || `${updateType} update`,
      question_data: buildQuestionSnapshot(body),
      changed_by: userId,
    });
  }

  return null;
}
