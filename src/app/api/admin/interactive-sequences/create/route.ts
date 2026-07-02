import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Json } from "@/shared/types/supabase";
import { createClient } from "@/shared/services/server";
import { requireAdmin } from "@/shared/utils/api/api-guard";
import { parseBody } from "@/shared/utils/api/parse-body";
import { log } from "@/shared/utils/logging";

const createSequenceSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().nullish(),
  // ExplainerSequence blob — only version/segments are validated, the rest passes through.
  sequence_data: z
    .object({
      version: z.unknown().refine((v) => !!v, { message: "version is required" }),
      segments: z.array(z.unknown()),
    })
    .passthrough(),
  category_id: z.string().nullish(),
  status: z.string().optional(),
});

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

    const auth = requireAdmin(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const body = await parseBody(request, createSequenceSchema);
    if (body instanceof NextResponse) return body;
    const { title, description, sequence_data, category_id, status } = body;

    const { data, error } = await supabase
      .from("interactive_sequences")
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        sequence_data: sequence_data as Json,
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
