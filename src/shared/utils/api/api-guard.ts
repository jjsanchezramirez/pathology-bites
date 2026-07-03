// src/shared/utils/api/api-guard.ts
//
// Route-handler auth guards over the middleware-injected identity headers.
// Middleware (src/middleware.ts) validates the Supabase session and sets
// `x-user-id` / `x-user-role` on every request that reaches a private API
// route — these guards only read those headers, they never hit the DB.
//
// On failure the guard returns the 401/403 NextResponse itself; narrow with
// `instanceof` (this repo compiles with `strict: false`, where discriminated
// unions like `{ok: false}` don't narrow via `!auth.ok`):
//
//   const auth = requireAdmin(request);
//   if (auth instanceof NextResponse) return auth;
//   // auth.userId / auth.role are ready to use

import { NextResponse } from "next/server";
import { type UserRole, isValidRole } from "@/shared/utils/auth/auth-helpers";

export interface AuthContext {
  userId: string;
  /** Validated role, or null when the header is missing/unrecognized. */
  role: UserRole | null;
}

export type GuardResult = AuthContext | NextResponse;

/**
 * Require an authenticated user (any role). 401 when the middleware didn't
 * inject an identity.
 */
export function requireUser(request: Request): GuardResult {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawRole = request.headers.get("x-user-role");
  return {
    userId,
    role: rawRole && isValidRole(rawRole) ? rawRole : null,
  };
}

/**
 * Require an authenticated user with one of the given roles.
 * 401 when unauthenticated, 403 when authenticated but the role doesn't match
 * (same semantics the admin routes hand-rolled before this helper existed).
 */
export function requireRole(request: Request, roles: UserRole[]): GuardResult {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  if (!auth.role || !roles.includes(auth.role)) {
    const label = roles.map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(" or ");
    return NextResponse.json({ error: `Forbidden - ${label} access required` }, { status: 403 });
  }

  return auth;
}

export function requireAdmin(request: Request): GuardResult {
  return requireRole(request, ["admin"]);
}

export function requireContentRole(request: Request): GuardResult {
  return requireRole(request, ["admin", "creator", "reviewer"]);
}
