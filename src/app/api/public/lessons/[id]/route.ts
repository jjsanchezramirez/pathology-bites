import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { isLessonId } from "@/shared/lesson/embed";
import { log } from "@/shared/utils/logging";

/**
 * @swagger
 * /api/public/lessons/{id}:
 *   get:
 *     summary: Get a published Lesson Studio lesson
 *     description: >-
 *       Public, unauthenticated. Returns one published lesson (interactive
 *       sequence) so it can be embedded anywhere: Learning Modules, question
 *       explanations, other pages, or other sites via /embed/lessons/{id}.
 *       Drafts and unknown ids return 404 (RLS lets anon read published rows only).
 *     tags:
 *       - Public
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: "{ lesson: { id, title, description, sequence_data } }"
 *       404:
 *         description: Not found or not published
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isLessonId(id)) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }
  try {
    // Signed out this runs as anon, which RLS limits to published rows
    // (docs/lesson-studio/migrations/20261126120000_interactive_sequences_rls.sql).
    // The status filter keeps admins' drafts out of a public, CDN-cached answer.
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("interactive_sequences")
      .select("id, title, description, sequence_data")
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle();
    if (error) {
      log.error("[public/lessons] fetch failed:", error);
      return NextResponse.json({ error: "Failed to load lesson" }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    return NextResponse.json(
      { lesson: data },
      // Republishing shows up within a few minutes without a deploy.
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } }
    );
  } catch (error) {
    log.error("[public/lessons] unexpected error:", error);
    return NextResponse.json({ error: "Failed to load lesson" }, { status: 500 });
  }
}
