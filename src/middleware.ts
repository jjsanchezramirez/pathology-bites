// middleware.ts
// Runs on every route except static assets (see `config.matcher`). Gates dashboard, admin, and
// private API routes against the Supabase session, and injects `x-user-id` / `x-user-role`
// / `x-user-permissions` headers on authenticated API requests for downstream handlers.
// Client-supplied copies of those headers are stripped on every path, and role and permissions
// come only from app_metadata (see trustedRole / trustedPermissions).
// Identity comes from the cookie session, or from an `Authorization: Bearer <access-token>`
// header (native clients like the iOS app, which have no cookies).

import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isStaff, parsePermissions, type Permission } from "@/shared/utils/auth/permissions";

function redirectToLogin(request: NextRequest, pathname: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("redirect", pathname);
  return NextResponse.redirect(url);
}

/**
 * Dev-only stand-in identity for the /debug tools.
 *
 * The debug pages themselves need no auth, but several of them drive real
 * product routes (`/api/admin/lesson-studio/*`, `/api/user/wsi-questions/*`)
 * which 401 without a session — so the tool is unusable unless you happen to be
 * logged in. This supplies an identity for ANONYMOUS requests only: a real
 * session always wins, so role-gated behaviour stays testable locally.
 *
 * Hard-gated on NODE_ENV !== "production" AND on the id being configured, so it
 * cannot activate on Vercel even if the env vars leak into a deployment.
 * Configure in .env.local (see .env.example) — the id is deliberately NOT
 * committed, since this repository is public.
 */
function devFallbackIdentity(): { id: string; role: string } | null {
  if (process.env.NODE_ENV === "production") return null;
  const id = process.env.DEBUG_USER_ID;
  if (!id) return null;
  return { id, role: process.env.DEBUG_USER_ROLE || "admin" };
}

const ROLES = ["admin", "user"] as const;
/**
 * /admin pages only admins may open (each path covers its subpages); other staff (users
 * holding a permission) are sent to the admin dashboard. Keep in step with the adminOnly
 * items in shared/config/navigation.ts. Staff keep /admin, /admin/questions (+ create/edit),
 * /admin/my-questions, /admin/review-queue; PAGE_PERMISSIONS narrows the last few.
 */
const ADMIN_ONLY_PAGES = [
  "/admin/media",
  "/admin/users",
  "/admin/settings",
  "/admin/analytics",
  "/admin/lesson-studio",
  "/admin/learn",
  "/admin/questions/metadata",
  "/admin/api-test",
];

/** /admin pages that need one specific permission (admins hold every permission). */
const PAGE_PERMISSIONS: { path: string; permission: Permission }[] = [
  { path: "/admin/questions/create", permission: "create_questions" },
  { path: "/admin/my-questions", permission: "create_questions" },
  { path: "/admin/review-queue", permission: "review_questions" },
];

/**
 * The only role the server trusts: `app_metadata.role`, which users cannot edit.
 * A database trigger (internal.sync_user_role_to_app_metadata) mirrors
 * public.users.role into it. Never read `user_metadata.role` for authorization —
 * any signed-in user can rewrite their own user_metadata.
 */
function trustedRole(user: { app_metadata?: object } | null): string | null {
  const role = (user?.app_metadata as { role?: unknown } | undefined)?.role;
  return typeof role === "string" && (ROLES as readonly string[]).includes(role) ? role : null;
}

/** Grantable permissions, from app_metadata only (mirrored from public.users.permissions). */
function trustedPermissions(user: { app_metadata?: object } | null): Permission[] {
  return parsePermissions(
    (user?.app_metadata as { permissions?: unknown } | undefined)?.permissions
  );
}

/**
 * Request headers with any client-supplied identity removed. Route handlers trust
 * `x-user-id` / `x-user-role` / `x-user-permissions`, so only this middleware may
 * set them — on every path, public ones included.
 */
function withoutIdentityHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  headers.delete("x-user-id");
  headers.delete("x-user-role");
  headers.delete("x-user-permissions");
  return headers;
}

function passThrough(request: NextRequest) {
  return NextResponse.next({ request: { headers: withoutIdentityHeaders(request) } });
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Maintenance mode: redirect everything except the maintenance page + essential APIs.
  if (process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true") {
    const allowed = pathname === "/maintenance" || pathname.startsWith("/api/auth/");
    return allowed
      ? passThrough(request)
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
    return passThrough(request);
  }

  const needsAuth = isDashboardRoute || isAdminRoute || (isApiRoute && !isPublicApi);
  if (!needsAuth) {
    return passThrough(request);
  }

  let response = passThrough(request);

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
          response = passThrough(request);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Identity: a Bearer token (native clients — the iOS app authenticates with
  // Supabase directly and has no cookies) takes precedence; otherwise the
  // cookie session as before. getUser() with an invalid token returns a null
  // user rather than throwing.
  const bearerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const {
    data: { user },
  } = bearerToken ? await supabase.auth.getUser(bearerToken) : await supabase.auth.getUser();

  // Dashboard: just needs a session.
  if (isDashboardRoute && !user) {
    return redirectToLogin(request, pathname);
  }

  // Admin: session + admin role or at least one permission.
  if (isAdminRoute) {
    if (!user) {
      return redirectToLogin(request, pathname);
    }
    const role = trustedRole(user);
    const permissions = trustedPermissions(user);
    if (!isStaff(role, permissions)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    if (role !== "admin") {
      const under = (p: string) => pathname === p || pathname.startsWith(p + "/");
      const adminOnly = ADMIN_ONLY_PAGES.some(under);
      const missing = PAGE_PERMISSIONS.some(
        ({ path, permission }) => under(path) && !permissions.includes(permission)
      );
      if (adminOnly || missing) {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
    }
  }

  // Private API: 401 if unauthenticated, otherwise forward identity to the handler via headers.
  if (isApiRoute && !isPublicApi) {
    const fallback = user ? null : devFallbackIdentity();
    if (!user && !fallback) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user?.id ?? fallback!.id;
    const role = user ? trustedRole(user) : fallback!.role;
    const permissions = user ? trustedPermissions(user) : [];
    // Admin APIs: staff only here too; each handler then checks the specific permission.
    if (pathname.startsWith("/api/admin/") && !isStaff(role, permissions)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const requestHeaders = withoutIdentityHeaders(request);
    requestHeaders.set("x-user-id", userId);
    if (role) {
      requestHeaders.set("x-user-role", role);
    }
    if (permissions.length > 0) {
      requestHeaders.set("x-user-permissions", permissions.join(","));
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
