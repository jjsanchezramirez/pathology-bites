// middleware.ts
// OPTIMIZED: Only runs on admin routes and protected API routes
// Client-side handles /dashboard auth to save edge function invocations

import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Check if maintenance mode is enabled
  const isMaintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true";

  // Maintenance mode: redirect all routes except maintenance page and essential APIs
  if (isMaintenanceMode) {
    const isMaintenancePage = pathname === "/maintenance";
    const isMaintenanceApi = pathname.startsWith("/api/public/maintenance");
    const isAuthApi = pathname.startsWith("/api/auth/");

    // Allow access to maintenance page, maintenance API, and auth APIs
    if (!isMaintenancePage && !isMaintenanceApi && !isAuthApi) {
      return NextResponse.redirect(new URL("/maintenance", request.url));
    }

    // If on maintenance page or allowed API, continue
    return NextResponse.next();
  }

  // Define which routes need protection
  const isAdminRoute = pathname.startsWith("/admin");
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isDocsRoute = pathname.startsWith("/docs");
  const isApiRoute = pathname.startsWith("/api/");
  const isPublicApi =
    pathname.startsWith("/api/public/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/content/");

  // Public routes that don't need auth
  const publicRoutes = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/",
  ];
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  // Skip middleware for public routes and public APIs
  if (isPublicRoute || (isApiRoute && isPublicApi)) {
    return NextResponse.next();
  }

  // Protect dashboard, admin, docs, and private API routes
  const needsAuth = isDashboardRoute || isAdminRoute || isDocsRoute || (isApiRoute && !isPublicApi);

  if (!needsAuth) {
    return NextResponse.next();
  }

  // Create response
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create Supabase client
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
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Get user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // DASHBOARD ROUTES: Basic authentication required
  if (isDashboardRoute) {
    if (!user) {
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // DOCS ROUTE: Basic authentication required
  if (isDocsRoute) {
    if (!user) {
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // ADMIN ROUTES: Strict server-side authorization (authentication + role check)
  if (isAdminRoute) {
    if (!user) {
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    const role = user.app_metadata?.role || user.user_metadata?.role;
    const isAuthorized = role === "admin" || role === "creator" || role === "reviewer";

    if (!isAuthorized) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // API ROUTES: Add user ID and role to headers if authenticated
  if (isApiRoute && !isPublicApi) {
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = user.app_metadata?.role || user.user_metadata?.role;

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", user.id);
    if (role) {
      requestHeaders.set("x-user-role", role);
    }

    response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
