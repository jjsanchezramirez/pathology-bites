// src/lib/auth/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/shared/services/server";
import { headers } from "next/headers";
import { loginRateLimiter } from "@/features/auth/utils/rate-limiter";

export async function login(formData: FormData) {
  const supabase = await createClient();

  // Get client IP for rate limiting
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");
  const realIP = headersList.get("x-real-ip");
  const clientIP = forwarded?.split(",")[0] || realIP || "unknown";

  // Check rate limiting
  const rateLimitResult = loginRateLimiter.checkLimit(clientIP, "login");
  const currentAttempts = loginRateLimiter.getAttempts(clientIP, "login");

  console.log(`Login attempt from IP ${clientIP}: ${currentAttempts}/10 attempts`);

  if (!rateLimitResult.allowed) {
    const retryAfterMinutes = Math.ceil((rateLimitResult.retryAfter || 0) / (1000 * 60));
    console.log(
      `Rate limit exceeded for IP ${clientIP}. Retry after: ${retryAfterMinutes} minutes`
    );
    redirect(
      "/login?error=" +
        encodeURIComponent(
          `Too many login attempts. Please try again in ${retryAfterMinutes} minute${retryAfterMinutes > 1 ? "s" : ""}.`
        )
    );
    return;
  }

  // Validate CSRF token
  const csrfToken = formData.get("csrf-token") as string;
  if (!csrfToken) {
    redirect("/login?error=" + encodeURIComponent("Security validation failed. Please try again."));
    return;
  }

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const captchaToken = formData.get("captchaToken") as string | null;

  const redirectPath = formData.get("redirect") as string;

  // Prepare sign-in data with optional CAPTCHA token
  const signInData: {
    email: string;
    password: string;
    options?: { captchaToken: string };
  } = {
    email,
    password,
  };

  // Add CAPTCHA token if provided
  if (captchaToken) {
    signInData.options = { captchaToken };
  }

  const { error, data: authData } = await supabase.auth.signInWithPassword(signInData);

  if (error) {
    console.error("[Auth] Login error:", error);
    const redirectParam = redirectPath ? `&redirect=${encodeURIComponent(redirectPath)}` : "";

    if (error.message === "Invalid login credentials") {
      console.log("[Auth] Invalid credentials, redirecting to login");
      redirect(`/login?error=${encodeURIComponent("Invalid email or password")}${redirectParam}`);
      return;
    }
    if (error.message === "Email not confirmed") {
      console.log("[Auth] Email not confirmed, redirecting to verify-email");
      redirect("/verify-email?email=" + encodeURIComponent(email));
      return;
    }
    // Handle CAPTCHA errors specifically with user-friendly messages
    if (error.message?.includes("captcha") || error.code === "captcha_failed") {
      console.log("[Auth] CAPTCHA verification failed:", error.message);

      let userMessage = "Security verification failed. Please try again.";

      // Provide specific guidance based on the error
      if (error.message?.includes("timeout-or-duplicate")) {
        userMessage = "Security verification expired. Please wait a few seconds and try again.";
      } else if (error.message?.includes("invalid-input-response")) {
        userMessage = "Security verification failed. Please refresh the page and try again.";
      } else if (error.message?.includes("missing-input-response")) {
        userMessage = "Please complete the security verification before logging in.";
      }

      redirect(`/login?error=${encodeURIComponent(userMessage)}${redirectParam}`);
      return;
    }
    console.log("[Auth] Other login error, redirecting to login with error");
    redirect(`/login?error=${encodeURIComponent(error.message)}${redirectParam}`);
    return;
  }

  console.log("[Auth] Login successful for user:", authData.user.id);

  // Reset rate limit on successful login
  loginRateLimiter.reset(clientIP, "login");
  console.log(`[Auth] Rate limit reset for IP ${clientIP} after successful login`);

  revalidatePath("/", "layout");

  // Use redirect path if provided
  if (redirectPath) {
    console.log("[Auth] Redirecting to provided path:", redirectPath);
    redirect(redirectPath);
  }

  // Get role from JWT first (fastest), fallback to database
  let userRole = authData.user.app_metadata?.role || authData.user.user_metadata?.role || "user";

  // If role not in JWT, fetch from database and update JWT
  if (!authData.user.app_metadata?.role) {
    try {
      const { data: userData, error: roleError } = await supabase
        .from("users")
        .select("role")
        .eq("id", authData.user.id)
        .maybeSingle();

      console.log("[Auth] User role data:", userData);

      if (roleError) {
        console.error("[Auth] Role check error:", roleError);
      } else if (userData) {
        userRole = userData.role || "user";

        // Store role in app_metadata (requires admin API)
        // For now, store in user_metadata which is accessible from JWT
        try {
          await supabase.auth.updateUser({
            data: { role: userRole },
          });
          console.log("[Auth] Updated user_metadata with role:", userRole);
        } catch (metadataError) {
          console.error("[Auth] Failed to update user_metadata:", metadataError);
          // Non-critical error, continue with login
        }
      }
    } catch (error) {
      console.error("[Auth] Database error during role check:", error);
    }
  } else {
    console.log("[Auth] Role retrieved from JWT:", userRole);
  }

  // Redirect based on role
  if (userRole === "admin" || userRole === "creator" || userRole === "reviewer") {
    console.log("[Auth] Redirecting to admin dashboard for role:", userRole);
    redirect("/admin/dashboard");
  } else {
    console.log("[Auth] Redirecting to user dashboard for role:", userRole);
    redirect("/dashboard");
  }
}
