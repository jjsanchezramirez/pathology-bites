// src/features/auth/components/forms/login-form.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/shared/utils/toast";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { FormField } from "@/features/auth/components/ui/form-field";
import { FormButton } from "@/features/auth/components/ui/form-button";
import { GoogleSignInButton } from "@/features/auth/components/google-sign-in-button";
import { AuthDivider } from "@/features/auth/components/ui/auth-divider";
import { useCSRFToken } from "@/features/auth/hooks/use-csrf-token";
import { useTurnstile } from "@/features/auth/hooks/use-turnstile";

// Form schema definition
const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

// Define type for form data
type LoginFormData = z.infer<typeof formSchema>;

interface LoginFormProps {
  action: (formData: FormData) => Promise<void>;
  redirect?: string;
  initialError?: string;
  initialMessage?: string;
  isAdminOnlyMode?: boolean;
}

export function LoginForm({
  action,
  redirect,
  initialError,
  initialMessage,
  isAdminOnlyMode = false,
}: LoginFormProps) {
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const { getToken, addTokenToFormData } = useCSRFToken();
  const { captchaToken, setCaptchaToken } = useTurnstile();
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY;
  const router = useRouter();

  // Note: Removed automatic redirect for authenticated users to prevent race condition.
  // The server action handles the redirect after successful login.

  // Show error/message toasts from props (passed from server component)
  useEffect(() => {
    console.log(
      "[LoginForm] useEffect triggered - initialError:",
      initialError,
      "initialMessage:",
      initialMessage
    );

    if (initialError) {
      // Use a unique ID based on the error message to prevent deduplication issues
      const errorId = `login-error-${Date.now()}`;
      console.log("[LoginForm] Showing error toast with ID:", errorId, "Message:", initialError);

      const toastResult = toast.error(initialError, { id: errorId, duration: 8000 });
      console.log("[LoginForm] Toast result:", toastResult);

      // Track failed attempts for rate limit warning
      if (
        initialError.includes("Invalid email or password") ||
        initialError.includes("login credentials")
      ) {
        setFailedAttempts((prev) => prev + 1);
      }

      // Reset CAPTCHA when there's an error
      turnstileRef.current?.reset();
      setCaptchaToken(null);

      // Clear the error from URL to prevent re-showing on refresh
      // Use replace to avoid adding to history
      router.replace("/login", { scroll: false });
    }
    if (initialMessage) {
      const messageId = `login-message-${Date.now()}`;
      console.log("[LoginForm] Showing info toast with ID:", messageId, "Message:", initialMessage);

      const toastResult = toast.info(initialMessage, { id: messageId, duration: 8000 });
      console.log("[LoginForm] Toast result:", toastResult);

      // Clear the message from URL
      router.replace("/login", { scroll: false });
    }
  }, [initialError, initialMessage, setCaptchaToken, router]);

  // Initialize form with useForm hook
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitted },
  } = useForm<LoginFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Form submission handler
  async function onSubmit(values: LoginFormData) {
    try {
      setLoading(true);

      // Create FormData object for server action
      const formData = new FormData();
      formData.append("email", values.email);
      formData.append("password", values.password);
      if (redirect) {
        formData.append("redirect", redirect);
      }

      // Add CAPTCHA token if available
      if (captchaToken) {
        formData.append("captchaToken", captchaToken);
      }

      // Add CSRF token
      const csrfToken = await getToken();
      addTokenToFormData(formData, csrfToken);

      // Call the server action
      await action(formData);
    } catch (error) {
      // Don't catch NEXT_REDIRECT errors - they're used for navigation and should propagate
      if (error instanceof Error && error.message === "NEXT_REDIRECT") {
        throw error;
      }

      console.error("Login error:", error);
      toast.error("An unexpected error occurred. Please try again.");
      // Reset CAPTCHA on error
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <GoogleSignInButton />

      <AuthDivider text="Or continue with" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField
          id="email"
          label="Email"
          type="email"
          placeholder="name@example.com"
          autoComplete="email"
          error={isSubmitted ? errors.email?.message : undefined}
          disabled={loading}
          {...register("email")}
        />

        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          error={isSubmitted ? errors.password?.message : undefined}
          disabled={loading}
          rightElement={
            <Link
              href="/forgot-password"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              Forgot?
            </Link>
          }
          {...register("password")}
        />

        {/* Rate limit warning */}
        {failedAttempts >= 5 && failedAttempts < 10 && (
          <div className="rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/50 p-3">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Warning:</strong> {10 - failedAttempts} login attempt
              {10 - failedAttempts !== 1 ? "s" : ""} remaining before temporary lockout.
            </p>
          </div>
        )}

        {siteKey && (
          <div className="flex justify-center">
            <Turnstile
              ref={turnstileRef}
              siteKey={siteKey}
              options={{
                theme: "auto",
                size: "normal",
                retry: "auto",
                "retry-interval": 8000,
              }}
              onSuccess={(token) => {
                setCaptchaToken(token);
                console.log("[LoginForm] CAPTCHA verification successful");
              }}
              onError={(error) => {
                setCaptchaToken(null);
                console.log("[LoginForm] CAPTCHA verification error:", error);
                // Don't show toast on error - Turnstile will auto-retry
                // The widget reloads automatically, so no need to alarm the user
              }}
              onExpire={() => {
                setCaptchaToken(null);
                console.log("[LoginForm] CAPTCHA verification expired");
                // Don't show toast on expire - it will auto-reload
              }}
            />
          </div>
        )}

        <FormButton type="submit" fullWidth disabled={loading || (siteKey && !captchaToken)}>
          {loading ? "Signing in..." : "Login"}
        </FormButton>
      </form>

      {!isAdminOnlyMode && (
        <div className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link
            href="/signup"
            className="text-foreground underline underline-offset-4 hover:text-primary"
          >
            Sign up
          </Link>
        </div>
      )}
    </div>
  );
}
