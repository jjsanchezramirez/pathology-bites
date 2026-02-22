// src/app/api/admin/questions/metadata/categories/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";

/**
 * @swagger
 * /api/admin/questions/metadata/categories:
 *   get:
 *     summary: Get paginated categories
 *     description: Retrieve hierarchical categories with pagination, search, parent info, and question counts. Requires content role (admin, creator, or reviewer).
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
 *         description: Search term for category name
 *     responses:
 *       200:
 *         description: Successfully retrieved categories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 categories:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       short_form:
 *                         type: string
 *                       parent_id:
 *                         type: string
 *                         format: uuid
 *                       level:
 *                         type: integer
 *                       color:
 *                         type: string
 *                       question_count:
 *                         type: integer
 *                       parent_name:
 *                         type: string
 *                 totalCategories:
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

    // Auth check - require admin, creator, or reviewer role
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId || !["admin", "creator", "reviewer"].includes(userRole || "")) {
      return NextResponse.json(
        { error: userRole ? "Forbidden - Admin access required" : "Unauthorized" },
        { status: userRole ? 403 : 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "0");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");
    const search = searchParams.get("search");

    // Build base query for categories
    let baseQuery = supabase.from("categories").select(
      `
        *,
        parent:parent_id(name, short_form, color)
      `,
      { count: "exact" }
    );

    if (search) {
      baseQuery = baseQuery.ilike("name", `%${search}%`);
    }

    // Get total count
    const { count } = await baseQuery;

    // Get paginated data
    const { data: categories, error: dataError } = await baseQuery
      .order("level, name")
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (dataError) {
      throw dataError;
    }

    if (!categories || categories.length === 0) {
      return NextResponse.json({
        categories: [],
        totalCategories: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
        currentPage: page,
      });
    }

    // Get question counts for all categories in a single query
    const categoryIds = categories.map((cat) => cat.id);
    const { data: questionCounts } = await supabase
      .from("questions")
      .select("category_id")
      .in("category_id", categoryIds);

    // Create a map of category_id -> question_count
    const countMap = new Map<string, number>();
    questionCounts?.forEach((q) => {
      if (q.category_id) {
        countMap.set(q.category_id, (countMap.get(q.category_id) || 0) + 1);
      }
    });

    // Transform the data to include question counts
    const categoriesWithCounts = categories.map((category) => ({
      ...category,
      question_count: countMap.get(category.id) || 0,
      parent_name: category.parent?.name,
      parent_short_form: category.parent?.short_form,
      parent_color: category.parent?.color,
    }));

    return NextResponse.json({
      categories: categoriesWithCounts,
      totalCategories: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize),
      currentPage: page,
    });
  } catch (error) {
    console.error("Error in admin categories API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/admin/questions/metadata/categories:
 *   post:
 *     summary: Create a new category
 *     description: Create a new hierarchical category. Auto-calculates level based on parent. Requires content role (admin, creator, or reviewer).
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
 *                 description: Category name (must be unique)
 *               shortForm:
 *                 type: string
 *                 description: Short form abbreviation
 *               parentId:
 *                 type: string
 *                 format: uuid
 *                 description: Parent category ID (for subcategories)
 *               color:
 *                 type: string
 *                 description: Color code for UI display
 *     responses:
 *       200:
 *         description: Category created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 category:
 *                   type: object
 *       400:
 *         description: Bad request - missing category name
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - content role required
 *       409:
 *         description: Conflict - category with this name already exists
 *       500:
 *         description: Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check - require admin, creator, or reviewer role
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId || !["admin", "creator", "reviewer"].includes(userRole || "")) {
      return NextResponse.json(
        { error: userRole ? "Forbidden - Admin access required" : "Unauthorized" },
        { status: userRole ? 403 : 401 }
      );
    }

    const body = await request.json();
    const { name, shortForm, parentId, color } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    // Calculate level based on parent
    let level = 1;
    if (parentId) {
      const { data: parentData } = await supabase
        .from("categories")
        .select("level")
        .eq("id", parentId)
        .single();

      if (parentData) {
        level = parentData.level + 1;
      }
    }

    // Create category with service role to bypass RLS
    const { data, error } = await supabase
      .from("categories")
      .insert({
        name: name.trim(),
        short_form: shortForm?.trim() || null,
        parent_id: parentId || null,
        level,
        color: color?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // Unique constraint violation
        return NextResponse.json(
          { error: "A category with this name already exists" },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ category: data });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/admin/questions/metadata/categories:
 *   patch:
 *     summary: Update a category
 *     description: Update category details. Auto-recalculates level based on parent. Requires content role (admin, creator, or reviewer).
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
 *               - categoryId
 *               - name
 *             properties:
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *               name:
 *                 type: string
 *                 description: New category name (must be unique)
 *               shortForm:
 *                 type: string
 *               parentId:
 *                 type: string
 *                 format: uuid
 *               color:
 *                 type: string
 *     responses:
 *       200:
 *         description: Category updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 category:
 *                   type: object
 *       400:
 *         description: Bad request - missing categoryId or name
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - content role required
 *       409:
 *         description: Conflict - category with this name already exists
 *       500:
 *         description: Internal server error
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check - require admin, creator, or reviewer role
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId || !["admin", "creator", "reviewer"].includes(userRole || "")) {
      return NextResponse.json(
        { error: userRole ? "Forbidden - Admin access required" : "Unauthorized" },
        { status: userRole ? 403 : 401 }
      );
    }

    const body = await request.json();
    const { categoryId, name, shortForm, parentId, color } = body;

    if (!categoryId || !name || !name.trim()) {
      return NextResponse.json({ error: "Category ID and name are required" }, { status: 400 });
    }

    // Calculate level based on parent
    let level = 1;
    if (parentId) {
      const { data: parentData } = await supabase
        .from("categories")
        .select("level")
        .eq("id", parentId)
        .single();

      if (parentData) {
        level = parentData.level + 1;
      }
    }

    // Update category with service role to bypass RLS
    const { data, error } = await supabase
      .from("categories")
      .update({
        name: name.trim(),
        short_form: shortForm?.trim() || null,
        parent_id: parentId || null,
        level,
        color: color?.trim() || null,
      })
      .eq("id", categoryId)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // Unique constraint violation
        return NextResponse.json(
          { error: "A category with this name already exists" },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ category: data });
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/admin/questions/metadata/categories:
 *   delete:
 *     summary: Delete a category
 *     description: Delete a category. Cannot delete if it has subcategories. Unlinks all associated questions. Requires content role (admin, creator, or reviewer).
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
 *               - categoryId
 *             properties:
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: Bad request - missing categoryId or has subcategories
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

    // Auth check - require admin, creator, or reviewer role
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId || !["admin", "creator", "reviewer"].includes(userRole || "")) {
      return NextResponse.json(
        { error: userRole ? "Forbidden - Admin access required" : "Unauthorized" },
        { status: userRole ? 403 : 401 }
      );
    }

    const body = await request.json();
    const { categoryId } = body;

    if (!categoryId) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 });
    }

    // Check if category has children
    const { data: children } = await supabase
      .from("categories")
      .select("id")
      .eq("parent_id", categoryId);

    if (children && children.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete category with subcategories. Please delete subcategories first.",
        },
        { status: 400 }
      );
    }

    // First update all questions that reference this category to null
    const { error: relationError } = await supabase
      .from("questions")
      .update({ category_id: null })
      .eq("category_id", categoryId);

    if (relationError) {
      throw relationError;
    }

    // Then delete the category
    const { error } = await supabase.from("categories").delete().eq("id", categoryId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
