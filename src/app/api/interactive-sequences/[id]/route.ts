import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { log } from "@/shared/utils/logging";

/**
 * @swagger
 * /api/interactive-sequences/{id}:
 *   get:
 *     summary: Get a published interactive sequence by ID
 *     description: >-
 *       Fetch a single interactive sequence by ID. Only sequences with status
 *       `published` are returned; non-published or non-existent IDs yield 404.
 *       This route is not role-gated at the handler level.
 *     tags:
 *       - Admin - Interactive Sequences
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Interactive sequence ID
 *     responses:
 *       200:
 *         description: Sequence retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sequence:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                       nullable: true
 *                     sequence_data:
 *                       type: object
 *                     status:
 *                       type: string
 *       404:
 *         description: Sequence not found (or not published)
 *       500:
 *         description: Fetch failed
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("interactive_sequences")
      .select("id, title, description, sequence_data, status")
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle();

    if (error) {
      log.error("Failed to fetch interactive sequence:", error);
      return NextResponse.json(
        { error: `Failed to fetch sequence: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
    }

    return NextResponse.json({ sequence: data });
  } catch (error) {
    log.error("Interactive sequence fetch error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Fetch failed: ${errorMessage}` }, { status: 500 });
  }
}
