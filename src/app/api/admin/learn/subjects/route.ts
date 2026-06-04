import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { getUserIdFromHeaders } from "@/shared/utils/auth/auth-helpers";

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data, error } = await supabase.from("users").select("role").eq("id", userId).single();
  return !error && data?.role === "admin";
}

/**
 * @swagger
 * /api/admin/learn/subjects:
 *   get:
 *     summary: List learning subjects
 *     description: List learning subjects ordered by sort_order, each joined with its category (id, name, color, short_form) and a computed lesson_count. Admin-only (x-user-id from middleware must resolve to role "admin").
 *     tags:
 *       - Admin - Learn
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Array of subjects (each with embedded category and lesson_count)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       403:
 *         description: Unauthorized (missing user or non-admin role)
 *       500:
 *         description: Failed to fetch subjects
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const userId = getUserIdFromHeaders(request);
    if (!userId || !(await verifyAdmin(supabase, userId))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("learning_subjects")
      .select(
        `
        *,
        category:categories!learning_subjects_category_id_fkey(id, name, color, short_form),
        lessons(id)
      `
      )
      .order("sort_order");

    if (error) throw error;

    const result = (data || []).map((subject) => ({
      ...subject,
      lesson_count: (subject.lessons || []).length,
      lessons: undefined,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Admin Learn API] Failed to fetch subjects:", error);
    return NextResponse.json({ error: "Failed to fetch subjects" }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/admin/learn/subjects:
 *   post:
 *     summary: Create learning subject
 *     description: Create a new learning subject. Requires title, slug (lowercased), and category_id. Admin-only (x-user-id from middleware must resolve to role "admin"). created_by is set to the caller.
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
 *               - title
 *               - slug
 *               - category_id
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               slug:
 *                 type: string
 *               category_id:
 *                 type: string
 *               cover_image_url:
 *                 type: string
 *               sort_order:
 *                 type: integer
 *               status:
 *                 type: string
 *                 default: draft
 *     responses:
 *       201:
 *         description: Subject created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Missing required field (title, slug, or category_id)
 *       403:
 *         description: Unauthorized (missing user or non-admin role)
 *       409:
 *         description: A subject with this slug already exists
 *       500:
 *         description: Failed to create subject
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const userId = getUserIdFromHeaders(request);
    if (!userId || !(await verifyAdmin(supabase, userId))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, slug, category_id, cover_image_url, sort_order, status } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!slug?.trim()) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }
    if (!category_id) {
      return NextResponse.json({ error: "Category is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("learning_subjects")
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        slug: slug.trim().toLowerCase(),
        category_id,
        cover_image_url: cover_image_url || null,
        sort_order: sort_order ?? 0,
        status: status || "draft",
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A subject with this slug already exists" },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("[Admin Learn API] Failed to create subject:", error);
    return NextResponse.json({ error: "Failed to create subject" }, { status: 500 });
  }
}
