// src/features/admin/questions/services/sync-answer-options.ts
//
// Answer-option diffing for the admin question PATCH route: update options
// that carry an id, insert options without one, and delete options that were
// removed — unless a quiz attempt references them (those are kept and logged).
// Throws Error on any DB failure; the route converts that into a 500.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/types/supabase";
import { log } from "@/shared/utils/logging";
import type { AnswerOptionInput } from "./question-update-schema";

export async function syncAnswerOptions(
  adminClient: SupabaseClient<Database>,
  questionId: string,
  answerOptions: AnswerOptionInput[]
): Promise<void> {
  log.debug("Updating answer options...");

  // Get existing options for this question
  const { data: existingOptions, error: fetchError } = await adminClient
    .from("question_options")
    .select("id, text, is_correct, explanation, order_index")
    .eq("question_id", questionId);

  if (fetchError) {
    log.error("Error fetching existing options:", fetchError);
    throw new Error(`Failed to fetch existing options: ${fetchError.message}`);
  }

  // Get option IDs that are referenced by quiz attempts
  const { data: referencedOptions, error: referencedError } = await adminClient
    .from("quiz_attempts")
    .select("selected_answer_id")
    .not("selected_answer_id", "is", null)
    .in(
      "selected_answer_id",
      (existingOptions as unknown as Array<{ id: string }>)?.map((opt) => opt.id) || []
    );

  if (referencedError) {
    log.error("Error checking referenced options:", referencedError);
    throw new Error(`Failed to check referenced options: ${referencedError.message}`);
  }

  const referencedOptionIds = new Set(
    referencedOptions?.map((ref) => ref.selected_answer_id) || []
  );
  log.debug("Referenced option IDs:", Array.from(referencedOptionIds));

  // Process incoming options
  const incomingOptionIds = new Set();
  const optionsToUpdate = [];
  const optionsToInsert = [];

  for (let index = 0; index < answerOptions.length; index++) {
    const option = answerOptions[index];
    const optionData = {
      text: option.text,
      is_correct: option.is_correct,
      explanation: option.explanation || null,
      order_index: index,
    };

    if (option.id) {
      // This is an existing option - update it
      incomingOptionIds.add(option.id);
      optionsToUpdate.push({
        id: option.id,
        ...optionData,
      });
    } else {
      // This is a new option - insert it
      optionsToInsert.push({
        question_id: questionId,
        ...optionData,
      });
    }
  }

  // Update existing options
  for (const option of optionsToUpdate) {
    const { error: updateError } = await adminClient
      .from("question_options")
      .update({
        text: option.text,
        is_correct: option.is_correct,
        explanation: option.explanation,
        order_index: option.order_index,
      })
      .eq("id", option.id);

    if (updateError) {
      log.error("Error updating option:", updateError);
      throw new Error(`Failed to update option: ${updateError.message}`);
    }
  }

  // Insert new options
  if (optionsToInsert.length > 0) {
    const { error: insertError } = await adminClient
      .from("question_options")
      .insert(optionsToInsert);

    if (insertError) {
      log.error("Error inserting new options:", insertError);
      throw new Error(`Failed to insert new options: ${insertError.message}`);
    }
  }

  // Delete options that are no longer needed (but only if not referenced)
  const existingOptionIds = new Set(
    (existingOptions as unknown as Array<{ id: string }>)?.map((opt) => opt.id) || []
  );
  const optionsToDelete = Array.from(existingOptionIds).filter(
    (id) => !incomingOptionIds.has(id) && !referencedOptionIds.has(id)
  );

  if (optionsToDelete.length > 0) {
    const { error: deleteError } = await adminClient
      .from("question_options")
      .delete()
      .in("id", optionsToDelete);

    if (deleteError) {
      log.error("Error deleting unreferenced options:", deleteError);
      throw new Error(`Failed to delete unreferenced options: ${deleteError.message}`);
    }
    log.debug(`Deleted ${optionsToDelete.length} unreferenced options`);
  }

  // Log warning for options that couldn't be deleted due to references
  const referencedButNotIncoming = Array.from(existingOptionIds).filter(
    (id) => !incomingOptionIds.has(id) && referencedOptionIds.has(id)
  );
  if (referencedButNotIncoming.length > 0) {
    log.warn(
      `Warning: ${referencedButNotIncoming.length} options could not be deleted because they are referenced by quiz attempts:`,
      referencedButNotIncoming
    );
  }

  log.debug("Answer options updated successfully");
}
