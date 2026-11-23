// src/shared/utils/auth/permissions.ts
//
// Two roles (user, admin) plus grantable permissions. public.users.permissions
// holds the grants; a DB trigger (internal.sync_user_role_to_app_metadata)
// mirrors it into app_metadata.permissions, which is the only copy the server
// trusts. Admins implicitly hold every permission. The SQL twin of hasPermission
// is internal.has_permission(), which RLS policies use.

export const PERMISSIONS = ["create_questions", "review_questions"] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, { label: string; description: string }> = {
  create_questions: {
    label: "Create questions",
    description: "Write questions, edit their own drafts and submit them for review.",
  },
  review_questions: {
    label: "Review questions",
    description: "Appear in the reviewer list; approve or reject questions assigned to them.",
  },
};

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && (PERMISSIONS as readonly string[]).includes(value);
}

/** Known permissions from an untrusted array (app_metadata, a header, a request body). */
export function parsePermissions(raw: unknown): Permission[] {
  if (!Array.isArray(raw)) return [];
  return PERMISSIONS.filter((p) => raw.includes(p));
}

/** Header form used between middleware and route handlers. */
export function permissionsFromHeader(value: string | null): Permission[] {
  return value ? parsePermissions(value.split(",")) : [];
}

export function hasPermission(
  role: string | null | undefined,
  permissions: readonly Permission[] | null | undefined,
  permission: Permission
): boolean {
  return role === "admin" || (permissions ?? []).includes(permission);
}

/** May open the admin area at all: an admin, or anyone holding a permission. */
export function isStaff(
  role: string | null | undefined,
  permissions: readonly Permission[] | null | undefined
): boolean {
  return role === "admin" || (permissions ?? []).length > 0;
}
