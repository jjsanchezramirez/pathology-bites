import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { getUserIdFromHeaders } from "@/shared/utils/auth/auth-helpers";
import { log } from "@/shared/utils/logging";

/**
 * @swagger
 * /api/admin/interactive-sequences/create:
 *   post:
 *     summary: Create an interactive sequence
 *     description: >-
 *       Create a new interactive sequence record. Requires an authenticated user
 *       (via the `x-user-id` header injected by middleware) whose `role` is `admin`.
 *     tags:
 *       - Admin - Interactive Sequences
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
 *               - sequence_data
 *             properties:
 *               title:
 *                 type: string
 *                 description: Sequence title (required, non-empty)
 *               description:
 *                 type: string
 *                 nullable: true
 *               sequence_data:
 *                 type: object
 *                 description: ExplainerSequence object; must include `version` and a `segments` array
 *                 properties:
 *                   version:
 *                     type: string
 *                   segments:
 *                     type: array
 *                     items:
 *                       type: object
 *               category_id:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               status:
 *                 type: string
 *                 enum: [draft, published, archived]
 *                 default: draft
 *     responses:
 *       200:
 *         description: Sequence created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 sequence:
 *                   type: object
 *       400:
 *         description: Missing/invalid title or sequence_data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator privileges required
 *       500:
 *         description: Creation failed
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { data: userData, error: roleError } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (roleError || !userData || userData.role !== "admin") {
      return NextResponse.json({ error: "Administrator privileges required." }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, sequence_data, category_id, status } = body;

    // Validation
    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }

    if (!sequence_data || typeof sequence_data !== "object") {
      return NextResponse.json({ error: "Valid sequence_data is required." }, { status: 400 });
    }

    // Validate sequence_data has required fields
    if (
      !sequence_data.version ||
      !sequence_data.segments ||
      !Array.isArray(sequence_data.segments)
    ) {
      return NextResponse.json(
        { error: "sequence_data must be a valid ExplainerSequence object." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("interactive_sequences")
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        sequence_data,
        category_id: category_id || null,
        status: status || "draft",
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      log.error("Failed to create interactive sequence:", error);
      return NextResponse.json(
        { error: `Failed to create sequence: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, sequence: data });
  } catch (error) {
    log.error("Interactive sequence creation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Creation failed: ${errorMessage}` }, { status: 500 });
  }
}
