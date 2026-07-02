import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { requireAdmin } from "@/shared/utils/api/api-guard";
import { log } from "@/shared/utils/logging";

/**
 * @swagger
 * /api/admin/interactive-sequences/list:
 *   get:
 *     summary: List interactive sequences
 *     description: >-
 *       List interactive sequences ordered by creation date (newest first), with
 *       optional filtering. Requires an authenticated user (via the `x-user-id`
 *       header injected by middleware) whose `role` is `admin`.
 *     tags:
 *       - Admin - Interactive Sequences
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by category ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, published, archived]
 *         description: Filter by status (other values ignored)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Full-text search against the sequence search_vector
 *     responses:
 *       200:
 *         description: Sequences retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 sequences:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator privileges required
 *       500:
 *         description: Fetch failed
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const auth = requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const category_id = searchParams.get("category_id");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    // Build query
    let query = supabase
      .from("interactive_sequences")
      .select("*")
      .order("created_at", { ascending: false });

    if (category_id) {
      query = query.eq("category_id", category_id);
    }

    if (status && (status === "draft" || status === "published" || status === "archived")) {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.textSearch("search_vector", search);
    }

    const { data, error } = await query;

    if (error) {
      log.error("Failed to fetch interactive sequences:", error);
      return NextResponse.json(
        { error: `Failed to fetch sequences: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, sequences: data });
  } catch (error) {
    log.error("Interactive sequences list error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Fetch failed: ${errorMessage}` }, { status: 500 });
  }
}
