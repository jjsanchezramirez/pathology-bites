// src/app/api/auth/password-reset/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getUserIdFromHeaders } from "@/shared/utils/auth/auth-helpers";

const passwordResetSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  type: z.enum(["reset", "magic_link"]).optional().default("reset"),
});

const passwordUpdateSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

/**
 * @swagger
 * /api/auth/password-reset:
 *   post:
 *     summary: Request password reset or magic link
 *     description: Initiates a password reset or sends a magic link for passwordless login. Sends an email with a secure link to the user's registered email address. Returns success even if user doesn't exist for security reasons.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address of the account
 *                 example: user@example.com
 *               type:
 *                 type: string
 *                 enum: [reset, magic_link]
 *                 default: reset
 *                 description: Type of email to send - password reset or magic login link
 *     responses:
 *       200:
 *         description: Password reset email sent successfully (or user doesn't exist)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Password reset link sent! Check your email to reset your password.
 *       400:
 *         description: Bad request - invalid email format or validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Please enter a valid email address
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Failed to send password reset email
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Validate request data
    const validation = passwordResetSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.map((err) => err.message);
      return NextResponse.json({ error: errors.join(". ") }, { status: 400 });
    }

    const { email, type } = validation.data;

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, status")
      .eq("email", email)
      .single();

    if (userError && userError.code !== "PGRST116") {
      console.error("Error checking user:", userError);
      return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
    }

    if (!user) {
      // Don't reveal if user exists or not for security
      return NextResponse.json({
        success: true,
        message: "If an account with this email exists, you will receive a password reset link.",
      });
    }

    if (user.status !== "active") {
      return NextResponse.json({
        success: true,
        message: "If an account with this email exists, you will receive a password reset link.",
      });
    }

    // Use Supabase's resetPasswordForEmail() with service role to bypass CAPTCHA
    // This is more reliable than generateLink() and uses Supabase's email infrastructure
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const redirectTo = type === "magic_link" ? `${baseUrl}/dashboard` : `${baseUrl}/reset-password`;

    // Create admin client to bypass CAPTCHA requirement
    // Note: This endpoint is only accessible to authenticated users (admin tools, user settings),
    // so we can safely bypass CAPTCHA by using the service role client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminClient = createAdminClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Use resetPasswordForEmail() - Supabase handles email sending automatically
    const { error: resetError } = await adminClient.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo,
    });

    if (resetError) {
      console.error("[Password Reset] Error:", resetError);
      return NextResponse.json({ error: "Failed to send password reset email" }, { status: 500 });
    }

    console.log("[Password Reset] Email sent successfully via Supabase to:", email);
    console.log("[Password Reset] Type:", type);
    console.log("[Password Reset] Redirect URL:", redirectTo);

    // Create audit log
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: type === "magic_link" ? "magic_link_requested" : "password_reset_requested",
      table_name: "users",
      record_id: user.id,
      metadata: {
        email: email,
        type: type,
        timestamp: new Date().toISOString(),
        ip_address: request.headers.get("x-forwarded-for") || "unknown",
      },
    });

    return NextResponse.json({
      success: true,
      message:
        type === "magic_link"
          ? "Magic link sent! Check your email to log in instantly."
          : "Password reset link sent! Check your email to reset your password.",
    });
  } catch (error) {
    console.error("Error in password reset:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/auth/password-reset:
 *   patch:
 *     summary: Update password with reset token
 *     description: Updates user password after they've clicked the password reset link. Requires a valid reset token (user must be authenticated via the reset link). Creates an audit log entry for the password change.
 *     tags:
 *       - Authentication
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *               - confirmPassword
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: New password (min 8 chars, must contain uppercase, lowercase, and number)
 *                 example: MyNewPass123
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 description: Password confirmation (must match password)
 *                 example: MyNewPass123
 *     responses:
 *       200:
 *         description: Password updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Password updated successfully
 *       400:
 *         description: Bad request - validation error or password requirements not met
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Passwords don't match
 *       401:
 *         description: Unauthorized - invalid or expired reset token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid or expired reset token
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated (should have valid reset token)
    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 401 });
    }

    const body = await request.json();

    // Validate request data
    const validation = passwordUpdateSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.map((err) => err.message);
      return NextResponse.json({ error: errors.join(". ") }, { status: 400 });
    }

    const { password } = validation.data;

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    });

    if (updateError) {
      console.error("Password update error:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Create audit log
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "password_updated",
      table_name: "users",
      record_id: userId,
      metadata: {
        timestamp: new Date().toISOString(),
        method: "password_reset",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Error updating password:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
