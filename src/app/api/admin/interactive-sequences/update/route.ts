import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { requireAdmin } from "@/shared/utils/api/api-guard";
import { log } from "@/shared/utils/logging";

/**
 * @swagger
 * /api/admin/interactive-sequences/update:
 *   post:
 *     summary: Update an interactive sequence
 *     description: >-
 *       Partially update an interactive sequence; only provided fields are changed.
 *       Requires an authenticated user (via the `x-user-id` header injected by
 *       middleware) whose `role` is `admin`.
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
 *               - id
 *             properties:
 *               id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the sequence to update
 *               title:
 *                 type: string
 *                 description: New title (must be non-empty if provided)
 *               description:
 *                 type: string
 *                 nullable: true
 *               sequence_data:
 *                 type: object
 *                 description: ExplainerSequence object; must include `version` and `segments` if provided
 *               category_id:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               status:
 *                 type: string
 *                 enum: [draft, published, archived]
 *     responses:
 *       200:
 *         description: Sequence updated
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
 *         description: Missing ID, empty title, invalid sequence_data, or invalid status
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator privileges required
 *       500:
 *         description: Update failed
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const auth = requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { id, title, description, sequence_data, category_id, status } = body;

    if (!id) {
      return NextResponse.json({ error: "Sequence ID is required." }, { status: 400 });
    }

    // Build updates object with only provided fields
    const updates: Record<string, unknown> = {};

    if (title !== undefined) {
      if (!title.trim()) {
        return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 });
      }
      updates.title = title.trim();
    }

    if (description !== undefined) {
      updates.description = description?.trim() || null;
    }

    if (sequence_data !== undefined) {
      if (typeof sequence_data !== "object" || !sequence_data.version || !sequence_data.segments) {
        return NextResponse.json(
          { error: "sequence_data must be a valid ExplainerSequence object." },
          { status: 400 }
        );
      }
      updates.sequence_data = sequence_data;
    }

    if (category_id !== undefined) {
      updates.category_id = category_id || null;
    }

    if (status !== undefined) {
      if (!["draft", "published", "archived"].includes(status)) {
        return NextResponse.json({ error: "Invalid status value." }, { status: 400 });
      }
      updates.status = status;
    }

    const { data, error } = await supabase
      .from("interactive_sequences")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      log.error("Failed to update interactive sequence:", error);
      return NextResponse.json(
        { error: `Failed to update sequence: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, sequence: data });
  } catch (error) {
    log.error("Interactive sequence update error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Update failed: ${errorMessage}` }, { status: 500 });
  }
}
