import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { bulkDeleteFromR2, extractR2KeyFromUrl } from "@/shared/services/r2-storage";
import { getUserIdFromHeaders } from "@/shared/utils/auth/auth-helpers";

/**
 * @swagger
 * /api/admin/images/bulk-delete:
 *   delete:
 *     summary: Delete multiple images in bulk
 *     description: Delete multiple images from both R2 storage and the database in a single operation. External images are only removed from the database. Requires admin role.
 *     tags:
 *       - Admin - Images
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - imageIds
 *             properties:
 *               imageIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Array of image IDs to delete
 *                 minItems: 1
 *                 example: ["123e4567-e89b-12d3-a456-426614174000", "123e4567-e89b-12d3-a456-426614174001"]
 *     responses:
 *       200:
 *         description: Images deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 results:
 *                   type: object
 *                   properties:
 *                     deleted:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Array of successfully deleted image IDs
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Array of error messages for failed deletions
 *                     storageDeleted:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Array of R2 keys successfully deleted from storage
 *                     storageErrors:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Array of R2 deletion error messages
 *                 message:
 *                   type: string
 *                   example: Successfully deleted 2 images
 *       400:
 *         description: Bad request - missing or invalid imageIds array
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Image IDs array is required
 *       401:
 *         description: Unauthorized - missing authentication
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: You must be logged in to delete images
 *       403:
 *         description: Forbidden - admin access required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Only administrators can delete images
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Failed to delete images
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify user is authenticated admin
    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json(
        { error: "You must be logged in to delete images" },
        { status: 401 }
      );
    }

    const { data: userData, error: roleError } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (roleError || !userData || userData.role !== "admin") {
      return NextResponse.json({ error: "Only administrators can delete images" }, { status: 403 });
    }

    // Parse request body
    const { imageIds } = await request.json();

    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
      return NextResponse.json({ error: "Image IDs array is required" }, { status: 400 });
    }

    // Get image details for all images
    const { data: imageData, error: fetchError } = await supabase
      .from("images")
      .select("id, url, storage_path, category")
      .in("id", imageIds);

    if (fetchError) {
      return NextResponse.json({ error: "Failed to fetch image details" }, { status: 500 });
    }

    const results = {
      deleted: [] as string[],
      errors: [] as string[],
      storageDeleted: [] as string[],
      storageErrors: [] as string[],
    };

    // Collect R2 keys for bulk deletion
    const r2Keys: string[] = [];
    const imageMap = new Map<
      string,
      { id: string; url: string; storage_path: string; category: string }
    >();

    for (const image of (imageData || []) as Array<{
      id: string;
      url: string;
      storage_path: string;
      category: string;
    }>) {
      imageMap.set(image.id, image);

      // Only collect keys for non-external images
      if (image.category !== "external") {
        const r2Key = extractR2KeyFromUrl(image.url);
        if (r2Key) {
          r2Keys.push(r2Key);
        } else if (image.storage_path) {
          r2Keys.push(image.storage_path);
        }
      }
    }

    // Bulk delete from R2 storage
    if (r2Keys.length > 0) {
      try {
        const r2Result = await bulkDeleteFromR2(r2Keys);
        results.storageDeleted = r2Result.deleted;
        results.storageErrors = r2Result.errors;
      } catch (storageError) {
        console.warn("R2 bulk deletion error:", storageError);
        results.storageErrors.push(`Bulk R2 deletion failed: ${storageError}`);
      }
    }

    // Delete database records
    const { error: dbError } = await supabase.from("images").delete().in("id", imageIds);

    if (dbError) {
      return NextResponse.json({ error: "Failed to delete images from database" }, { status: 500 });
    }

    results.deleted = imageIds;

    return NextResponse.json({
      success: true,
      results,
      message: `Successfully deleted ${results.deleted.length} images`,
    });
  } catch (error) {
    console.error("Bulk image deletion error:", error);
    return NextResponse.json({ error: "Failed to delete images" }, { status: 500 });
  }
}
