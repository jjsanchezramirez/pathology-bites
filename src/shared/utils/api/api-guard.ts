// src/shared/utils/api/api-guard.ts
//
// Route-handler auth guards over the middleware-injected identity headers.
// Middleware (src/middleware.ts) validates the Supabase session and sets
// `x-user-id` / `x-user-role` / `x-user-permissions` on every request that
// reaches a private API route — these guards only read those headers, they
// never hit the DB.
//
// On failure the guard returns the 401/403 NextResponse itself; narrow with
// `instanceof` (this repo compiles with `strict: false`, where discriminated
// unions like `{ok: false}` don't narrow via `!auth.ok`):
//
//   const auth = requireAdmin(request);
//   if (auth instanceof NextResponse) return auth;
//   // auth.userId / auth.role / auth.permissions are ready to use

import { NextResponse } from "next/server";
import { type UserRole, isValidRole } from "@/shared/utils/auth/auth-helpers";
import {
  type Permission,
  hasPermission,
  isStaff,
  permissionsFromHeader,
} from "@/shared/utils/auth/permissions";

export interface AuthContext {
  userId: string;
  /** Validated role, or null when the header is missing/unrecognized. */
  role: UserRole | null;
  /** Granted permissions (admins implicitly hold all; use `can`). */
  permissions: Permission[];
  /** Whether this caller holds `permission` (true for admins). */
  can: (permission: Permission) => boolean;
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
  const role = rawRole && isValidRole(rawRole) ? rawRole : null;
  const permissions = permissionsFromHeader(request.headers.get("x-user-permissions"));
  return {
    userId,
    role,
    permissions,
    can: (permission: Permission) => hasPermission(role, permissions, permission),
  };
}

/** 401 when unauthenticated, 403 unless the caller is an admin. */
export function requireAdmin(request: Request): GuardResult {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }
  return auth;
}

/**
 * 401 when unauthenticated, 403 unless the caller holds at least one of the
 * given permissions (admins hold all of them).
 */
export function requirePermission(
  request: Request,
  ...permissions: [Permission, ...Permission[]]
): GuardResult {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;
  if (!permissions.some((p) => auth.can(p))) {
    return NextResponse.json(
      { error: `Forbidden - requires ${permissions.join(" or ")} permission` },
      { status: 403 }
    );
  }
  return auth;
}

/** 401 when unauthenticated, 403 unless the caller is an admin or holds any permission. */
export function requireStaff(request: Request): GuardResult {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;
  if (!isStaff(auth.role, auth.permissions)) {
    return NextResponse.json({ error: "Forbidden - staff access required" }, { status: 403 });
  }
  return auth;
}
