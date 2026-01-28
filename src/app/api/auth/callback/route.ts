// src/app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { withRateLimit, authRateLimiter } from "@/shared/utils/api-rate-limiter";
import {
  DEFAULT_QUIZ_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_UI_SETTINGS,
} from "@/shared/constants/user-settings-defaults";

const rateLimitedHandler = withRateLimit(authRateLimiter);

export const GET = rateLimitedHandler(async function (request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Feature flags removed - always allow new account creation

  if (code) {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      /**
       * USER CREATION NOTE:
       * User creation in public.users and user_settings is handled in APPLICATION CODE.
       * This ensures all users have corresponding entries in both tables.
       *
       * Process:
       * 1. Check if user exists in public.users
       * 2. If not, create user record with metadata from auth.users
       * 3. Create default user_settings for the new user
       * 4. Redirect based on user role
       */

      // Check if user exists in database
      let userData = null;
      const { data: existingUser, error: profileError } = await supabase
        .from("users")
        .select("id, role, status")
        .eq("id", data.user.id)
        .single();

      if (profileError && profileError.code === "PGRST116") {
        // If user doesn't exist, create them
        // New account creation is always allowed now
        // NOTE: The handle_new_user database trigger may have already created this user,
        //       so we handle potential duplicate errors gracefully

        // Create user in public.users
        const { data: newUser, error: createError } = await supabase
          .from("users")
          .insert({
            id: data.user.id,
            email: data.user.email || "",
            first_name: data.user.user_metadata?.first_name || "",
            last_name: data.user.user_metadata?.last_name || "",
            user_type: data.user.user_metadata?.user_type || "other",
            role: "user",
            status: "active",
          })
          .select("role")
          .single();

        if (createError) {
          // Check if error is due to duplicate key (trigger already created user)
          if (createError.code === "23505") {
            console.log(
              "User already exists (likely created by trigger), fetching existing user:",
              data.user.id
            );
            // Fetch the existing user instead
            const { data: fetchedUser, error: fetchError } = await supabase
              .from("users")
              .select("role")
              .eq("id", data.user.id)
              .single();

            if (fetchError) {
              console.error("Error fetching existing user:", fetchError);
              return NextResponse.redirect(
                `${origin}/auth-error?error=user_fetch_failed&description=Failed to retrieve user account`
              );
            }
            userData = fetchedUser;
          } else {
            console.error("Error creating user:", createError);
            return NextResponse.redirect(
              `${origin}/auth-error?error=user_creation_failed&description=Failed to create user account`
            );
          }
        } else {
          userData = newUser;
        }

        // Create default user settings (only if we created the user, trigger may have already created settings)
        if (newUser) {
          const { error: settingsError } = await supabase.from("user_settings").insert({
            user_id: data.user.id,
            quiz_settings: DEFAULT_QUIZ_SETTINGS,
            notification_settings: DEFAULT_NOTIFICATION_SETTINGS,
            ui_settings: DEFAULT_UI_SETTINGS,
          });

          if (settingsError) {
            // Ignore duplicate key errors (trigger already created settings)
            if (settingsError.code !== "23505") {
              console.error("Error creating user settings:", settingsError);
            }
            // Don't fail the redirect if settings creation fails - user can still log in
          }
        }
      } else if (profileError) {
        console.error("Error checking user:", profileError);
        return NextResponse.redirect(
          `${origin}/auth-error?error=user_check_failed&description=Failed to check user account`
        );
      } else if (existingUser?.status === "deleted") {
        // User exists but is soft-deleted - restore them
        console.log("Restoring soft-deleted user:", {
          userId: data.user.id,
          email: data.user.email,
        });

        const { data: restoredUser, error: restoreError } = await supabase
          .from("users")
          .update({
            status: "active",
            deleted_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.user.id)
          .select("role")
          .single();

        if (restoreError) {
          console.error("Error restoring user:", restoreError);
          return NextResponse.redirect(
            `${origin}/auth-error?error=user_restore_failed&description=Failed to restore user account`
          );
        }

        // Check if user_settings exist, create if missing
        const { data: existingSettings } = await supabase
          .from("user_settings")
          .select("user_id")
          .eq("user_id", data.user.id)
          .single();

        if (!existingSettings) {
          console.log("Creating missing user_settings for restored user:", data.user.id);
          const { error: settingsError } = await supabase.from("user_settings").insert({
            user_id: data.user.id,
            quiz_settings: DEFAULT_QUIZ_SETTINGS,
            notification_settings: DEFAULT_NOTIFICATION_SETTINGS,
            ui_settings: DEFAULT_UI_SETTINGS,
          });

          if (settingsError) {
            console.error("Error creating user settings for restored user:", settingsError);
            // Don't fail - user can still log in
          }
        }

        userData = restoredUser;
        console.log("User restored successfully:", {
          userId: data.user.id,
          role: restoredUser.role,
        });
      } else {
        userData = existingUser;
      }

      // Final safeguard: Ensure user_settings exist for all users
      if (userData) {
        const { data: existingSettings } = await supabase
          .from("user_settings")
          .select("user_id")
          .eq("user_id", data.user.id)
          .single();

        if (!existingSettings) {
          console.log("Creating missing user_settings as final safeguard:", data.user.id);
          const { error: settingsError } = await supabase.from("user_settings").insert({
            user_id: data.user.id,
            quiz_settings: DEFAULT_QUIZ_SETTINGS,
            notification_settings: DEFAULT_NOTIFICATION_SETTINGS,
            ui_settings: DEFAULT_UI_SETTINGS,
          });

          if (settingsError) {
            console.error("Error creating user settings in final safeguard:", settingsError);
            // Don't fail - user can still log in
          } else {
            console.log("User settings created successfully in final safeguard:", data.user.id);
          }
        }
      }

      // OPTIMIZATION: Store role in user_metadata to avoid database lookups
      // This allows middleware to read role from JWT without hitting database
      if (userData?.role) {
        try {
          await supabase.auth.updateUser({
            data: { role: userData.role },
          });
          console.log("[Auth Callback] Updated user_metadata with role:", userData.role);
        } catch (metadataError) {
          console.error("[Auth Callback] Failed to update user_metadata:", metadataError);
          // Non-critical error, continue with redirect
        }
      }

      // Redirect based on user role - consistent with middleware logic
      const redirectUrl =
        userData?.role === "admin" || userData?.role === "creator" || userData?.role === "reviewer"
          ? `${origin}/admin`
          : `${origin}/dashboard`;

      return NextResponse.redirect(redirectUrl);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(
    `${origin}/auth-error?error=oauth_error&description=Failed to authenticate with OAuth provider`
  );
});
