// src/lib/auth/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/shared/services/server";
import { headers } from "next/headers";
import { loginRateLimiter } from "@/features/auth/utils/rate-limiter";
import { getSafeRedirectPath } from "@/shared/utils/route-helpers";
import { log } from "@/shared/utils/logging";

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

  log.debug(`Login attempt from IP ${clientIP}: ${currentAttempts}/10 attempts`);

  if (!rateLimitResult.allowed) {
    const retryAfterMinutes = Math.ceil((rateLimitResult.retryAfter || 0) / (1000 * 60));
    log.debug(`Rate limit exceeded for IP ${clientIP}. Retry after: ${retryAfterMinutes} minutes`);
    redirect(
      "/login?error=" +
        encodeURIComponent(
          `Too many login attempts. Please try again in ${retryAfterMinutes} minute${retryAfterMinutes > 1 ? "s" : ""}.`
        )
    );
    return;
  }

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const captchaToken = formData.get("captchaToken") as string | null;

  // Sanitize the caller-supplied post-login redirect. `redirect()` does not
  // normalize a protocol-relative value, so a raw `//evil.com` would send the
  // user off-origin after a successful login. Only same-origin paths survive;
  // anything unsafe becomes null and falls through to the role-based default.
  const rawRedirect = formData.get("redirect") as string | null;
  const redirectPath = rawRedirect ? getSafeRedirectPath(rawRedirect, "") || null : null;

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
    log.error("[Auth] Login error:", error);
    const redirectParam = redirectPath ? `&redirect=${encodeURIComponent(redirectPath)}` : "";

    if (error.message === "Invalid login credentials") {
      log.debug("[Auth] Invalid credentials, redirecting to login");
      redirect(`/login?error=${encodeURIComponent("Invalid email or password")}${redirectParam}`);
      return;
    }
    if (error.message === "Email not confirmed") {
      log.debug("[Auth] Email not confirmed, redirecting to verify-email");
      redirect("/verify-email?email=" + encodeURIComponent(email));
      return;
    }
    // Handle CAPTCHA errors specifically with user-friendly messages
    if (error.message?.includes("captcha") || error.code === "captcha_failed") {
      log.debug("[Auth] CAPTCHA verification failed:", error.message);

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
    log.debug("[Auth] Other login error, redirecting to login with error");
    redirect(`/login?error=${encodeURIComponent(error.message)}${redirectParam}`);
    return;
  }

  log.debug("[Auth] Login successful for user:", authData.user.id);

  // Reset rate limit on successful login
  loginRateLimiter.reset(clientIP, "login");
  log.debug(`[Auth] Rate limit reset for IP ${clientIP} after successful login`);

  revalidatePath("/", "layout");

  // Use redirect path if provided
  if (redirectPath) {
    log.debug("[Auth] Redirecting to provided path:", redirectPath);
    redirect(redirectPath);
  }

  // Role comes from app_metadata (server-written; a DB trigger mirrors public.users.role
  // into it), falling back to public.users. Never from user_metadata, which users can edit,
  // and never written back there. This only picks the landing page; middleware enforces access.
  let userRole = authData.user.app_metadata?.role || "user";

  if (!authData.user.app_metadata?.role) {
    try {
      const { data: userData, error: roleError } = await supabase
        .from("users")
        .select("role")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (roleError) {
        log.error("[Auth] Role check error:", roleError);
      } else if (userData) {
        userRole = userData.role || "user";
      }
    } catch (error) {
      log.error("[Auth] Database error during role check:", error);
    }
  }

  // Redirect based on role
  if (userRole === "admin" || userRole === "creator" || userRole === "reviewer") {
    log.debug("[Auth] Redirecting to admin dashboard for role:", userRole);
    redirect("/admin");
  } else {
    log.debug("[Auth] Redirecting to user dashboard for role:", userRole);
    redirect("/dashboard");
  }
}
