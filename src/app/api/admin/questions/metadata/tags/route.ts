// src/app/api/admin/questions/metadata/tags/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";

/**
 * @swagger
 * /api/admin/questions/metadata/tags:
 *   get:
 *     summary: Get paginated tags
 *     description: Retrieve tags with pagination, search, and question counts. Requires content role (admin, creator, or reviewer).
 *     tags:
 *       - Admin - Question Metadata
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Page number (0-indexed)
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for tag name
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, recent]
 *           default: name
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Successfully retrieved tags
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tags:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       question_count:
 *                         type: integer
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                 totalTags:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - content role required
 *       500:
 *         description: Internal server error
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check - require content role (admin, creator, or reviewer)
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId || !["admin", "creator", "reviewer"].includes(userRole || "")) {
      return NextResponse.json(
        { error: userRole ? "Forbidden - Content role required" : "Unauthorized" },
        { status: userRole ? 403 : 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "0");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");
    const search = searchParams.get("search");
    const sortBy = searchParams.get("sortBy");

    // Build query
    let query = supabase.from("tags").select("*", { count: "exact" });

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    // Get total count
    const { count } = await query;

    // Get paginated data with appropriate sorting
    let dataQuery = query;

    if (sortBy === "recent") {
      // For recent tags, we'll use a subquery to get tags that have been used recently
      // This is a simplified approach - in a real implementation, you might want to track tag usage
      dataQuery = dataQuery.order("created_at", { ascending: false });
    } else {
      dataQuery = dataQuery.order("name");
    }

    const { data, error: dataError } = await dataQuery.range(
      page * pageSize,
      (page + 1) * pageSize - 1
    );

    if (dataError) {
      throw dataError;
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        tags: [],
        totalTags: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
        currentPage: page,
      });
    }

    // Get question counts for all tags in a single query (eliminates N+1 problem)
    const tagIds = data.map((tag) => tag.id);
    const { data: questionCounts } = await supabase
      .from("question_tags")
      .select("tag_id")
      .in("tag_id", tagIds);

    // Create a map of tag_id -> question_count
    const countMap = new Map<string, number>();
    questionCounts?.forEach((qt) => {
      if (qt.tag_id) {
        countMap.set(qt.tag_id, (countMap.get(qt.tag_id) || 0) + 1);
      }
    });

    // Transform the data to include question counts
    const tagsWithCounts = data.map((tag) => ({
      ...tag,
      question_count: countMap.get(tag.id) || 0,
    }));

    return NextResponse.json({
      tags: tagsWithCounts,
      totalTags: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize),
      currentPage: page,
    });
  } catch (error) {
    console.error("Error in admin tags API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/admin/questions/metadata/tags:
 *   post:
 *     summary: Create a new tag
 *     description: Create a new tag for categorizing questions. Requires content role (admin, creator, or reviewer).
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
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Tag name (must be unique)
 *     responses:
 *       200:
 *         description: Tag created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tag:
 *                   type: object
 *       400:
 *         description: Bad request - missing tag name
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - content role required
 *       409:
 *         description: Conflict - tag with this name already exists
 *       500:
 *         description: Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check - require content role (admin, creator, or reviewer)
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId || !["admin", "creator", "reviewer"].includes(userRole || "")) {
      return NextResponse.json(
        { error: userRole ? "Forbidden - Content role required" : "Unauthorized" },
        { status: userRole ? 403 : 401 }
      );
    }

    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Tag name is required" }, { status: 400 });
    }

    // Create tag with service role to bypass RLS
    const { data, error } = await supabase
      .from("tags")
      .insert({ name: name.trim() })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // Unique constraint violation
        return NextResponse.json({ error: "A tag with this name already exists" }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ tag: data });
  } catch (error) {
    console.error("Error creating tag:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/admin/questions/metadata/tags:
 *   patch:
 *     summary: Update a tag
 *     description: Update tag name. Requires content role (admin, creator, or reviewer).
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
 *               - tagId
 *               - name
 *             properties:
 *               tagId:
 *                 type: string
 *                 format: uuid
 *               name:
 *                 type: string
 *                 description: New tag name (must be unique)
 *     responses:
 *       200:
 *         description: Tag updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tag:
 *                   type: object
 *       400:
 *         description: Bad request - missing tagId or name
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - content role required
 *       409:
 *         description: Conflict - tag with this name already exists
 *       500:
 *         description: Internal server error
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check - require content role (admin, creator, or reviewer)
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId || !["admin", "creator", "reviewer"].includes(userRole || "")) {
      return NextResponse.json(
        { error: userRole ? "Forbidden - Content role required" : "Unauthorized" },
        { status: userRole ? 403 : 401 }
      );
    }

    const body = await request.json();
    const { tagId, name } = body;

    if (!tagId || !name || !name.trim()) {
      return NextResponse.json({ error: "Tag ID and name are required" }, { status: 400 });
    }

    // Update tag with service role to bypass RLS
    const { data, error } = await supabase
      .from("tags")
      .update({ name: name.trim() })
      .eq("id", tagId)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // Unique constraint violation
        return NextResponse.json({ error: "A tag with this name already exists" }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ tag: data });
  } catch (error) {
    console.error("Error updating tag:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/admin/questions/metadata/tags:
 *   delete:
 *     summary: Delete a tag
 *     description: Delete a tag and remove all question associations. Requires content role (admin, creator, or reviewer).
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
 *               - tagId
 *             properties:
 *               tagId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Tag deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: Bad request - missing tagId
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - content role required
 *       500:
 *         description: Internal server error
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check - require content role (admin, creator, or reviewer)
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId || !["admin", "creator", "reviewer"].includes(userRole || "")) {
      return NextResponse.json(
        { error: userRole ? "Forbidden - Content role required" : "Unauthorized" },
        { status: userRole ? 403 : 401 }
      );
    }

    const body = await request.json();
    const { tagId } = body;

    if (!tagId) {
      return NextResponse.json({ error: "Tag ID is required" }, { status: 400 });
    }

    // First delete all question_tags relationships
    const { error: relationError } = await supabase
      .from("question_tags")
      .delete()
      .eq("tag_id", tagId);

    if (relationError) {
      throw relationError;
    }

    // Then delete the tag
    const { error } = await supabase.from("tags").delete().eq("id", tagId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting tag:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
