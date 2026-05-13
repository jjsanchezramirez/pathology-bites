// src/app/api/auth/confirm/route.ts
import { type EmailOtpType, type SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import {
  DEFAULT_QUIZ_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_UI_SETTINGS,
} from "@/shared/config/user-settings-defaults";

/**
 * Ensures that public.users and user_settings records exist for the authenticated user.
 * This is a fallback — the handle_new_user database trigger should have already created
 * these records when auth.users was inserted during signup.
 */
async function ensureUserRecords(supabase: SupabaseClient): Promise<void> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return;

  // Check if user exists in public.users
  const { error: checkError } = await supabase
    .from("users")
    .select("id")
    .eq("id", authUser.id)
    .single();

  // If user doesn't exist, create them
  if (checkError && checkError.code === "PGRST116") {
    const { error: createError } = await supabase.from("users").insert({
      id: authUser.id,
      email: authUser.email || "",
      first_name: authUser.user_metadata?.first_name || "",
      last_name: authUser.user_metadata?.last_name || "",
      user_type: authUser.user_metadata?.user_type || "other",
      role: "user",
      status: "active",
    });

    if (createError) {
      if (createError.code === "23505") {
        console.log("User already exists (created by trigger):", authUser.id);
      } else {
        console.error("Error creating user:", createError);
      }
    } else {
      console.log("User created successfully via email confirmation:", authUser.id);
    }

    // Create default user_settings for new user
    const { error: settingsError } = await supabase.from("user_settings").insert({
      user_id: authUser.id,
      quiz_settings: DEFAULT_QUIZ_SETTINGS,
      notification_settings: DEFAULT_NOTIFICATION_SETTINGS,
      ui_settings: DEFAULT_UI_SETTINGS,
    });

    if (settingsError) {
      if (settingsError.code === "23505") {
        console.log("User settings already exist (created by trigger):", authUser.id);
      } else {
        console.error("Error creating user settings for new user:", settingsError);
      }
    } else {
      console.log("User settings created successfully for new user:", authUser.id);
    }
  }

  // Final safeguard: Ensure user_settings exist for all users
  const { data: existingSettings } = await supabase
    .from("user_settings")
    .select("user_id")
    .eq("user_id", authUser.id)
    .single();

  if (!existingSettings) {
    console.log("Creating missing user_settings as final safeguard:", authUser.id);
    const { error: settingsError } = await supabase.from("user_settings").insert({
      user_id: authUser.id,
      quiz_settings: DEFAULT_QUIZ_SETTINGS,
      notification_settings: DEFAULT_NOTIFICATION_SETTINGS,
      ui_settings: DEFAULT_UI_SETTINGS,
    });

    if (settingsError) {
      console.error("Error creating user settings in final safeguard:", settingsError);
    } else {
      console.log("User settings created successfully in final safeguard:", authUser.id);
    }
  }
}

