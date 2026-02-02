// src/app/api/user/init/route.ts
// Combined endpoint for initial user data + settings
// Reduces 2 API calls to 1

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import {
  DEFAULT_QUIZ_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_UI_SETTINGS,
} from "@/shared/config/user-settings-defaults";

export const dynamic = "force-dynamic";

interface UserInitData {
  userData: unknown;
  settings: unknown;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch both user data and settings in parallel
    const [
      userDataResult,
      settingsResult,
      userProfileResult,
      {
        data: { user },
      },
    ] = await Promise.all([
      // User performance data
      supabase.rpc("get_user_performance_data", { user_id_param: userId }),

      // User settings
      supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),

      // User profile (to check if user exists)
      supabase.from("users").select("id, role, status").eq("id", userId).maybeSingle(),

      // Get user metadata from auth
      supabase.auth.getUser(),
    ]);

    // FALLBACK: If user doesn't exist in database
    // NOTE: With the handle_new_user trigger, this should rarely happen since the trigger
    //       creates public.users automatically when auth.users is created
    if (userProfileResult.error?.code === "PGRST116" || !userProfileResult.data) {
      console.warn("[UserInit API] User not found in database, creating fallback user:", userId);

      // Create user record
      const { error: createUserError } = await supabase.from("users").insert({
        id: userId,
        email: user.email || "",
        first_name: user.user_metadata?.first_name || "",
        last_name: user.user_metadata?.last_name || "",
        user_type: user.user_metadata?.user_type || "other",
        role: "user",
        status: "active",
      });

      if (createUserError) {
        // Ignore duplicate key errors (trigger or concurrent request already created user)
        if (createUserError.code === "23505") {
          console.log(
            "[UserInit API] User already exists (created by trigger or concurrent request):",
            userId
          );
        } else {
          console.error("[UserInit API] Failed to create fallback user:", createUserError);
        }
        // Continue anyway - user might have been created by another concurrent request or trigger
      } else {
        console.log("[UserInit API] Fallback user created successfully");
      }
    }

    // Handle user data errors (except "user not found" which is handled above)
    if (userDataResult.error) {
      // Check if error is due to missing function (database not fully set up)
      if (userDataResult.error.code === "PGRST202") {
        console.warn(
          "[UserInit API] Database function get_user_performance_data not found - using empty performance data"
        );
      } else {
        console.error("[UserInit API] Error fetching user data:", userDataResult.error);
      }
      // Return empty data instead of failing - allows user to continue
      // They might be a new user without any quiz history yet
    }

    // Handle settings (create default if doesn't exist)
    let settings = settingsResult.data;
    if (!settings) {
      console.warn("[UserInit API] User settings not found, creating defaults for:", userId);

      // Create default settings using constants
      const { data: newSettings, error: createError } = await supabase
        .from("user_settings")
        .insert({
          user_id: userId,
          quiz_settings: DEFAULT_QUIZ_SETTINGS,
          notification_settings: DEFAULT_NOTIFICATION_SETTINGS,
          ui_settings: DEFAULT_UI_SETTINGS,
        })
        .select()
        .single();

      if (createError) {
        console.error("[UserInit API] Error creating settings:", createError);
        // Return default settings rather than failing
        settings = {
          quiz_settings: DEFAULT_QUIZ_SETTINGS,
          notification_settings: DEFAULT_NOTIFICATION_SETTINGS,
          ui_settings: DEFAULT_UI_SETTINGS,
        };
      } else {
        settings = newSettings;
      }
    }

    const response: UserInitData = {
      userData: userDataResult.data || null,
      settings,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("[UserInit API] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
