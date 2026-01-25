// src/shared/hooks/use-user-role.ts
"use client";

import { useState, useEffect, useRef } from "react";
import { useAuthContext } from "@/features/auth/components/auth-provider";

import { UserRole as DatabaseUserRole } from "@/shared/constants/database-types";

export type UserRole = DatabaseUserRole | null;

interface UserRoleData {
  role: UserRole;
  isLoading: boolean;
  error: string | null;
  canAccess: (feature: string) => boolean;
  isAdmin: boolean;
  isCreator: boolean;
  isReviewer: boolean;
  isAdminOrReviewer: boolean;
  isCreatorOrAbove: boolean;
}

// Define feature permissions based on 4-role system
const FEATURE_PERMISSIONS: Record<string, UserRole[]> = {
  // Admin-only permissions
  "users.manage": ["admin"],
  "users.view": ["admin"],
  "categories.manage": ["admin"],
  "tags.manage": ["admin"],
  "sets.manage": ["admin"],
  "images.manage": ["admin"],
  "inquiries.manage": ["admin"],
  "analytics.view": ["admin"],
  "settings.manage": ["admin"],
  "system.monitor": ["admin"],

  // Creator permissions - can create and manage content
  "questions.create": ["admin", "creator"],
  "questions.edit.own": ["admin", "creator"], // Can edit own draft questions
  "questions.update": ["admin", "creator", "reviewer"], // Can update questions (with API-level permission checks)
  "questions.submit": ["admin", "creator"], // Can submit for review

  // Reviewer permissions - can review and approve
  "questions.review": ["admin", "reviewer"],
  "questions.approve": ["admin", "reviewer"],
  "questions.reject": ["admin", "reviewer"],

  // Admin can edit any question directly
  "questions.edit": ["admin"],
  "questions.delete": ["admin"],

  // Shared permissions
  "questions.view": ["admin", "creator", "reviewer"],
  "dashboard.view": ["admin", "creator", "reviewer"],
  "questions.flag": ["admin", "creator", "reviewer", "user"], // Users can flag questions
} as const;

export function useUserRole(): UserRoleData {
  const { role: authRole, isLoading: authLoading } = useAuthContext();
  const [role, setRole] = useState<UserRole>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, _setError] = useState<string | null>(null);

  // Track the previous user ID to prevent unnecessary re-fetches
  const _previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Use role from useAuth hook directly (it's already fetched from JWT/database)
    if (!authLoading) {
      setRole(authRole as UserRole);
      setIsLoading(false);
    }
  }, [authRole, authLoading]);

  const canAccess = (feature: string): boolean => {
    if (!role) return false;
    const allowedRoles = FEATURE_PERMISSIONS[feature];
    return allowedRoles ? allowedRoles.includes(role) : false;
  };

  return {
    role,
    isLoading: authLoading || isLoading,
    error,
    canAccess,
    isAdmin: role === "admin",
    isCreator: role === "creator",
    isReviewer: role === "reviewer",
    isAdminOrReviewer: role === "admin" || role === "reviewer",
    isCreatorOrAbove: role === "admin" || role === "creator" || role === "reviewer",
  };
}
