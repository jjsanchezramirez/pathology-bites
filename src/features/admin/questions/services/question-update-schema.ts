// src/features/admin/questions/services/question-update-schema.ts
//
// Zod schema for the PATCH /api/admin/questions/[id] body, parsed via
// `parseBody`. Derived from the route's previous inline cast — kept
// deliberately permissive where the old cast was unchecked (nullable text
// fields, null entries in tagIds, free-form updateType).

import { z } from "zod";

export const answerOptionInputSchema = z.object({
  id: z.string().optional(),
  text: z.string(),
  is_correct: z.boolean(),
  explanation: z.string().nullable().optional(),
});

export const questionImageInputSchema = z.object({
  image_id: z.string(),
  question_section: z.string(),
});

export const questionUpdateBodySchema = z.object({
  questionData: z
    .object({
      title: z.string().optional(),
      stem: z.string().optional(),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
      teaching_point: z.string().optional(),
      question_references: z.string().nullable().optional(),
      question_set_id: z.string().nullable().optional(),
      lesson: z.string().nullable().optional(),
      topic: z.string().nullable().optional(),
      reviewer_id: z.string().optional(),
      status: z
        .enum(["draft", "pending_review", "flagged", "archived", "rejected", "published"])
        .optional(),
      // DB column is text; clients send Anki's numeric card id (coerced later).
      anki_card_id: z.number().nullable().optional(),
      anki_deck_name: z.string().nullable().optional(),
    })
    .optional(),
  changeSummary: z.string().optional(),
  answerOptions: z.array(answerOptionInputSchema).optional(),
  questionImages: z.array(questionImageInputSchema).optional(),
  // Clients occasionally send null/empty entries; they are filtered downstream.
  tagIds: z.array(z.string().nullable()).optional(),
  categoryId: z.string().nullable().optional(),
  isPatchEdit: z.boolean().optional(),
  patchEditReason: z.string().optional(),
  updateType: z.string().optional(),
  reviewerId: z.string().optional(),
});

export type QuestionUpdateBody = z.infer<typeof questionUpdateBodySchema>;
export type AnswerOptionInput = z.infer<typeof answerOptionInputSchema>;
export type QuestionImageInput = z.infer<typeof questionImageInputSchema>;
