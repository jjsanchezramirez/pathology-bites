// src/app/api/admin/questions/stats/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";

/**
 * GET /api/admin/questions/stats
 * Returns statistics about questions in the database
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has admin/creator/reviewer role
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "creator", "reviewer"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get total questions count
    const { count: totalQuestions, error: totalError } = await supabase
      .from("questions")
      .select("*", { count: "exact", head: true });

    if (totalError) {
      console.error("Error fetching total questions:", totalError);
      throw totalError;
    }

    // Get total published questions count
    const { count: totalPublishedQuestions, error: publishedError } = await supabase
      .from("questions")
      .select("*", { count: "exact", head: true })
      .eq("status", "published");

    if (publishedError) {
      console.error("Error fetching published questions:", publishedError);
      throw publishedError;
    }

    // Get questions by status
    const { data: statusCounts, error: statusError } = await supabase
      .from("questions")
      .select("status");

    if (statusError) {
      console.error("Error fetching status counts:", statusError);
      throw statusError;
    }

    const statusBreakdown =
      statusCounts?.reduce(
        (acc, q) => {
          acc[q.status] = (acc[q.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ) || {};

    // Get total categories with questions
    const { data: questionsWithCategories, error: categoriesError } = await supabase
      .from("questions")
      .select("category_id")
      .not("category_id", "is", null);

    if (categoriesError) {
      console.error("Error fetching categories:", categoriesError);
      throw categoriesError;
    }

    const uniqueCategories = new Set(questionsWithCategories?.map((q) => q.category_id) || []);
    const totalCategoriesWithQuestions = uniqueCategories.size;

    // Get total question sets with questions
    const { data: questionSetsWithQuestions, error: setsError } = await supabase
      .from("questions")
      .select("question_set_id")
      .not("question_set_id", "is", null);

    if (setsError) {
      console.error("Error fetching question sets:", setsError);
      throw setsError;
    }

    const uniqueQuestionSets = new Set(
      questionSetsWithQuestions?.map((q) => q.question_set_id) || []
    );
    const totalQuestionSetsWithQuestions = uniqueQuestionSets.size;

    // Get questions with images count
    const { data: questionsWithImages, error: imagesError } = await supabase
      .from("question_images")
      .select("question_id");

    if (imagesError) {
      console.error("Error fetching questions with images:", imagesError);
      throw imagesError;
    }

    const uniqueQuestionsWithImages = new Set(
      questionsWithImages?.map((qi) => qi.question_id) || []
    );
    const totalQuestionsWithImages = uniqueQuestionsWithImages.size;

    // Get flagged questions count
    const { count: flaggedQuestions, error: flaggedError } = await supabase
      .from("questions")
      .select("*", { count: "exact", head: true })
      .gt("flag_count", 0);

    if (flaggedError) {
      console.error("Error fetching flagged questions:", flaggedError);
      throw flaggedError;
    }

    // Get recently created questions (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: recentQuestions, error: recentError } = await supabase
      .from("questions")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo.toISOString());

    if (recentError) {
      console.error("Error fetching recent questions:", recentError);
      throw recentError;
    }

    return NextResponse.json({
      success: true,
      data: {
        totalQuestions: totalQuestions || 0,
        totalPublishedQuestions: totalPublishedQuestions || 0,
        totalCategoriesWithQuestions,
        totalQuestionSetsWithQuestions,
        totalQuestionsWithImages,
        flaggedQuestions: flaggedQuestions || 0,
        recentQuestions: recentQuestions || 0,
        statusBreakdown,
      },
    });
  } catch (error) {
    console.error("Error fetching question statistics:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch question statistics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
