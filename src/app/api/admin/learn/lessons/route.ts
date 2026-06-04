import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { getUserIdFromHeaders } from "@/shared/utils/auth/auth-helpers";

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data, error } = await supabase.from("users").select("role").eq("id", userId).single();
  return !error && data?.role === "admin";
}

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
    const userId = getUserIdFromHeaders(request);
    if (!userId || !(await verifyAdmin(supabase, userId))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

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
    console.error("[Admin Learn API] Failed to fetch lessons:", error);
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
    const userId = getUserIdFromHeaders(request);
    if (!userId || !(await verifyAdmin(supabase, userId))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
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

    if (!subject_id) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }
    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!slug?.trim()) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("lessons")
      .insert({
        subject_id,
        title: title.trim(),
        slug: slug.trim().toLowerCase(),
        description: description?.trim() || null,
        content: content || { version: 1, sections: [] },
        content_markdown: content_markdown || null,
        quiz: quiz || null,
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
    console.error("[Admin Learn API] Failed to create lesson:", error);
    return NextResponse.json({ error: "Failed to create lesson" }, { status: 500 });
  }
}