/**
 * @swagger
 * /api/auth/confirm:
 *   get:
 *     summary: Confirm email verification or password reset
 *     description: Handles email verification, password reset confirmations, and email change confirmations. This endpoint is called when users click confirmation links sent to their email. It verifies the OTP token and creates user records if needed.
 *     tags:
 *       - Authentication
 *     parameters:
 *       - in: query
 *         name: token_hash
 *         schema:
 *           type: string
 *         description: Email verification token hash
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         description: Alternative token parameter (used as token_hash if token_hash not provided)
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Authorization code for PKCE flow (signup, password reset, email change)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [signup, email, recovery, email_change]
 *         description: Type of email confirmation
 *       - in: query
 *         name: next
 *         schema:
 *           type: string
 *           default: /
 *         description: Redirect path after successful confirmation
 *     responses:
 *       302:
 *         description: Redirect to appropriate page based on confirmation result
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *               description: URL to redirect to (success page, error page, or link-expired page)
 *       400:
 *         description: Bad request - missing required parameters
 *       401:
 *         description: Unauthorized - invalid or expired token
 *       500:
 *         description: Internal server error during user creation
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const token = searchParams.get("token"); // Add support for token parameter
  const code = searchParams.get("code");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  console.log("Auth confirm route called:", {
    token_hash: !!token_hash,
    token: !!token,
    code: !!code,
    type,
    next,
  });

  // Handle code parameter (PKCE flow — used for signup, recovery, and email change)
  if (code) {
    const supabase = await createClient();

    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      console.log("Code exchange successful, type:", type);

      if (type === "signup" || type === "email" || !type) {
        // Email verification — ensure user records exist, then redirect to success
        try {
          await ensureUserRecords(supabase);
        } catch (userCreationError) {
          console.error("Error during user creation process:", userCreationError);
          // Continue to success redirect — verification was successful
        }
        console.log("Redirecting to email-verified page");
        return NextResponse.redirect(`${origin}/email-verified`);
      } else if (type === "recovery") {
        console.log("Password recovery, redirecting to:", next);
        return NextResponse.redirect(`${origin}${next}`);
      } else if (type === "email_change") {
        return NextResponse.redirect(`${origin}/dashboard?message=Email updated successfully`);
      }

      // Default redirect
      return NextResponse.redirect(`${origin}${next}`);
    } else {
      console.error("Code exchange failed:", error);

      // Handle expired or invalid codes
      if (
        error.message.includes("expired") ||
        error.message.includes("invalid") ||
        error.message.includes("already been used") ||
        error.code === "otp_expired"
      ) {
        if (type === "recovery") {
          console.log("Password reset code expired or invalid, redirecting to link-expired page");
          return NextResponse.redirect(`${origin}/link-expired?type=recovery`);
        } else {
          // For signup verification, redirect to link-expired so user can resend
          console.log("Email verification code expired or already used");
          return NextResponse.redirect(`${origin}/link-expired?type=signup`);
        }
      }

      return NextResponse.redirect(
        `${origin}/auth-error?error=verification_failed&description=${encodeURIComponent(error.message)}`
      );
    }
  }

  // Handle token_hash or token parameter
  if ((token_hash || token) && type) {
    const supabase = await createClient();

    // Use token_hash if available, otherwise use token as token_hash
    const verificationToken = token_hash || token;

    if (!verificationToken) {
      console.error("No verification token found");
      return NextResponse.redirect(
        `${origin}/auth-error?error=verification_failed&description=No verification token found`
      );
    }

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: verificationToken,
    });

    if (!error) {
      console.log("OTP verification successful");

      // Handle different verification types
      if (type === "signup" || type === "email") {
        // Ensure user records exist (fallback for trigger)
        try {
          await ensureUserRecords(supabase);
        } catch (userCreationError) {
          console.error("Error during user creation process:", userCreationError);
          // Continue to success redirect — verification was successful
        }

        // ALWAYS redirect to success after OTP verification succeeds
        console.log("Redirecting to email-verified page");
        return NextResponse.redirect(`${origin}/email-verified`);
      } else if (type === "recovery") {
        console.log("Password recovery, redirecting to:", next);
        return NextResponse.redirect(`${origin}${next}`);
      } else if (type === "email_change") {
        return NextResponse.redirect(`${origin}/dashboard?message=Email updated successfully`);
      }

      // Default redirect
      return NextResponse.redirect(`${origin}${next}`);
    } else {
      console.error("OTP verification failed:", error);

      // Handle expired or invalid links
      if (error.code === "otp_expired") {
        if (type === "recovery") {
          console.log("Password reset link expired, redirecting to link-expired page");
          return NextResponse.redirect(`${origin}/link-expired?type=recovery`);
        } else if (type === "signup" || type === "email") {
          // For signup verification, check if user was already verified
          // Note: We can't use getUser() here because there's no session yet
          // Instead, check if the email from the token is already verified in auth.users

          // Redirect to link-expired so user can resend verification
          console.log("Email verification link expired or already used");
          return NextResponse.redirect(`${origin}/link-expired?type=signup`);
        }
      }

      // For other errors, redirect to generic auth error page
      console.log("Other verification error, redirecting to auth-error page");
      return NextResponse.redirect(
        `${origin}/auth-error?error=verification_failed&description=${encodeURIComponent(error.message)}`
      );
    }
  } else {
    console.error("Missing token_hash/token or type");
  }

  // redirect the user to an error page with instructions
  console.log("Redirecting to auth error page");
  return NextResponse.redirect(
    `${origin}/auth-error?error=verification_failed&description=Missing verification parameters`
  );
}
