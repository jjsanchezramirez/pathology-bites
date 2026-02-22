import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";

/**
 * @swagger
 * /api/admin/library/images:
 *   get:
 *     summary: Get paginated list of images from library
 *     description: Retrieve a paginated list of images with optional filtering by search term and category. Requires admin role.
 *     tags:
 *       - Admin - Library
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term to filter by description or alt text
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by image category
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 40
 *           maximum: 100
 *         description: Maximum number of images to return (capped at 100)
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of images to skip for pagination
 *     responses:
 *       200:
 *         description: Successfully retrieved images
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 images:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                         description: Unique identifier for the image
 *                       url:
 *                         type: string
 *                         description: URL of the image
 *                       description:
 *                         type: string
 *                         description: Description of the image
 *                       alt_text:
 *                         type: string
 *                         description: Alternative text for the image
 *                       category:
 *                         type: string
 *                         description: Category of the image
 *                       file_type:
 *                         type: string
 *                         description: File type of the image
 *                       width:
 *                         type: integer
 *                         description: Width of the image in pixels
 *                       height:
 *                         type: integer
 *                         description: Height of the image in pixels
 *                       magnification:
 *                         type: string
 *                         description: Magnification level if applicable
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                         description: Timestamp when the image was created
 *                 hasMore:
 *                   type: boolean
 *                   description: Indicates if there are more images available
 *       401:
 *         description: Unauthorized - missing authentication
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Internal server error
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const category = searchParams.get("category");
    const limit = Math.min(parseInt(searchParams.get("limit") || "40"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query
    let query = supabase
      .from("images")
      .select(
        "id, url, description, alt_text, category, file_type, width, height, magnification, created_at"
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (search) {
      query = query.or(`description.ilike.%${search}%,alt_text.ilike.%${search}%`);
    }

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching images:", error);
      return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
    }

    const images = data || [];
    return NextResponse.json({ images, hasMore: images.length === limit });
  } catch (error) {
    console.error("Error in GET /api/admin/library/images:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
