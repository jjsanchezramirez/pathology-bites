// src/app/api/user/achievements/check/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { awardAchievements } from "@/features/achievements/services/achievement-service.server";
import { getUserIdFromHeaders } from "@/shared/utils/auth-helpers";

async function checkAndAwardAchievements(request: NextRequest) {
  const _supabase = await createClient();

  // Get authenticated user
  const userId = getUserIdFromHeaders(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check and award achievements
  const newAchievements = await awardAchievements(userId);

  return NextResponse.json({
    success: true,
    newAchievements,
    count: newAchievements.length,
  });
}

/**
 * Check and award any new achievements for the user
 * Called after quiz completion or manually
 * GET method to avoid CSRF issues for manual checks
 */
export async function GET(request: NextRequest) {
  try {
    return await checkAndAwardAchievements(request);
  } catch (error) {
    console.error("Unexpected error in check achievements API (GET):", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      {
        error: "Internal server error",
        details: errorMessage,
        success: false,
      },
      { status: 500 }
    );
  }
}

/**
 * POST method for programmatic calls (like after quiz completion)
 */
export async function POST(request: NextRequest) {
  try {
    return await checkAndAwardAchievements(request);
  } catch (error) {
    console.error("Unexpected error in check achievements API (POST):", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      {
        error: "Internal server error",
        details: errorMessage,
        success: false,
      },
      { status: 500 }
    );
  }
}
