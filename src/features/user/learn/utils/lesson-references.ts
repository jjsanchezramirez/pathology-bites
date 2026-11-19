// Pure helpers for finding and resolving the things a lesson references:
// library images (:::image[...]) and question-bank checkpoints (:::question[...]).
// No React and no "use client", so both the user lesson API route and the
// client-side renderer can import them.

import type { LessonContent, LessonCheckpoint } from "../types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function splitIds(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** All image UUIDs referenced by :::image[id1,id2] directives, in order of appearance. */
export function extractImageIds(markdown: string): string[] {
  const matches = [...markdown.matchAll(/:{2,3}image\[([^\]]+)\]/g)];
  return matches.flatMap((m) => splitIds(m[1]));
}

/**
 * All question UUIDs referenced by :::question[id] checkpoint directives,
 * de-duplicated, in order of first appearance. Non-UUID labels are ignored so a
 * typo can't turn into an unbounded or malformed query.
 */
export function extractQuestionIds(markdown: string): string[] {
  const matches = [...markdown.matchAll(/:{2,3}question\[([^\]]+)\]/g)];
  const ids = matches.flatMap((m) => splitIds(m[1])).filter((id) => UUID_RE.test(id));
  return [...new Set(ids)];
}

/** Image UUIDs used by legacy JSON-section lessons. */
export function imageIdsFromSections(content: LessonContent | null | undefined): string[] {
  if (!content?.sections) return [];
  return content.sections.flatMap((s) => (s.type === "image" ? s.imageIds : []));
}

// ---- Checkpoint resolution ---------------------------------------------------

export interface CheckpointQuestionRow {
  id: string;
  stem: string;
  teaching_point: string | null;
  status: string;
}

export interface CheckpointOptionRow {
  id: string;
  question_id: string;
  text: string;
  is_correct: boolean;
  explanation: string | null;
  order_index: number | null;
}

export interface CheckpointImageRow {
  question_id: string;
  question_section: string | null;
  order_index: number | null;
  image: { id: string; url: string; alt_text: string | null } | null;
}

/**
 * Build checkpoint objects from raw question-bank rows. Only published
 * questions with at least two options and exactly one correct option are kept,
 * so a draft or malformed question never reaches learners even if a lesson
 * links it. Returns a map keyed by question id.
 */
export function buildCheckpoints(
  questions: CheckpointQuestionRow[],
  options: CheckpointOptionRow[],
  images: CheckpointImageRow[]
): Record<string, LessonCheckpoint> {
  const out: Record<string, LessonCheckpoint> = {};
  for (const q of questions) {
    if (q.status !== "published") continue;
    const opts = options
      .filter((o) => o.question_id === q.id)
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    if (opts.length < 2 || opts.filter((o) => o.is_correct).length !== 1) continue;

    const imgs = images
      .filter((i) => i.question_id === q.id && i.image)
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    const toImage = (i: CheckpointImageRow) => ({
      url: i.image!.url,
      alt: i.image!.alt_text || "Question image",
    });

    out[q.id] = {
      id: q.id,
      stem: q.stem,
      teachingPoint: q.teaching_point,
      stemImages: imgs.filter((i) => i.question_section !== "explanation").map(toImage),
      explanationImages: imgs.filter((i) => i.question_section === "explanation").map(toImage),
      options: opts.map((o) => ({
        id: o.id,
        text: o.text,
        isCorrect: o.is_correct,
        explanation: o.explanation,
      })),
    };
  }
  return out;
}
