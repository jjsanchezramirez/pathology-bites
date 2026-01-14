// API endpoint to check for duplicate category/lesson/topic combinations
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const { category_id, lesson, topic, exclude_question_id } = await request.json();

    // Validate required fields
    if (!category_id || !lesson || !topic) {
      return NextResponse.json(
        { error: "category_id, lesson, and topic are required" },
        { status: 400 }
      );
    }

    // Query for existing questions with the same category/lesson/topic combination
    let query = supabase
      .from("questions")
      .select("id, title, status, version, created_at")
      .eq("category_id", category_id)
      .eq("lesson", lesson)
      .eq("topic", topic);

    // Exclude the current question if editing
    if (exclude_question_id) {
      query = query.neq("id", exclude_question_id);
    }

    const { data: existingQuestions, error: queryError } = await query;

    if (queryError) {
      console.error("Error checking for duplicate topics:", queryError);
      return NextResponse.json(
        { error: "Failed to check for duplicate topics" },
        { status: 500 }
      );
    }

    // Return results
    return NextResponse.json({
      has_duplicate: existingQuestions && existingQuestions.length > 0,
      existing_questions: existingQuestions || [],
      count: existingQuestions?.length || 0,
    });
  } catch (error) {
    console.error("Error in check-duplicate-topic endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
