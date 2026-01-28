// src/shared/components/auth/role-guard.tsx
"use client";

import { ReactNode } from "react";
import { useUserRole } from "@/shared/hooks/use-user-role";
import { AccessDenied, AccessDeniedPresets } from "@/shared/components/common/access-denied";

interface RoleGuardProps {
  children: ReactNode;
  requiredPermission?: string;
  adminOnly?: boolean;
  fallback?: ReactNode;
  showFallback?: boolean;
}

export function RoleGuard({
  children,
  requiredPermission,
  adminOnly = false,
  fallback,
  showFallback = true,
}: RoleGuardProps) {
  const { isAdmin, canAccess, isLoading } = useUserRole();

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Check admin-only access
  if (adminOnly && !isAdmin) {
    if (!showFallback) return null;

    return fallback || <AccessDenied {...AccessDeniedPresets.adminOnly} backHref="/admin" />;
  }

  // Check specific permission
  if (requiredPermission && !canAccess(requiredPermission)) {
    if (!showFallback) return null;

    return (
      fallback || (
        <AccessDenied
          title="Insufficient Permissions"
          description={`You don't have the required permission (${requiredPermission}) to access this feature. If you believe you should have access, please contact an administrator on Discord.`}
          backHref="/admin"
        />
      )
    );
  }

  // User has access, render children
  return <>{children}</>;
}

// Convenience components for common use cases
export function AdminOnly({
  children,
  fallback,
  showFallback = true,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  showFallback?: boolean;
}) {
  return (
    <RoleGuard adminOnly showFallback={showFallback} fallback={fallback}>
      {children}
    </RoleGuard>
  );
}

export function RequirePermission({
  permission,
  children,
  fallback,
  showFallback = true,
}: {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
  showFallback?: boolean;
}) {
  return (
    <RoleGuard requiredPermission={permission} showFallback={showFallback} fallback={fallback}>
      {children}
    </RoleGuard>
  );
}

// Hook for conditional rendering
export function useRoleAccess() {
  const { isAdmin, isCreator, isReviewer, canAccess, role, isCreatorOrAbove } = useUserRole();

  return {
    isAdmin,
    isCreator,
    isReviewer,
    canAccess,
    role,
    hasAdminAccess: isAdmin,
    hasCreatorAccess: isCreator,
    hasReviewerAccess: isReviewer,
    hasAnyAdminAccess: isAdmin || isCreator || isReviewer,
    isCreatorOrAbove,
  };
}
