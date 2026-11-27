// src/shared/hooks/use-user-role.ts
"use client";

import { useAuthContext } from "@/features/auth/components/auth-provider";
import type { UserRole as AuthUserRole } from "@/shared/utils/auth/auth-helpers";
import { hasPermission, isStaff, type Permission } from "@/shared/utils/auth/permissions";

export type UserRole = AuthUserRole | null;

interface UserRoleData {
  role: UserRole;
  permissions: Permission[];
  isLoading: boolean;
  error: string | null;
  /** Whether the user may use a feature (see FEATURE_ACCESS). */
  canAccess: (feature: string) => boolean;
  /** Whether the user holds a permission (always true for admins). */
  can: (permission: Permission) => boolean;
  isAdmin: boolean;
  /** Admin, or holds at least one permission — may open the admin area. */
  isStaff: boolean;
}

/**
 * Feature → what grants it. "admin" means admins only; a permission means
 * admins plus anyone granted it; "staff" means admins plus anyone holding any
 * permission; "everyone" means any signed-in user.
 */
type Access = "admin" | "staff" | "everyone" | Permission;

const FEATURE_ACCESS: Record<string, Access> = {
  // Admin-only
  "users.manage": "admin",
  "users.view": "admin",
  "categories.manage": "admin",
  "tags.manage": "admin",
  "sets.manage": "admin",
  "images.manage": "admin",
  "lessons.manage": "admin", // Lesson Studio and Learning Modules
  "audio.manage": "admin",
  "inquiries.manage": "admin",
  "notifications.manage": "admin",
  "analytics.view": "admin",
  "settings.manage": "admin",
  "system.monitor": "admin",
  "questions.edit": "admin",
  "questions.delete": "admin",

  // Writing questions
  "questions.create": "create_questions",
  "questions.edit.own": "create_questions",
  "questions.submit": "create_questions",

  // Reviewing questions
  "questions.review": "review_questions",
  "questions.approve": "review_questions",
  "questions.reject": "review_questions",

  // Shared
  "questions.update": "staff", // API-level checks decide the specific edit
  "questions.view": "staff",
  "dashboard.view": "staff",
  "questions.flag": "everyone",
};

export function useUserRole(): UserRoleData {
  const { role: authRole, permissions, isLoading } = useAuthContext();
  const role = (authRole ?? null) as UserRole;

  const can = (permission: Permission) => hasPermission(role, permissions, permission);
  const staff = isStaff(role, permissions);

  const canAccess = (feature: string): boolean => {
    if (!role) return false;
    const access = FEATURE_ACCESS[feature];
    switch (access) {
      case undefined:
        return false;
      case "admin":
        return role === "admin";
      case "staff":
        return staff;
      case "everyone":
        return true;
      default:
        return can(access);
    }
  };

  return {
    role,
    permissions,
    isLoading,
    error: null,
    canAccess,
    can,
    isAdmin: role === "admin",
    isStaff: staff,
  };
}
