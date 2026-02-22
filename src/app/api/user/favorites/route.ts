// src/app/api/user/favorites/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { getUserIdFromHeaders } from "@/shared/utils/auth/auth-helpers";

/**
 * @swagger
 * /api/user/favorites:
 *   get:
 *     summary: Get user's favorite questions
 *     description: Retrieve a list of questions favorited by the user with optional filtering by category and pagination. Requires authentication.
 *     tags:
 *       - User - Favorites
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter favorites by category ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of favorites to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of favorites to skip for pagination
 *     responses:
 *       200:
 *         description: Favorites retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       question_id:
 *                         type: string
 *                         format: uuid
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       questions:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           title:
 *                             type: string
 *                           category_id:
 *                             type: string
 *                             format: uuid
 *                           status:
 *                             type: string
 *                           difficulty:
 *                             type: string
 *                           categories:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *       401:
 *         description: Unauthorized - missing authentication
 *       500:
 *         description: Internal server error
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated
    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("category_id");
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    // Build query
    let query = supabase
      .from("user_favorites")
      .select(
        `
        id,
        question_id,
        created_at,
        questions!inner (
          id,
          title,
          category_id,
          status,
          difficulty,
          categories (
            id,
            name
          )
        )
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    // Filter by category if specified
    if (categoryId) {
      query = query.eq("questions.category_id", categoryId);
    }

    // Add pagination if specified
    if (limit) {
      const limitNum = parseInt(limit);
      const offsetNum = offset ? parseInt(offset) : 0;
      query = query.range(offsetNum, offsetNum + limitNum - 1);
    }

    const { data: favorites, error } = await query;

    if (error) {
      console.error("Error fetching user favorites:", error);
      return NextResponse.json({ error: "Failed to fetch favorites" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: favorites || [],
    });
  } catch (error) {
    console.error("Error in user favorites GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/user/favorites:
 *   post:
 *     summary: Add question to favorites
 *     description: Add a question to the user's favorites list. Only published questions can be favorited. Idempotent - returns success if question is already favorited. Requires authentication.
 *     tags:
 *       - User - Favorites
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question_id
 *             properties:
 *               question_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the question to favorite
 *     responses:
 *       200:
 *         description: Question added to favorites (or already favorited)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   description: Favorite record
 *                 message:
 *                   type: string
 *                   description: Message if question was already favorited
 *       400:
 *         description: Bad request - missing question_id
 *       401:
 *         description: Unauthorized - missing authentication
 *       403:
 *         description: Forbidden - question not available (not published)
 *       404:
 *         description: Question not found
 *       500:
 *         description: Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated
    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { question_id } = await request.json();

    if (!question_id) {
      return NextResponse.json({ error: "question_id is required" }, { status: 400 });
    }

    // Check if question exists and is accessible
    const { data: question, error: questionError } = await supabase
      .from("questions")
      .select("id, status")
      .eq("id", question_id)
      .single();

    if (questionError || !question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Allow favoriting published questions (status check matches quiz system)
    if (question.status !== "published") {
      return NextResponse.json({ error: "Question not available" }, { status: 403 });
    }

    // Add to favorites (will fail if already exists due to unique constraint)
    const { data: favorite, error } = await supabase
      .from("user_favorites")
      .insert({
        user_id: userId,
        question_id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // Unique constraint violation - this is fine, question already favorited
        return NextResponse.json({
          success: true,
          message: "Question already in favorites",
        });
      }
      console.error("Error adding to favorites:", error);
      return NextResponse.json({ error: "Failed to add to favorites" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: favorite,
    });
  } catch (error) {
    console.error("Error in user favorites POST:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/user/favorites:
 *   delete:
 *     summary: Remove question from favorites
 *     description: Remove a question from the user's favorites list. Requires authentication.
 *     tags:
 *       - User - Favorites
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question_id
 *             properties:
 *               question_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the question to unfavorite
 *     responses:
 *       200:
 *         description: Question removed from favorites
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request - missing question_id
 *       401:
 *         description: Unauthorized - missing authentication
 *       500:
 *         description: Internal server error
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated
    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { question_id } = await request.json();

    if (!question_id) {
      return NextResponse.json({ error: "question_id is required" }, { status: 400 });
    }

    // Remove from favorites
    const { error } = await supabase
      .from("user_favorites")
      .delete()
      .eq("user_id", userId)
      .eq("question_id", question_id);

    if (error) {
      console.error("Error removing from favorites:", error);
      return NextResponse.json({ error: "Failed to remove from favorites" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Removed from favorites",
    });
  } catch (error) {
    console.error("Error in user favorites DELETE:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
