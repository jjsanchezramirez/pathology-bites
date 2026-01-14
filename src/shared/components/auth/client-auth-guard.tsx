// src/shared/components/auth/client-auth-guard.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/shared/hooks/use-auth";

interface ClientAuthGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Lightweight client-side auth guard for /dashboard routes
 * Uses sessionStorage cache to minimize API calls
 *
 * NOTE: This is NOT cryptographically secure - it's UX optimization only.
 * Server-side API routes still verify authentication.
 * Use middleware for sensitive routes like /admin.
 */
export function ClientAuthGuard({ children, redirectTo = "/login" }: ClientAuthGuardProps) {
  const { isAuthenticated, isLoading, isHydrated } = useAuth({ minimal: true });
  const router = useRouter();
  const [shouldRender, setShouldRender] = useState(false);
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    console.log("[ClientAuthGuard] [DIAGNOSTIC] Auth check:", {
      isHydrated,
      isLoading,
      isAuthenticated,
      hasChecked: hasCheckedRef.current,
      pathname: typeof window !== "undefined" ? window.location.pathname : "SSR",
      timestamp: new Date().toISOString(),
    });

    // Wait until fully hydrated and auth check complete
    if (!isHydrated || isLoading) {
      return;
    }

    // Wait one render cycle after isLoading becomes false
    // NOTE: This may be unnecessary since sessionStorage is read synchronously,
    // but keeping it as defensive programming to ensure auth state has fully settled
    if (!hasCheckedRef.current) {
      hasCheckedRef.current = true;
      console.log("[ClientAuthGuard] [DIAGNOSTIC] ⏳ Waiting one render cycle...");
      return;
    }

    if (!isAuthenticated) {
      // User not authenticated - redirect to login
      const currentPath = window.location.pathname;
      const redirectUrl = `${redirectTo}?redirect=${encodeURIComponent(currentPath)}`;
      console.log("[ClientAuthGuard] [DIAGNOSTIC] 🚨 REDIRECTING to login:", {
        from: currentPath,
        to: redirectUrl,
        reason: "Not authenticated",
      });
      router.replace(redirectUrl);
    } else {
      // User authenticated - safe to render
      console.log("[ClientAuthGuard] [DIAGNOSTIC] ✅ Authenticated, rendering page");
      setShouldRender(true);
    }
  }, [isAuthenticated, isLoading, isHydrated, redirectTo, router]);

  // Show loading state while checking auth
  if (!isHydrated || isLoading || !shouldRender) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Render children if authenticated
  return <>{children}</>;
}
