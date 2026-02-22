import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";

/**
 * @swagger
 * /api/admin/questions/metadata/sets/bulk-delete:
 *   post:
 *     summary: Bulk delete question sets
 *     description: Delete multiple question sets at once. Cannot delete sets with questions. Requires content role (admin, creator, or reviewer).
 *     tags:
 *       - Admin - Question Metadata
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - setIds
 *             properties:
 *               setIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Array of set IDs to delete
 *     responses:
 *       200:
 *         description: Sets deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 deletedCount:
 *                   type: integer
 *       400:
 *         description: Bad request - missing setIds or sets have questions
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - content role required
 *       500:
 *         description: Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (userError || !["admin", "creator", "reviewer"].includes(userData?.role)) {
      return NextResponse.json(
        { error: "Forbidden - Admin, Creator, or Reviewer access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { setIds } = body;

    if (!setIds || !Array.isArray(setIds) || setIds.length === 0) {
      return NextResponse.json({ error: "Set IDs array is required" }, { status: 400 });
    }

    // Check if any sets have questions
    const { data: questionsCheck } = await supabase
      .from("questions")
      .select("question_set_id")
      .in("question_set_id", setIds);

    if (questionsCheck && questionsCheck.length > 0) {
      const setsWithQuestions = [...new Set(questionsCheck.map((q) => q.question_set_id))];
      return NextResponse.json(
        {
          error: `Cannot delete question sets with questions. ${setsWithQuestions.length} sets have questions. Please move or delete questions first.`,
        },
        { status: 400 }
      );
    }

    // Delete the question sets
    const { error, count } = await supabase.from("question_sets").delete().in("id", setIds);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      deletedCount: count || setIds.length,
    });
  } catch (error) {
    console.error("Error bulk deleting question sets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
