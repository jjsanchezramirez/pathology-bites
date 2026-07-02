import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { requireAdmin } from "@/shared/utils/api/api-guard";
import { log } from "@/shared/utils/logging";

/**
 * @swagger
 * /api/admin/interactive-sequences/delete:
 *   post:
 *     summary: Delete an interactive sequence
 *     description: >-
 *       Delete an interactive sequence by ID. Requires an authenticated user
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
 *               - id
 *             properties:
 *               id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the sequence to delete
 *     responses:
 *       200:
 *         description: Sequence deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: Sequence ID is required
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator privileges required
 *       500:
 *         description: Deletion failed
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const auth = requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Sequence ID is required." }, { status: 400 });
    }

    const { error } = await supabase.from("interactive_sequences").delete().eq("id", id);

    if (error) {
      log.error("Failed to delete interactive sequence:", error);
      return NextResponse.json(
        { error: `Failed to delete sequence: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Interactive sequence deletion error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Deletion failed: ${errorMessage}` }, { status: 500 });
  }
}
