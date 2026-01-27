// src/shared/utils/route-helpers.ts
/**
 * Shared routing utilities to prevent code duplication
 */

/**
 * Check if a route is public (doesn't require authentication)
 */
export function isPublicRoute(pathname: string): boolean {
  const publicPatterns = [
    "/",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/check-email",
    "/auth-error",
    "/email-verified",
    "/email-already-verified",
    "/link-expired",
    "/password-reset-success",
    "/about",
    "/faq",
    "/contact",
    "/privacy",
    "/terms",
    "/maintenance",
  ];

  // Exact matches
  if (publicPatterns.includes(pathname)) {
    return true;
  }

  // Pattern matches
  if (pathname.startsWith("/tools/") || pathname.startsWith("/test/")) {
    return true;
  }

  return false;
}

/**
 * Check if a route requires admin/creator/reviewer access
 */
export function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
}

/**
 * Check if an API route requires admin/creator/reviewer access
 */
export function isProtectedApiRoute(pathname: string): boolean {
  const protectedPatterns = [
    "/api/admin",
    "/api/questions",
    "/api/content/questions",
    "/api/media",
    "/api/user",
  ];

  return protectedPatterns.some((pattern) => pathname.startsWith(pattern));
}

/**
 * Check if an API route is public (no auth required)
 */
export function isPublicApiRoute(pathname: string): boolean {
  const publicPatterns = ["/api/public/"];

  return publicPatterns.some((pattern) => pathname.startsWith(pattern));
}
