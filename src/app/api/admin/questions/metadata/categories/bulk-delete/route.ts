import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireContentRole } from "@/shared/utils/api/api-guard";
import { parseBody } from "@/shared/utils/api/parse-body";
import { createClient } from "@/shared/services/server";
import { log } from "@/shared/utils/logging";

const bulkDeleteCategoriesSchema = z.object({
  categoryIds: z.array(z.string()).min(1),
});

/**
 * @swagger
 * /api/admin/questions/metadata/categories/bulk-delete:
 *   post:
 *     summary: Bulk delete categories
 *     description: Delete multiple categories at once. Cannot delete categories with subcategories or questions. Requires content role (admin, creator, or reviewer).
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
 *               - categoryIds
 *             properties:
 *               categoryIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Array of category IDs to delete
 *     responses:
 *       200:
 *         description: Categories deleted successfully
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
 *         description: Bad request - missing categoryIds, has subcategories, or has questions
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

    // Auth check - require admin, creator, or reviewer role
    const auth = requireContentRole(request);
    if (auth instanceof NextResponse) return auth;

    const body = await parseBody(request, bulkDeleteCategoriesSchema);
    if (body instanceof NextResponse) return body;
    const { categoryIds } = body;

    // Check if any categories have child categories
    const { data: childrenCheck } = await supabase
      .from("categories")
      .select("id, parent_id")
      .in("parent_id", categoryIds);

    if (childrenCheck && childrenCheck.length > 0) {
      const categoriesWithChildren = [...new Set(childrenCheck.map((c) => c.parent_id))];
      return NextResponse.json(
        {
          error: `Cannot delete categories with subcategories. ${categoriesWithChildren.length} categories have subcategories. Please delete subcategories first.`,
        },
        { status: 400 }
      );
    }

    // Check if any categories have questions
    const { data: questionsCheck } = await supabase
      .from("questions")
      .select("category_id")
      .in("category_id", categoryIds);

    if (questionsCheck && questionsCheck.length > 0) {
      const categoriesWithQuestions = [...new Set(questionsCheck.map((q) => q.category_id))];
      return NextResponse.json(
        {
          error: `Cannot delete categories with questions. ${categoriesWithQuestions.length} categories have questions. Please move or delete questions first.`,
        },
        { status: 400 }
      );
    }

    // Delete the categories
    const { error, count } = await supabase.from("categories").delete().in("id", categoryIds);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      deletedCount: count || categoryIds.length,
    });
  } catch (error) {
    log.error("Error bulk deleting categories:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
