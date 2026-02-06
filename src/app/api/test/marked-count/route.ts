// Temporary test endpoint - DELETE after testing
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { getUserIdFromHeaders } from "@/shared/utils/auth/auth-helpers";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const userId = getUserIdFromHeaders(request);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all categories
    const { data: categories } = await supabase.from("categories").select("id").eq("level", 2);

    const categoryIds = categories?.map((c) => c.id) || [];

    // Get user favorites count
    const { count: favCount } = await supabase
      .from("user_favorites")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    // Call the function
    const { data: stats, error } = await supabase.rpc("get_user_category_stats", {
      p_user_id: userId,
      p_category_ids: categoryIds,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    interface CategoryStat {
      category_id: string;
      all_count: number;
      unused_count: number;
      incorrect_count: number;
      marked_count: number;
      correct_count: number;
    }

    // Calculate total marked
    const totalMarked =
      stats?.reduce((sum: number, s: CategoryStat) => sum + s.marked_count, 0) || 0;

    // Get categories with marked questions
    const categoriesWithMarked = stats?.filter((s: CategoryStat) => s.marked_count > 0) || [];

    return NextResponse.json({
      success: true,
      data: {
        totalFavoritesInTable: favCount || 0,
        totalMarkedFromFunction: totalMarked,
        match: favCount === totalMarked,
        categoriesWithMarked: categoriesWithMarked,
      },
    });
  } catch (error) {
    console.error("Test error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
