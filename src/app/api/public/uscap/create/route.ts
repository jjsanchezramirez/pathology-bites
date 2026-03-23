// src/app/api/public/quiz/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

// Create Supabase client for public access
function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseAnonKey);
}

interface QuestionImage {
  order_index: number;
  question_section: string;
  images: { id: string; url: string; description: string; alt_text: string | null } | { id: string; url: string; description: string; alt_text: string | null }[];
}

interface QuestionOption {
  id: string;
  text: string;
  is_correct: boolean;
  explanation: string;
  order_index: number;
}

interface QuestionCategory {
  id: string;
  name: string;
  short_form: string | null;
}

interface QuestionRow {
  id: string;
  stem: string;
  teaching_point: string;
  difficulty: string;
  question_references: string | null;
  categories: QuestionCategory | QuestionCategory[];
  question_options: QuestionOption[];
  question_images: QuestionImage[];
}

interface GuestQuizRequest {
  questionCount: number;
  questionType: "all" | "unused" | "needsReview" | "marked" | "mastered";
  categorySelection: "all" | "ap_only" | "cp_only" | "custom";
  selectedCategories: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: GuestQuizRequest = await request.json();
    const { questionCount, questionType, categorySelection, selectedCategories } = body;

    // Validate input
    if (!questionCount || questionCount < 1 || questionCount > 50) {
      return NextResponse.json(
        { success: false, error: "Invalid question count" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();

    // Build query based on category selection
    let query = supabase
      .from("questions")
      .select(
        `
        id,
        stem,
        teaching_point,
        difficulty,
        question_references,
        category_id,
        categories (
          id,
          name,
          short_form
        ),
        question_options (
          id,
          text,
          is_correct,
          explanation,
          order_index
        ),
        question_images (
          order_index,
          question_section,
          images (
            id,
            url,
            description,
            alt_text
          )
        )
      `
      )
      .eq("status", "published");

    // Apply category filters using hierarchical structure
    if (categorySelection === "ap_only") {
      // Get Anatomic Pathology child categories
      const { data: apParent } = await supabase
        .from("categories")
        .select("id")
        .eq("name", "Anatomic Pathology")
        .eq("level", 1)
        .single();

      if (apParent) {
        const { data: apChildren } = await supabase
          .from("categories")
          .select("id")
          .eq("parent_id", apParent.id);

        const apCategoryIds = apChildren?.map((cat) => cat.id) || [];
        if (apCategoryIds.length > 0) {
          query = query.in("category_id", apCategoryIds);
        }
      }
    } else if (categorySelection === "cp_only") {
      // Get Clinical Pathology child categories
      const { data: cpParent } = await supabase
        .from("categories")
        .select("id")
        .eq("name", "Clinical Pathology")
        .eq("level", 1)
        .single();

      if (cpParent) {
        const { data: cpChildren } = await supabase
          .from("categories")
          .select("id")
          .eq("parent_id", cpParent.id);

        const cpCategoryIds = cpChildren?.map((cat) => cat.id) || [];
        if (cpCategoryIds.length > 0) {
          query = query.in("category_id", cpCategoryIds);
        }
      }
    } else if (categorySelection === "custom" && selectedCategories.length > 0) {
      query = query.in("category_id", selectedCategories);
    }

    // For guest mode, we only support "all" question type
    // Fetch more questions than needed and randomly select
    const fetchCount = Math.min(questionCount * 3, 150); // Fetch 3x to randomize
    query = query.limit(fetchCount);

    const { data: questions, error: questionsError } = await query;

    if (questionsError) throw questionsError;

    if (!questions || questions.length === 0) {
      return NextResponse.json(
        { success: false, error: "No questions available for selected criteria" },
        { status: 400 }
      );
    }

    // Favor questions with images: shuffle each group separately, then pick from images-first
    const withImages = questions
      .filter((q) => q.question_images && q.question_images.length > 0)
      .sort(() => Math.random() - 0.5);
    const withoutImages = questions
      .filter((q) => !q.question_images || q.question_images.length === 0)
      .sort(() => Math.random() - 0.5);
    const prioritized = [...withImages, ...withoutImages];
    const selectedQuestions = prioritized.slice(0, questionCount);

    // Generate a guest session ID
    const guestSessionId = `guest-${uuidv4()}`;

    // Format questions for the quiz interface
    const formattedQuestions = (selectedQuestions as QuestionRow[]).map((q) => {
      const category = Array.isArray(q.categories) ? q.categories[0] : q.categories;

      return {
        id: q.id,
        questionText: q.stem,
        explanation: q.teaching_point,
        difficulty: q.difficulty,
        questionReferences: q.question_references || null,
        category: category ? {
          id: category.id,
          name: category.name,
          shortName: category.short_form || category.name,
        } : null,
        answerOptions: [...(q.question_options || [])]
          .sort((a, b) => a.order_index - b.order_index)
          .map((opt) => ({
            id: opt.id,
            optionText: opt.text,
            isCorrect: opt.is_correct,
            explanation: opt.explanation,
          })),
        images: (q.question_images || [])
          .sort((a, b) => a.order_index - b.order_index)
          .map((qi, idx: number) => {
            const image = Array.isArray(qi.images) ? qi.images[0] : qi.images;
            return {
              id: image?.id || '',
              url: image?.url || '',
              caption: image?.description || '',
              alt: image?.alt_text || image?.description || '',
              questionSection: qi.question_section || 'stem',
              orderIndex: idx,
            };
          }),
      };
    });

    // Create guest quiz session data
    const guestQuizSession = {
      sessionId: guestSessionId,
      questions: formattedQuestions,
      totalQuestions: formattedQuestions.length,
      currentQuestionIndex: 0,
      config: {
        questionCount,
        questionType,
        categorySelection,
        selectedCategories,
        mode: "tutor", // Always tutor mode for guests (show explanations)
        timing: "untimed", // Always untimed for guests
      },
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: guestQuizSession,
    });
  } catch (error) {
    console.error("Error creating guest quiz:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create quiz",
      },
      { status: 500 }
    );
  }
}
