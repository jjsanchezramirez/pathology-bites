import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/shared/services/server";
import { requireAdmin } from "@/shared/utils/api/api-guard";
import { parseBody } from "@/shared/utils/api/parse-body";
import { log } from "@/shared/utils/logging";

const updateLessonSchema = z.object({
  title: z.string().optional(),
  slug: z.string().optional(),
  description: z.string().nullish(),
  content: z.unknown().optional(),
  content_markdown: z.string().nullish(),
  quiz: z.unknown().optional(),
  anki_deck_ref: z.string().nullish(),
  cover_image_url: z.string().nullish(),
  sort_order: z.number().int().optional(),
  estimated_minutes: z.number().int().nullish(),
  status: z.string().optional(),
  subject_id: z.string().optional(),
});

/**
 * @swagger
 * /api/admin/learn/lessons/{id}:
 *   get:
 *     summary: Get lesson by ID
 *     description: Fetch a single lesson with its embedded subject (id, title, slug). Admin-only (x-user-id from middleware must resolve to role "admin").
 *     tags:
 *       - Admin - Learn
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Lesson ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The lesson (with embedded subject)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       403:
 *         description: Unauthorized (missing user or non-admin role)
 *       500:
 *         description: Failed to fetch lesson (includes not-found)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const { data, error } = await supabase
      .from("lessons")
      .select(
        `
        *,
        subject:learning_subjects!lessons_subject_id_fkey(id, title, slug)
      `
      )
      .eq("id", id)
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    log.error("[Admin Learn API] Failed to fetch lesson:", error);
    return NextResponse.json({ error: "Failed to fetch lesson" }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/admin/learn/lessons/{id}:
 *   put:
 *     summary: Update lesson
 *     description: Partially update a lesson. Only provided fields are applied (title/slug are trimmed, slug lowercased). Admin-only (x-user-id from middleware must resolve to role "admin").
 *     tags:
 *       - Admin - Learn
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Lesson ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
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
 *               subject_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated lesson
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       403:
 *         description: Unauthorized (missing user or non-admin role)
 *       409:
 *         description: A lesson with this slug already exists in this subject
 *       500:
 *         description: Failed to update lesson
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await parseBody(request, updateLessonSchema);
    if (body instanceof NextResponse) return body;
    const {
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
      subject_id,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title.trim();
    if (slug !== undefined) updateData.slug = slug.trim().toLowerCase();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (content !== undefined) updateData.content = content;
    if (content_markdown !== undefined) updateData.content_markdown = content_markdown || null;
    if (quiz !== undefined) updateData.quiz = quiz;
    if (anki_deck_ref !== undefined) updateData.anki_deck_ref = anki_deck_ref || null;
    if (cover_image_url !== undefined) updateData.cover_image_url = cover_image_url || null;
    if (sort_order !== undefined) updateData.sort_order = sort_order;
    if (estimated_minutes !== undefined) updateData.estimated_minutes = estimated_minutes || null;
    if (status !== undefined) updateData.status = status;
    if (subject_id !== undefined) updateData.subject_id = subject_id;

    const { data, error } = await supabase
      .from("lessons")
      .update(updateData)
      .eq("id", id)
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

    return NextResponse.json(data);
  } catch (error) {
    log.error("[Admin Learn API] Failed to update lesson:", error);
    return NextResponse.json({ error: "Failed to update lesson" }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/admin/learn/lessons/{id}:
 *   delete:
 *     summary: Delete lesson
 *     description: Delete a lesson by ID. Admin-only (x-user-id from middleware must resolve to role "admin").
 *     tags:
 *       - Admin - Learn
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Lesson ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deletion succeeded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       403:
 *         description: Unauthorized (missing user or non-admin role)
 *       500:
 *         description: Failed to delete lesson
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const auth = requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const { error } = await supabase.from("lessons").delete().eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("[Admin Learn API] Failed to delete lesson:", error);
    return NextResponse.json({ error: "Failed to delete lesson" }, { status: 500 });
  }
}
