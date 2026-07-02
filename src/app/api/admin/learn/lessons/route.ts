import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Json } from "@/shared/types/supabase";
import { createClient } from "@/shared/services/server";
import { requireAdmin } from "@/shared/utils/api/api-guard";
import { parseBody } from "@/shared/utils/api/parse-body";
import { log } from "@/shared/utils/logging";

const createLessonSchema = z.object({
  subject_id: z.string().min(1),
  title: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  description: z.string().nullish(),
  content: z.unknown().optional(),
  content_markdown: z.string().nullish(),
  quiz: z.unknown().optional(),
  anki_deck_ref: z.string().nullish(),
  cover_image_url: z.string().nullish(),
  sort_order: z.number().int().nullish(),
  estimated_minutes: z.number().int().nullish(),
  status: z.string().optional(),
});

/**
 * @swagger
 * /api/admin/learn/lessons:
 *   get:
 *     summary: List lessons
 *     description: List lessons ordered by sort_order, each joined with its parent subject (id, title, slug). Optionally filter by subject. Admin-only (x-user-id from middleware must resolve to a user with role "admin").
 *     tags:
 *       - Admin - Learn
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: subject_id
 *         description: Filter lessons to a single subject
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Array of lessons (each with embedded subject)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       403:
 *         description: Unauthorized (missing user or non-admin role)
 *       500:
 *         description: Failed to fetch lessons
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const subjectId = request.nextUrl.searchParams.get("subject_id");

    let query = supabase
      .from("lessons")
      .select(
        `
        *,
        subject:learning_subjects!lessons_subject_id_fkey(id, title, slug)
      `
      )
      .order("sort_order");

    if (subjectId) {
      query = query.eq("subject_id", subjectId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    log.error("[Admin Learn API] Failed to fetch lessons:", error);
    return NextResponse.json({ error: "Failed to fetch lessons" }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/admin/learn/lessons:
 *   post:
 *     summary: Create lesson
 *     description: Create a new lesson under a subject. Requires subject_id, title, and slug (slug is lowercased). Admin-only (x-user-id from middleware must resolve to role "admin"). created_by is set to the caller.
 *     tags:
 *       - Admin - Learn
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject_id
 *               - title
 *               - slug
 *             properties:
 *               subject_id:
 *                 type: string
 *               title:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               content:
 *                 type: object
 *               content_markdown:
 *                 type: string
 *               quiz:
 *                 type: object
 *               anki_deck_ref:
 *                 type: string
 *               cover_image_url:
 *                 type: string
 *               sort_order:
 *                 type: integer
 *               estimated_minutes:
 *                 type: integer
 *               status:
 *                 type: string
 *                 default: draft
 *     responses:
 *       201:
 *         description: Lesson created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Missing required field (subject_id, title, or slug)
 *       403:
 *         description: Unauthorized (missing user or non-admin role)
 *       409:
 *         description: A lesson with this slug already exists in this subject
 *       500:
 *         description: Failed to create lesson
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = requireAdmin(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const body = await parseBody(request, createLessonSchema);
    if (body instanceof NextResponse) return body;
    const {
      subject_id,
      title,
      slug,
      description,
      content,
      content_markdown,
      quiz,
      anki_deck_ref,
      cover_image_url,
      sort_order,
      estimated_minutes,
      status,
    } = body;

    const { data, error } = await supabase
      .from("lessons")
      .insert({
        subject_id,
        title: title.trim(),
        slug: slug.trim().toLowerCase(),
        description: description?.trim() || null,
        content: (content as Json) || { version: 1, sections: [] },
        content_markdown: content_markdown || null,
        quiz: (quiz as Json) || null,
        anki_deck_ref: anki_deck_ref || null,
        cover_image_url: cover_image_url || null,
        sort_order: sort_order ?? 0,
        estimated_minutes: estimated_minutes || null,
        status: status || "draft",
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A lesson with this slug already exists in this subject" },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    log.error("[Admin Learn API] Failed to create lesson:", error);
    return NextResponse.json({ error: "Failed to create lesson" }, { status: 500 });
  }
}
