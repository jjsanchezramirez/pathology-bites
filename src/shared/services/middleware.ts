// lib/supabase/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { csrfProtection, createCSRFErrorResponse } from "@/features/auth/utils/csrf-protection";
import {
  adminAPIRateLimiter,
  generalAPIRateLimiter,
  quizAPIRateLimiter,
  getClientIP,
} from "@/shared/utils/api-rate-limiter";
import { devLog, generateRequestId } from "@/shared/utils/dev-logger";

// Cache for user role lookups to prevent race conditions
const roleCache = new Map<string, { role: string; timestamp: number }>();
const ROLE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const processingRequests = new Set<string>();

// Admin API endpoints that don't require authentication (health checks, etc.)
const PUBLIC_ADMIN_ENDPOINTS = ["/api/admin/system-status", "/api/admin/ai-generate-question"];

// Admin API endpoints that require admin-only access (not creator/reviewer)
const ADMIN_ONLY_ENDPOINTS = [
  "/api/admin/users",
  "/api/admin/notifications",
];

// DEPRECATED: API routes now validate auth internally to reduce edge requests
// This function is kept for reference but is no longer called by middleware
// Handle authentication for admin API routes
async function _handleAdminApiAuth(request: NextRequest) {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const clientIp = getClientIP(request);
  const {
    method,
    nextUrl: { pathname },
  } = request;

  // Log incoming request
  devLog.request({
    method,
    path: pathname,
    ip: clientIp,
    requestId,
  });

  // Allow public endpoints without auth
  if (PUBLIC_ADMIN_ENDPOINTS.some((endpoint) => pathname.startsWith(endpoint))) {
    devLog.debug("Public admin endpoint - skipping auth", { pathname });
    return NextResponse.next();
  }

  try {
    // Rate limiting check
    const rateLimitResult = adminAPIRateLimiter.checkLimit(clientIp, pathname);

    // Log rate limit status
    if (rateLimitResult.remaining < 10) {
      devLog.rateLimit(
        clientIp,
        pathname,
        rateLimitResult.remaining,
        new Date(rateLimitResult.resetTime)
      );
    }

    if (!rateLimitResult.allowed) {
      const duration = Date.now() - startTime;
      devLog.warn("Rate limit exceeded", { clientIp, pathname, requestId });
      devLog.response({
        method,
        path: pathname,
        status: 429,
        duration,
        requestId,
        error: "Rate limit exceeded",
      });

      return NextResponse.json(
        {
          error: "Too many requests, please try again later.",
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitResult.total.toString(),
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
            "Retry-After": Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // CSRF protection for state-changing requests
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
      devLog.debug("Checking CSRF protection", { method, pathname });
      const csrfValid = await csrfProtection(request);
      if (!csrfValid) {
        const duration = Date.now() - startTime;
        devLog.warn("CSRF validation failed", { method, pathname, requestId });
        devLog.response({
          method,
          path: pathname,
          status: 403,
          duration,
          requestId,
          error: "CSRF validation failed",
        });
        return createCSRFErrorResponse();
      }
    }

    // Set up Supabase client
    let response = NextResponse.next({ request });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      const duration = Date.now() - startTime;
      devLog.auth("auth_check", undefined, false);
      devLog.response({
        method,
        path: pathname,
        status: 401,
        duration,
        requestId,
        error: "Unauthorized",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    devLog.auth("auth_check", user.id, true);

    // Get user role with caching
    const userRole = await getUserRoleWithCache(user.id, user, supabase);
    devLog.debug("User role retrieved", { userId: user.id, userRole });

    // Check if endpoint requires admin-only access
    const requiresAdminOnly = ADMIN_ONLY_ENDPOINTS.some((endpoint) =>
      request.nextUrl.pathname.startsWith(endpoint)
    );

    if (requiresAdminOnly && userRole !== "admin") {
      const duration = Date.now() - startTime;
      devLog.warn("Admin-only access denied", { userId: user.id, userRole, pathname });
      devLog.response({
        method,
        path: pathname,
        status: 403,
        duration,
        userId: user.id,
        requestId,
        error: "Forbidden - Admin access required",
      });
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    // Check if user has any admin privileges (admin, creator, reviewer)
    if (!["admin", "creator", "reviewer"].includes(userRole)) {
      const duration = Date.now() - startTime;
      devLog.warn("Admin privileges required", { userId: user.id, userRole, pathname });
      devLog.response({
        method,
        path: pathname,
        status: 403,
        duration,
        userId: user.id,
        requestId,
        error: "Forbidden - Admin privileges required",
      });
      return NextResponse.json({ error: "Forbidden - Admin privileges required" }, { status: 403 });
    }

    // Add user info to headers for the endpoint to use
    response.headers.set("x-user-id", user.id);
    response.headers.set("x-user-role", userRole);
    response.headers.set("x-user-email", user.email || "");
    response.headers.set("x-request-id", requestId);

    // Add rate limit headers
    response.headers.set("X-RateLimit-Limit", rateLimitResult.total.toString());
    response.headers.set("X-RateLimit-Remaining", rateLimitResult.remaining.toString());
    response.headers.set("X-RateLimit-Reset", rateLimitResult.resetTime.toString());

    // Log successful response
    const duration = Date.now() - startTime;
    devLog.response({
      method,
      path: pathname,
      status: 200,
      duration,
      userId: user.id,
      requestId,
    });

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    devLog.error("Admin API auth error", error);
    devLog.response({
      method,
      path: pathname,
      status: 500,
      duration,
      requestId,
      error: error instanceof Error ? error.message : "Internal server error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DEPRECATED: API routes now validate auth internally to reduce edge requests
// This function is kept for reference but is no longer called by middleware
// Handle authentication for user and quiz API routes
async function _handleUserApiAuth(request: NextRequest) {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const clientIp = getClientIP(request);
  const {
    method,
    nextUrl: { pathname },
  } = request;

  // Log incoming request
  devLog.request({
    method,
    path: pathname,
    ip: clientIp,
    requestId,
  });

  try {
    // Determine which rate limiter to use based on path
    let rateLimitResult;
    if (pathname.startsWith("/api/quiz/")) {
      devLog.debug("Using quiz rate limiter", { pathname });
      rateLimitResult = quizAPIRateLimiter.checkLimit(clientIp, pathname);
    } else {
      devLog.debug("Using general rate limiter", { pathname });
      rateLimitResult = generalAPIRateLimiter.checkLimit(clientIp, pathname);
    }

    // Log rate limit status
    if (rateLimitResult.remaining < 10) {
      devLog.rateLimit(
        clientIp,
        pathname,
        rateLimitResult.remaining,
        new Date(rateLimitResult.resetTime)
      );
    }

    if (!rateLimitResult.allowed) {
      const duration = Date.now() - startTime;
      devLog.warn("Rate limit exceeded", { clientIp, pathname, requestId });
      devLog.response({
        method,
        path: pathname,
        status: 429,
        duration,
        requestId,
        error: "Rate limit exceeded",
      });

      return NextResponse.json(
        {
          error: "Too many requests, please try again later.",
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitResult.total.toString(),
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
            "Retry-After": Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // CSRF protection for state-changing requests
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
      devLog.debug("Checking CSRF protection", { method, pathname });
      const csrfValid = await csrfProtection(request);
      if (!csrfValid) {
        const duration = Date.now() - startTime;
        devLog.warn("CSRF validation failed", { method, pathname, requestId });
        devLog.response({
          method,
          path: pathname,
          status: 403,
          duration,
          requestId,
          error: "CSRF validation failed",
        });
        return createCSRFErrorResponse();
      }
    }

    // Set up Supabase client
    let response = NextResponse.next({ request });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      const duration = Date.now() - startTime;
      devLog.auth("auth_check", undefined, false);
      devLog.response({
        method,
        path: pathname,
        status: 401,
        duration,
        requestId,
        error: "Unauthorized",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    devLog.auth("auth_check", user.id, true);

    // Add user info to headers for the endpoint to use
    response.headers.set("x-user-id", user.id);
    response.headers.set("x-user-email", user.email || "");
    response.headers.set("x-request-id", requestId);

    // Add rate limit headers
    response.headers.set("X-RateLimit-Limit", rateLimitResult.total.toString());
    response.headers.set("X-RateLimit-Remaining", rateLimitResult.remaining.toString());
    response.headers.set("X-RateLimit-Reset", rateLimitResult.resetTime.toString());

    // Log successful response
    const duration = Date.now() - startTime;
    devLog.response({
      method,
      path: pathname,
      status: 200,
      duration,
      userId: user.id,
      requestId,
    });

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    devLog.error("User API auth error", error);
    devLog.response({
      method,
      path: pathname,
      status: 500,
      duration,
      requestId,
      error: error instanceof Error ? error.message : "Internal server error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function updateSession(request: NextRequest) {
  // API routes are no longer handled by middleware - they validate auth internally
  // This reduces edge requests by ~50-70% by eliminating redundant auth checks

  // At this point, we only get dashboard, admin, and login paths due to matcher
  // Feature flags removed - maintenance mode no longer blocks access

  try {
    // Simple redirect helper
    function redirect(pathname: string) {
      const url = request.nextUrl.clone();
      url.pathname = pathname;
      url.search = "";
      return NextResponse.redirect(url);
    }

    // Set up Supabase ONLY when absolutely needed
    let supabaseResponse = NextResponse.next({ request });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // Get user for protected routes
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Ultra-simple maintenance mode (since matcher is now minimal)
    if (!request.nextUrl.pathname.startsWith("/admin")) {
      // Allow access to all routes
    }

    // Redirect authenticated users away from login page
    if (user && request.nextUrl.pathname === "/login") {
      // Get user role to determine redirect destination
      const userRole = await getUserRoleWithCache(user.id, user, supabase);

      if (userRole === "admin" || userRole === "creator" || userRole === "reviewer") {
        return redirect("/admin/dashboard");
      } else {
        return redirect("/dashboard");
      }
    }

    // Ultra-simple auth check (matcher only includes dashboard/admin)
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    // Check user role for admin routes
    if (request.nextUrl.pathname.startsWith("/admin") && user) {
      const userRole = await getUserRoleWithCache(user.id, user, supabase);

      if (userRole !== "admin" && userRole !== "creator" && userRole !== "reviewer") {
        return redirect("/dashboard");
      }
    }

    // Redirect admin/creator/reviewer users from /dashboard to /admin/dashboard
    // BUT respect the admin-mode cookie if set to 'user'
    // Note: Admin users can still access admin routes directly even in user mode
    if (request.nextUrl.pathname === "/dashboard" && user) {
      try {
        // Check admin mode preference cookie
        const adminModeCookie = request.cookies.get("admin-mode")?.value;

        // If admin explicitly chose user mode, allow access to user dashboard
        if (adminModeCookie === "user") {
          // Allow admin to access user dashboard when in user mode
        } else {
          // Default behavior: redirect admin/creator/reviewer to admin dashboard

          // First try user metadata for speed
          const metadataRole = user.user_metadata?.role || user.app_metadata?.role;

          if (
            metadataRole === "admin" ||
            metadataRole === "creator" ||
            metadataRole === "reviewer"
          ) {
            return redirect("/admin/dashboard");
          }

          // Check database role
          const userRole = await getUserRoleWithCache(user.id, user, supabase);
          if (userRole === "admin" || userRole === "creator" || userRole === "reviewer") {
            return redirect("/admin/dashboard");
          }
        }
      } catch {
        // Silent error handling
      }
    }

    return supabaseResponse;
  } catch {
    // Silent error handling - just allow request to proceed
    return NextResponse.next();
  }
}

// Helper function to get user role with caching and race condition prevention
async function getUserRoleWithCache(
  userId: string,
  user: unknown,
  supabase: unknown
): Promise<string> {
  // Check if we're already processing this user's role
  if (processingRequests.has(userId)) {
    // Wait a bit and check cache again
    await new Promise((resolve) => setTimeout(resolve, 100));
    const cached = roleCache.get(userId);
    if (cached && Date.now() - cached.timestamp < ROLE_CACHE_TTL) {
      return cached.role;
    }
    // If still processing or cache expired, fall through to database query
  }

  // Check cache first
  const cached = roleCache.get(userId);
  if (cached && Date.now() - cached.timestamp < ROLE_CACHE_TTL) {
    return cached.role;
  }

  // Mark as processing to prevent race conditions
  processingRequests.add(userId);

  try {
    // First try to get role from user metadata (fastest)
    const metadataRole = user?.user_metadata?.role || user?.app_metadata?.role;
    if (metadataRole && ["admin", "creator", "reviewer", "user"].includes(metadataRole)) {
      // Cache the metadata role
      roleCache.set(userId, { role: metadataRole, timestamp: Date.now() });
      return metadataRole;
    }

    // Fallback to database query
    const { data, error } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .maybeSingle(); // Use maybeSingle to handle missing users gracefully

    if (error) {
      return "user"; // Default fallback
    }

    const dbRole = data?.role || "user";

    // Cache the database role
    roleCache.set(userId, { role: dbRole, timestamp: Date.now() });

    return dbRole;
  } catch {
    return "user"; // Default fallback
  } finally {
    // Remove from processing set
    processingRequests.delete(userId);
  }
}
