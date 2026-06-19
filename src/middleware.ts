// middleware.ts
// Runs on every route except static assets (see `config.matcher`). Gates dashboard, admin, and
// private API routes against the Supabase session, and injects `x-user-id` / `x-user-role`
// headers on authenticated API requests for downstream handlers.

import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function redirectToLogin(request: NextRequest, pathname: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("redirect", pathname);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Maintenance mode: redirect everything except the maintenance page + essential APIs.
  if (process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true") {
    const allowed =
      pathname === "/maintenance" ||
      pathname.startsWith("/api/public/maintenance") ||
      pathname.startsWith("/api/auth/");
    return allowed
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/maintenance", request.url));
  }

  const isAdminRoute = pathname.startsWith("/admin");
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isApiRoute = pathname.startsWith("/api/");
  const isPublicApi =
    pathname.startsWith("/api/public/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/content/") ||
    // Dev-only debug API (gitignored, never ships to prod) — used by /debug tools.
    (process.env.NODE_ENV !== "production" && pathname.startsWith("/api/debug/"));

  // Public pages that never need auth.
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

  if (isPublicRoute || (isApiRoute && isPublicApi)) {
    return NextResponse.next();
  }

  const needsAuth = isDashboardRoute || isAdminRoute || (isApiRoute && !isPublicApi);
  if (!needsAuth) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Dashboard: just needs a session.
  if (isDashboardRoute && !user) {
    return redirectToLogin(request, pathname);
  }

  // Admin: session + a privileged role.
  if (isAdminRoute) {
    if (!user) {
      return redirectToLogin(request, pathname);
    }
    const role = user.app_metadata?.role || user.user_metadata?.role;
    const isAuthorized = role === "admin" || role === "creator" || role === "reviewer";
    if (!isAuthorized) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // Private API: 401 if unauthenticated, otherwise forward identity to the handler via headers.
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
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next's static assets, the favicon, and image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
