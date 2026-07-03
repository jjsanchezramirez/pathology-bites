// src/features/admin/questions/services/sync-question-relations.ts
//
// Image, tag, and category sync for the admin question PATCH route. Images
// and tags use delete-all-then-insert semantics; the category is a targeted
// column update. Throws Error on DB failure; the route converts that to 500.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/types/supabase";
import { log } from "@/shared/utils/logging";
import type { QuestionImageInput } from "./question-update-schema";

export async function syncQuestionImages(
  adminClient: SupabaseClient<Database>,
  questionId: string,
  questionImages: QuestionImageInput[]
): Promise<void> {
  // Delete existing question images
  await adminClient.from("question_images").delete().eq("question_id", questionId);

  // Insert new question images
  if (questionImages.length > 0) {
    const { error: imagesError } = await adminClient.from("question_images").insert(
      questionImages.map((img, index) => ({
        question_id: questionId,
        image_id: img.image_id,
        question_section: img.question_section,
        order_index: index,
      }))
    );

    if (imagesError) {
      throw new Error(`Failed to update question images: ${imagesError.message}`);
    }
  }
}

export async function syncQuestionTags(
  adminClient: SupabaseClient<Database>,
  questionId: string,
  tagIds: Array<string | null | undefined>
): Promise<void> {
  log.debug("Updating tags...");

  // Delete existing tags
  const { error: deleteTagsError } = await adminClient
    .from("question_tags")
    .delete()
    .eq("question_id", questionId);

  if (deleteTagsError) {
    log.error("Error deleting existing tags:", deleteTagsError);
    throw new Error(`Failed to delete existing tags: ${deleteTagsError.message}`);
  }

  // Insert new tags
  if (tagIds && tagIds.length > 0) {
    // Filter out any null/undefined tag IDs
    const validTagIds = tagIds.filter(
      (tagId): tagId is string =>
        tagId !== null && tagId !== undefined && typeof tagId === "string" && tagId.trim() !== ""
    );

    log.debug("Original tagIds:", tagIds);
    log.debug("Filtered validTagIds:", validTagIds);

    if (validTagIds.length > 0) {
      const { error: tagsError } = await adminClient.from("question_tags").insert(
        validTagIds.map((tagId) => ({
          question_id: questionId,
          tag_id: tagId,
        }))
      );

      if (tagsError) {
        log.error("Tags update error:", tagsError);
        throw new Error(
          `Failed to update question tags: ${tagsError.message || JSON.stringify(tagsError)}`
        );
      }
    }
  }
}

export async function updateQuestionCategory(
  adminClient: SupabaseClient<Database>,
  questionId: string,
  categoryId: string | null
): Promise<void> {
  const { error: categoryError } = await adminClient
    .from("questions")
    .update({ category_id: categoryId || null })
    .eq("id", questionId);

  if (categoryError) {
    throw new Error(`Failed to update question category: ${categoryError.message}`);
  }
}
