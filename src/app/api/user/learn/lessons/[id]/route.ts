import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { requireUser } from "@/shared/utils/api/api-guard";
import { log } from "@/shared/utils/logging";
import type { LessonContent } from "@/features/user/learn/types";
import {
  buildCheckpoints,
  extractImageIds,
  extractQuestionIds,
  imageIdsFromSections,
  type CheckpointImageRow,
  type CheckpointOptionRow,
  type CheckpointQuestionRow,
} from "@/features/user/learn/utils/lesson-references";

/**
 * @swagger
 * /api/user/learn/lessons/{id}:
 *   get:
 *     summary: Get a published lesson by id
 *     description: Returns a single published lesson (within a published subject) along with the authenticated user's progress, the prev/next sibling lessons in the same subject, the library images the lesson references (images), and the published question-bank checkpoints referenced by :::question[id] directives (checkpoints, keyed by question id; draft questions are omitted). As a side effect, upserts the user's lesson progress to record last_accessed_at. Requires the x-user-id header injected by middleware.
 *     tags:
 *       - User - Learn
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the lesson.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lesson object with embedded subject, user progress, and prev_lesson/next_lesson navigation.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       401:
 *         description: Missing x-user-id header.
 *       404:
 *         description: Lesson not found, not published, or its subject is not published.
 *       500:
 *         description: Failed to fetch lesson.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const { id } = await params;

    // Get lesson with its subject
    const { data: lesson, error } = await supabase
      .from("lessons")
      .select(
        `
        *,
        subject:learning_subjects!lessons_subject_id_fkey(id, title, slug, category_id, status)
      `
      )
      .eq("id", id)
      .eq("status", "published")
      .single();

    if (error || !lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    // Check subject is published
    if (lesson.subject?.status !== "published") {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    // Get user progress
    const { data: progress } = await supabase
      .from("user_lesson_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("lesson_id", id)
      .maybeSingle();

    // Update last_accessed_at
    if (progress) {
      await supabase
        .from("user_lesson_progress")
        .update({ last_accessed_at: new Date().toISOString() })
        .eq("id", progress.id);
    } else {
      await supabase.from("user_lesson_progress").insert({ user_id: userId, lesson_id: id });
    }

    // Get prev/next lessons in same subject
    const { data: siblingLessons } = await supabase
      .from("lessons")
      .select("id, slug, title, sort_order")
      .eq("subject_id", lesson.subject_id)
      .eq("status", "published")
      .order("sort_order");

    const siblings = siblingLessons || [];
    const currentIdx = siblings.findIndex((l) => l.id === id);
    const prevLesson =
      currentIdx > 0
        ? { slug: siblings[currentIdx - 1].slug, title: siblings[currentIdx - 1].title }
        : null;
    const nextLesson =
      currentIdx < siblings.length - 1
        ? { slug: siblings[currentIdx + 1].slug, title: siblings[currentIdx + 1].title }
        : null;

    const markdown: string = lesson.content_markdown || "";
    const imageIds = markdown
      ? extractImageIds(markdown)
      : imageIdsFromSections(lesson.content as unknown as LessonContent);
    const [images, checkpoints] = await Promise.all([
      resolveImages(supabase, imageIds),
      resolveCheckpoints(supabase, extractQuestionIds(markdown)),
    ]);

    return NextResponse.json({
      ...lesson,
      progress: progress || null,
      prev_lesson: prevLesson,
      next_lesson: nextLesson,
      images,
      checkpoints,
    });
  } catch (error) {
    log.error("[Learn API] Failed to fetch lesson:", error);
    return NextResponse.json({ error: "Failed to fetch lesson" }, { status: 500 });
  }
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Library images referenced by the lesson (images are publicly readable). */
async function resolveImages(supabase: ServerClient, ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const { data, error } = await supabase
    .from("images")
    .select("id, url, alt_text")
    .in("id", unique);
  if (error) {
    log.error("[Learn API] Failed to resolve lesson images:", error);
    return [];
  }
  return data || [];
}

/** Published question-bank checkpoints referenced by :::question[id]. */
async function resolveCheckpoints(supabase: ServerClient, ids: string[]) {
  if (ids.length === 0) return {};
  try {
    const [questionsRes, optionsRes, imagesRes] = await Promise.all([
      supabase
        .from("questions")
        .select("id, stem, teaching_point, status")
        .in("id", ids)
        .eq("status", "published"),
      supabase
        .from("question_options")
        .select("id, question_id, text, is_correct, explanation, order_index")
        .in("question_id", ids),
      supabase
        .from("question_images")
        .select("question_id, question_section, order_index, image:images(id, url, alt_text)")
        .in("question_id", ids),
    ]);
    if (questionsRes.error) throw questionsRes.error;
    return buildCheckpoints(
      (questionsRes.data || []) as CheckpointQuestionRow[],
      (optionsRes.data || []) as CheckpointOptionRow[],
      (imagesRes.data || []) as unknown as CheckpointImageRow[]
    );
  } catch (err) {
    log.error("[Learn API] Failed to resolve lesson checkpoints:", err);
    return {};
  }
}
