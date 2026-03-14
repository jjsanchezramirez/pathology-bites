// src/app/api/public/uscap/init/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Create Supabase client for public access
function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function GET() {
  try {
    console.log("[USCAP Init API] Fetching real categories and question counts");

    const supabase = createSupabaseClient();

    // Fetch all categories
    const { data: categories, error: categoriesError } = await supabase
      .from("categories")
      .select("id, name, short_form, parent_id, level")
      .order("name");

    if (categoriesError) {
      console.error("[USCAP Init API] Categories error:", categoriesError);
      throw categoriesError;
    }

    // Count total published questions
    const { count: totalQuestions, error: countError } = await supabase
      .from("questions")
      .select("*", { count: "exact", head: true })
      .eq("status", "published");

    if (countError) {
      console.error("[USCAP Init API] Count error:", countError);
      throw countError;
    }

    // For each category, count questions
    const categoriesWithStats = await Promise.all(
      (categories || []).map(async (category) => {
        const { count: categoryCount } = await supabase
          .from("questions")
          .select("*", { count: "exact", head: true })
          .eq("status", "published")
          .eq("category_id", category.id);

        return {
          id: category.id,
          name: category.name,
          shortName: category.short_form || category.name,
          parentCategoryId: category.parent_id,
          questionStats: {
            all: categoryCount || 0,
            unused: categoryCount || 0, // For guests, all questions are unused
            needsReview: 0,
            marked: 0,
            mastered: 0,
          },
        };
      })
    );

    // Calculate AP/CP question counts using hierarchical structure
    // Find parent category IDs
    const apParent = categories?.find(
      (cat) => cat.name === "Anatomic Pathology" && cat.level === 1
    );
    const cpParent = categories?.find(
      (cat) => cat.name === "Clinical Pathology" && cat.level === 1
    );

    // Count questions in AP subcategories
    const apCategoryIds = categories
      ?.filter((cat) => cat.parent_id === apParent?.id)
      .map((cat) => cat.id) || [];

    const { count: apCount } = await supabase
      .from("questions")
      .select("*", { count: "exact", head: true })
      .eq("status", "published")
      .in("category_id", apCategoryIds.length > 0 ? apCategoryIds : ['none']);

    // Count questions in CP subcategories
    const cpCategoryIds = categories
      ?.filter((cat) => cat.parent_id === cpParent?.id)
      .map((cat) => cat.id) || [];

    const { count: cpCount } = await supabase
      .from("questions")
      .select("*", { count: "exact", head: true })
      .eq("status", "published")
      .in("category_id", cpCategoryIds.length > 0 ? cpCategoryIds : ['none']);

    const questionTypeStats = {
      all: {
        all: totalQuestions || 0,
        unused: totalQuestions || 0,
        needsReview: 0,
        marked: 0,
        mastered: 0,
      },
      ap_only: {
        all: apCount || 0,
        unused: apCount || 0,
        needsReview: 0,
        marked: 0,
        mastered: 0,
      },
      cp_only: {
        all: cpCount || 0,
        unused: cpCount || 0,
        needsReview: 0,
        marked: 0,
        mastered: 0,
      },
    };

    return NextResponse.json({
      success: true,
      data: {
        categories: categoriesWithStats,
        questionTypeStats,
      },
    });
  } catch (error) {
    console.error("[USCAP Init API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load quiz options",
      },
      { status: 500 }
    );
  }
}
