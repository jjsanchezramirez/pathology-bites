import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidateQuestions } from "@/shared/utils/revalidation";

// Create Supabase client with service role for admin operations
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSupabaseClient(supabaseUrl, supabaseServiceKey);
}

// Type definitions for request body
interface QuestionOptionInput {
  text: string;
  is_correct?: boolean;
  explanation?: string;
  order_index?: number;
}

interface QuestionImageInput {
  image_id: string;
  question_section: string;
  order_index: number;
}

interface CreateQuestionRequest {
  title: string;
  stem: string;
  difficulty?: string;
  teaching_point?: string;
  question_references?: string;
  question_set_id?: string;
  category_id?: string;
  lesson?: string;
  topic?: string;
  question_options: QuestionOptionInput[];
  tag_ids?: string[];
  question_images?: QuestionImageInput[];
}

export async function POST(request: NextRequest) {
  try {
    // Auth check - require admin, creator, or reviewer role
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId || !["admin", "creator", "reviewer"].includes(userRole || "")) {
      return NextResponse.json(
        { error: userRole ? "Forbidden - Admin access required" : "Unauthorized" },
        { status: userRole ? 403 : 401 }
      );
    }

    // Use service role client for database operations to bypass RLS
    const supabase = createAdminClient();

    const questionData = (await request.json()) as CreateQuestionRequest;

    // Validate required fields
    if (!questionData.title || !questionData.stem || !questionData.question_options) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Start a transaction to create the question and related data
    const { data: question, error: questionError } = await supabase
      .from("questions")
      .insert({
        title: questionData.title,
        stem: questionData.stem,
        difficulty: questionData.difficulty,
        teaching_point: questionData.teaching_point,
        question_references: questionData.question_references,
        status: "draft",
        question_set_id: questionData.question_set_id,
        category_id: questionData.category_id,
        lesson: questionData.lesson,
        topic: questionData.topic,
        created_by: userId,
        updated_by: userId,
        version_major: 1,
        version_minor: 0,
        version_patch: 0,
      })
      .select()
      .single();

    if (questionError) {
      console.error("Error creating question:", questionError);
      return NextResponse.json(
        { error: "Failed to create question", details: questionError.message },
        { status: 500 }
      );
    }

    // Create question options
    if (questionData.question_options && questionData.question_options.length > 0) {
      const answerOptions = questionData.question_options.map(
        (option: QuestionOptionInput, index: number) => ({
          question_id: question.id,
          text: option.text,
          is_correct: option.is_correct ?? false,
          explanation: option.explanation || null,
          order_index: option.order_index ?? index,
          // Note: Don't include 'id' field - let database generate UUID
        })
      );

      const { error: optionsError } = await supabase.from("question_options").insert(answerOptions);

      if (optionsError) {
        console.error("Error creating answer options:", optionsError);
        console.error("Options data:", answerOptions);
        // Clean up the question if options failed
        await supabase.from("questions").delete().eq("id", question.id);
        return NextResponse.json(
          {
            error: "Failed to create answer options",
            details: optionsError.message,
          },
          { status: 500 }
        );
      }
    }

    // Create question tags
    if (questionData.tag_ids && questionData.tag_ids.length > 0) {
      const questionTags = questionData.tag_ids.map((tagId: string) => ({
        question_id: question.id,
        tag_id: tagId,
      }));

      const { error: tagsError } = await supabase.from("question_tags").insert(questionTags);

      if (tagsError) {
        console.error("Error creating question tags:", tagsError);
        // Don't fail the entire operation for tags
      }
    }

    // Handle question images if provided
    if (questionData.question_images && questionData.question_images.length > 0) {
      const questionImages = questionData.question_images.map((img: QuestionImageInput) => ({
        question_id: question.id,
        image_id: img.image_id, // This should be set after image upload
        question_section: img.question_section,
        order_index: img.order_index,
      }));

      const { error: imagesError } = await supabase.from("question_images").insert(questionImages);

      if (imagesError) {
        console.error("Error creating question images:", imagesError);
        // Don't fail the entire operation for images
      }
    }

    // Revalidate caches to update all admin pages
    revalidateQuestions({ questionId: question.id, includeDashboard: true });

    return NextResponse.json({
      success: true,
      question: {
        id: question.id,
        title: question.title,
        status: question.status,
      },
    });
  } catch (error) {
    console.error("Error in create question API:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}
