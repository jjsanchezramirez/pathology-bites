// src/app/api/user/settings/route.ts
// API routes for managing user settings

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import {
  DEFAULT_QUIZ_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_UI_SETTINGS,
} from "@/shared/config/user-settings-defaults";

/**
 * @swagger
 * /api/user/settings:
 *   get:
 *     summary: Get user settings
 *     description: Retrieve user's quiz settings, notification preferences, and UI preferences. Creates default settings if none exist. Requires authentication.
 *     tags:
 *       - User - Settings
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved user settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     quiz_settings:
 *                       type: object
 *                       properties:
 *                         default_question_count:
 *                           type: integer
 *                           enum: [5, 10, 25, 50]
 *                         default_mode:
 *                           type: string
 *                           enum: [tutor, practice]
 *                         default_timing:
 *                           type: string
 *                           enum: [timed, untimed]
 *                         default_question_type:
 *                           type: string
 *                           enum: [all, unused, needsReview, marked, mastered, incorrect, correct]
 *                         default_category_selection:
 *                           type: string
 *                           enum: [all, ap_only, cp_only, custom]
 *                     notification_settings:
 *                       type: object
 *                       description: User notification preferences
 *                     ui_settings:
 *                       type: object
 *                       description: User interface preferences including text zoom
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized - missing authentication
 *       500:
 *         description: Internal server error
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth is handled by middleware
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user settings using correct schema with separate columns
    const { data, error } = await supabase
      .from("user_settings")
      .select("quiz_settings, notification_settings, ui_settings, counter_settings, created_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Failed to fetch user settings" }, { status: 500 });
    }

    // If no settings exist for user, create default settings
    if (!data) {
      const defaultSettings = {
        quiz_settings: DEFAULT_QUIZ_SETTINGS,
        notification_settings: DEFAULT_NOTIFICATION_SETTINGS,
        ui_settings: DEFAULT_UI_SETTINGS,
        counter_settings: null,
      };

      // Try to create default settings for the user
      const { data: newData, error: createError } = await supabase
        .from("user_settings")
        .insert({
          user_id: userId,
          quiz_settings: defaultSettings.quiz_settings,
          notification_settings: defaultSettings.notification_settings,
          ui_settings: defaultSettings.ui_settings,
        })
        .select("quiz_settings, notification_settings, ui_settings, counter_settings, created_at, updated_at")
        .single();

      if (createError) {
        // Return defaults even if creation fails
        return NextResponse.json({
          success: true,
          data: defaultSettings,
        });
      }

      // Return the newly created settings
      return NextResponse.json({
        success: true,
        data: {
          quiz_settings: newData.quiz_settings,
          notification_settings: newData.notification_settings,
          ui_settings: newData.ui_settings,
          counter_settings: newData.counter_settings ?? null,
          created_at: newData.created_at,
          updated_at: newData.updated_at,
        },
      });
    }

    // Combine the separate columns into the expected format
    const combinedSettings = {
      quiz_settings: data.quiz_settings || DEFAULT_QUIZ_SETTINGS,
      notification_settings: data.notification_settings || DEFAULT_NOTIFICATION_SETTINGS,
      ui_settings: data.ui_settings || DEFAULT_UI_SETTINGS,
      counter_settings: data.counter_settings ?? null,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };

    console.log(
      "[UserSettings API] Returning settings for user:",
      userId,
      "text_zoom:",
      combinedSettings.ui_settings.text_zoom
    );

    return NextResponse.json({
      success: true,
      data: combinedSettings,
    });
  } catch (error) {
    console.error(
      "[UserSettings GET] Unexpected error:",
      error instanceof Error ? error.message : String(error)
    );
    console.error(
      "[UserSettings GET] Error stack:",
      error instanceof Error ? error.stack : "No stack trace"
    );
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * @swagger
 * /api/user/settings:
 *   patch:
 *     summary: Update user settings
 *     description: Update a specific section of user settings (quiz_settings, notification_settings, or ui_settings). Merges new values with existing settings. Requires authentication.
 *     tags:
 *       - User - Settings
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - section
 *               - settings
 *             properties:
 *               section:
 *                 type: string
 *                 enum: [quiz_settings, notification_settings, ui_settings]
 *                 description: The settings section to update
 *               settings:
 *                 type: object
 *                 description: Settings object with fields to update (will be merged with existing settings)
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     quiz_settings:
 *                       type: object
 *                     notification_settings:
 *                       type: object
 *                     ui_settings:
 *                       type: object
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad request - invalid section or settings
 *       401:
 *         description: Unauthorized - missing authentication
 *       500:
 *         description: Internal server error
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth is handled by middleware
    const userId = request.headers.get("x-user-id");

    console.log("[UserSettings PATCH] userId:", userId);

    if (!userId) {
      console.error("[UserSettings PATCH] No userId in headers");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { section, settings } = body;

    console.log("[UserSettings PATCH] Request:", { section, settings });

    // Validate section
    const validSections = ["quiz_settings", "notification_settings", "ui_settings", "counter_settings"];
    if (!section || !validSections.includes(section)) {
      console.error("[UserSettings PATCH] Invalid section:", section);
      return NextResponse.json(
        { error: "Invalid section. Must be one of: " + validSections.join(", ") },
        { status: 400 }
      );
    }

    // Validate settings
    if (!settings || typeof settings !== "object") {
      console.error("[UserSettings PATCH] Invalid settings:", settings);
      return NextResponse.json({ error: "Settings must be a valid object" }, { status: 400 });
    }

    // Validate quiz settings if that's what we're updating
    if (section === "quiz_settings") {
      const validQuizSettings = {
        default_question_count: (val: unknown) =>
          typeof val === "number" && [5, 10, 25, 50].includes(val),
        default_mode: (val: unknown) =>
          typeof val === "string" && ["tutor", "practice"].includes(val),
        default_timing: (val: unknown) =>
          typeof val === "string" && ["timed", "untimed"].includes(val),
        default_question_type: (val: unknown) =>
          typeof val === "string" &&
          ["all", "unused", "needsReview", "marked", "mastered", "incorrect", "correct"].includes(
            val
          ),
        default_category_selection: (val: unknown) =>
          typeof val === "string" && ["all", "ap_only", "cp_only", "custom"].includes(val),
      };

      for (const [key, value] of Object.entries(settings)) {
        if (validQuizSettings[key as keyof typeof validQuizSettings]) {
          if (!validQuizSettings[key as keyof typeof validQuizSettings](value)) {
            return NextResponse.json(
              { error: `Invalid value for ${key}: ${value}` },
              { status: 400 }
            );
          }
        }
      }
    }

    // Get current settings first using correct schema
    const { data: currentData, error: getCurrentError } = await supabase
      .from("user_settings")
      .select("quiz_settings, notification_settings, ui_settings, counter_settings")
      .eq("user_id", userId)
      .maybeSingle();

    if (getCurrentError) {
      return NextResponse.json({ error: "Failed to fetch current settings" }, { status: 500 });
    }

    const currentSettings = currentData as {
      quiz_settings?: Record<string, unknown>;
      notification_settings?: Record<string, unknown>;
      ui_settings?: Record<string, unknown>;
      counter_settings?: Record<string, unknown>;
    } | null;

    // Prepare the update object based on the section
    const updateData: Record<string, unknown> = {
      user_id: userId,
      updated_at: new Date().toISOString(),
    };

    // counter_settings uses full replacement (contains arrays that don't shallow-merge well).
    // Other sections use shallow merge to avoid wiping out unrelated fields.
    if (section === "counter_settings") {
      updateData[section] = settings;
    } else if (currentSettings && currentSettings[section as keyof typeof currentSettings]) {
      updateData[section] = {
        ...currentSettings[section as keyof typeof currentSettings],
        ...settings,
      };
    } else {
      updateData[section] = settings;
    }

    // If no current data exists, we need to provide defaults for other sections
    if (!currentData) {
      if (section !== "quiz_settings") {
        updateData.quiz_settings = DEFAULT_QUIZ_SETTINGS;
      }
      if (section !== "notification_settings") {
        updateData.notification_settings = DEFAULT_NOTIFICATION_SETTINGS;
      }
      if (section !== "ui_settings") {
        updateData.ui_settings = DEFAULT_UI_SETTINGS;
      }
    }

    // Update settings using upsert with correct schema
    console.log("[UserSettings PATCH] Upserting data:", JSON.stringify(updateData, null, 2));

    const { data, error } = await supabase
      .from("user_settings")
      .upsert(updateData, {
        onConflict: "user_id", // Use user_id for conflict resolution
        ignoreDuplicates: false, // Update on conflict instead of ignoring
      })
      .select("quiz_settings, notification_settings, ui_settings, counter_settings, created_at, updated_at")
      .maybeSingle();

    if (error) {
      console.error("[UserSettings PATCH] Database error:", error);
      return NextResponse.json(
        { error: "Failed to update user settings", details: error.message },
        { status: 500 }
      );
    }

    // Check if upsert returned no data (RLS policy might have blocked it)
    if (!data) {
      console.warn(
        "[UserSettings PATCH] Upsert returned no data - RLS policy may have blocked the operation"
      );
      return NextResponse.json(
        { error: "Failed to update user settings", details: "No data returned from database" },
        { status: 500 }
      );
    }

    console.log("[UserSettings PATCH] Update successful");

    // Return the combined settings in the expected format
    const combinedSettings = {
      quiz_settings: data.quiz_settings || {},
      notification_settings: data.notification_settings || {},
      ui_settings: data.ui_settings || {},
      counter_settings: data.counter_settings ?? null,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };

    return NextResponse.json({
      success: true,
      data: combinedSettings,
    });
  } catch (error) {
    console.error(
      "[UserSettings PATCH] Unexpected error:",
      error instanceof Error ? error.message : String(error)
    );
    console.error(
      "[UserSettings PATCH] Error stack:",
      error instanceof Error ? error.stack : "No stack trace"
    );
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
