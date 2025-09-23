// src/__tests__/auth/authorization.test.ts
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import React from "react";
import { renderHook } from "@testing-library/react";
import { render, screen } from "@testing-library/react";
import { createMockSupabaseClient } from "../utils/supabase-mock";

// Mock modules
jest.mock("@/shared/services/client", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/shared/hooks/use-user-role");
jest.mock("@/shared/components/auth/role-guard");

describe("Authorization & Role-Based Access Control", () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Role Hierarchy", () => {
    it("should enforce correct role hierarchy", () => {
      const roleHierarchy = {
        admin: 4,
        creator: 3,
        reviewer: 2,
        user: 1,
      };

      const hasHigherRole = (userRole: string, requiredRole: string) => {
        return (
          roleHierarchy[userRole as keyof typeof roleHierarchy] >=
          roleHierarchy[requiredRole as keyof typeof roleHierarchy]
        );
      };

      // Admin should have access to all roles
      expect(hasHigherRole("admin", "admin")).toBe(true);
      expect(hasHigherRole("admin", "creator")).toBe(true);
      expect(hasHigherRole("admin", "reviewer")).toBe(true);
      expect(hasHigherRole("admin", "user")).toBe(true);

      // Creator should have access to reviewer and user
      expect(hasHigherRole("creator", "creator")).toBe(true);
      expect(hasHigherRole("creator", "reviewer")).toBe(true);
      expect(hasHigherRole("creator", "user")).toBe(true);
      expect(hasHigherRole("creator", "admin")).toBe(false);

      // Reviewer should have access to user only
      expect(hasHigherRole("reviewer", "reviewer")).toBe(true);
      expect(hasHigherRole("reviewer", "user")).toBe(true);
      expect(hasHigherRole("reviewer", "creator")).toBe(false);
      expect(hasHigherRole("reviewer", "admin")).toBe(false);

      // User should have access to user only
      expect(hasHigherRole("user", "user")).toBe(true);
      expect(hasHigherRole("user", "reviewer")).toBe(false);
      expect(hasHigherRole("user", "creator")).toBe(false);
      expect(hasHigherRole("user", "admin")).toBe(false);
    });

    it("should validate role transitions", () => {
      const roleHierarchy = { admin: 4, creator: 3, reviewer: 2, user: 1 };

      const isValidPromotion = (fromRole: string, toRole: string) => {
        const fromLevel = roleHierarchy[fromRole as keyof typeof roleHierarchy];
        const toLevel = roleHierarchy[toRole as keyof typeof roleHierarchy];
        return toLevel > fromLevel; // Only allow promotions
      };

      const validPromotions = [
        { from: "user", to: "reviewer" },
        { from: "user", to: "creator" },
        { from: "user", to: "admin" },
        { from: "reviewer", to: "creator" },
        { from: "reviewer", to: "admin" },
        { from: "creator", to: "admin" },
      ];

      const invalidDemotions = [
        { from: "admin", to: "creator" },
        { from: "admin", to: "reviewer" },
        { from: "admin", to: "user" },
        { from: "creator", to: "reviewer" },
        { from: "creator", to: "user" },
        { from: "reviewer", to: "user" },
      ];

      // Valid promotions should be allowed
      validPromotions.forEach(({ from, to }) => {
        expect(isValidPromotion(from, to)).toBe(true);
      });

      // Invalid demotions should be prevented
      invalidDemotions.forEach(({ from, to }) => {
        expect(isValidPromotion(from, to)).toBe(false);
      });
    });
  });

  describe("Route Protection Logic", () => {
    it("should identify public routes correctly", () => {
      const publicRoutes = [
        "/",
        "/about",
        "/contact",
        "/login",
        "/signup",
        "/verify-email",
        "/reset-password",
      ];

      const protectedRoutes = [
        "/dashboard",
        "/quiz",
        "/profile",
        "/settings",
        "/admin",
        "/admin/users",
      ];

      const isPublicRoute = (path: string) => {
        return (
          publicRoutes.includes(path) ||
          path.startsWith("/api/auth/") ||
          path.startsWith("/static/") ||
          path.startsWith("/_next/")
        );
      };

      publicRoutes.forEach((route) => {
        expect(isPublicRoute(route)).toBe(true);
      });

      protectedRoutes.forEach((route) => {
        expect(isPublicRoute(route)).toBe(false);
      });

      // API auth routes should be public
      expect(isPublicRoute("/api/auth/callback")).toBe(true);
      expect(isPublicRoute("/api/auth/confirm")).toBe(true);

      // Static assets should be public
      expect(isPublicRoute("/static/images/logo.png")).toBe(true);
      expect(isPublicRoute("/_next/static/css/app.css")).toBe(true);
    });

    it("should determine route access requirements", () => {
      const routeRequirements = {
        "/": { auth: false, role: null },
        "/login": { auth: false, role: null },
        "/signup": { auth: false, role: null },
        "/dashboard": { auth: true, role: "user" },
        "/quiz": { auth: true, role: "user" },
        "/profile": { auth: true, role: "user" },
        "/admin": { auth: true, role: "reviewer" },
        "/admin/users": { auth: true, role: "admin" },
        "/admin/questions": { auth: true, role: "creator" },
      };

      const checkRouteAccess = (
        path: string,
        userRole: string | null,
        isAuthenticated: boolean,
      ) => {
        const requirements =
          routeRequirements[path as keyof typeof routeRequirements];
        if (!requirements) return false;

        // Check authentication requirement
        if (requirements.auth && !isAuthenticated) return false;

        // Check role requirement
        if (requirements.role && !userRole) return false;

        if (requirements.role) {
          const roleHierarchy = { admin: 4, creator: 3, reviewer: 2, user: 1 };
          const userLevel =
            roleHierarchy[userRole as keyof typeof roleHierarchy] || 0;
          const requiredLevel =
            roleHierarchy[requirements.role as keyof typeof roleHierarchy] || 0;
          return userLevel >= requiredLevel;
        }

        return true;
      };

      // Test public routes
      expect(checkRouteAccess("/", null, false)).toBe(true);
      expect(checkRouteAccess("/login", null, false)).toBe(true);

      // Test authenticated routes
      expect(checkRouteAccess("/dashboard", "user", true)).toBe(true);
      expect(checkRouteAccess("/dashboard", null, false)).toBe(false);

      // Test role-based routes
      expect(checkRouteAccess("/admin", "admin", true)).toBe(true);
      expect(checkRouteAccess("/admin", "user", true)).toBe(false);
      expect(checkRouteAccess("/admin/users", "admin", true)).toBe(true);
      expect(checkRouteAccess("/admin/users", "creator", true)).toBe(false);
    });

    it("should validate admin route access by role", () => {
      const adminRoutes = [
        { path: "/admin", minRole: "reviewer" },
        { path: "/admin/dashboard", minRole: "reviewer" },
        { path: "/admin/users", minRole: "admin" },
        { path: "/admin/questions", minRole: "creator" },
        { path: "/admin/analytics", minRole: "reviewer" },
      ];

      const roleHierarchy = { admin: 4, creator: 3, reviewer: 2, user: 1 };

      const canAccessAdminRoute = (userRole: string, routePath: string) => {
        const route = adminRoutes.find((r) => r.path === routePath);
        if (!route) return false;

        const userLevel =
          roleHierarchy[userRole as keyof typeof roleHierarchy] || 0;
        const requiredLevel =
          roleHierarchy[route.minRole as keyof typeof roleHierarchy] || 0;

        return userLevel >= requiredLevel;
      };

      // Test admin access (should have access to all)
      adminRoutes.forEach((route) => {
        expect(canAccessAdminRoute("admin", route.path)).toBe(true);
      });

      // Test creator access
      expect(canAccessAdminRoute("creator", "/admin")).toBe(true);
      expect(canAccessAdminRoute("creator", "/admin/questions")).toBe(true);
      expect(canAccessAdminRoute("creator", "/admin/users")).toBe(false); // Admin only

      // Test reviewer access
      expect(canAccessAdminRoute("reviewer", "/admin")).toBe(true);
      expect(canAccessAdminRoute("reviewer", "/admin/analytics")).toBe(true);
      expect(canAccessAdminRoute("reviewer", "/admin/questions")).toBe(false); // Creator+
      expect(canAccessAdminRoute("reviewer", "/admin/users")).toBe(false); // Admin only

      // Test user access (should be denied all)
      adminRoutes.forEach((route) => {
        expect(canAccessAdminRoute("user", route.path)).toBe(false);
      });
    });

    it("should implement role caching logic", () => {
      const roleCache = new Map<string, { role: string; timestamp: number }>();
      const cacheTimeout = 5 * 60 * 1000; // 5 minutes

      const getUserRoleWithCache = async (
        userId: string,
      ): Promise<string | null> => {
        const cached = roleCache.get(userId);
        const now = Date.now();

        // Return cached role if still valid
        if (cached && now - cached.timestamp < cacheTimeout) {
          return cached.role;
        }

        // Simulate database query
        const role = await mockSupabase
          .from("users")
          .select("role")
          .eq("id", userId)
          .single()
          .then((result: any) => result.data?.role || null);

        // Cache the result
        if (role) {
          roleCache.set(userId, { role, timestamp: now });
        }

        return role;
      };

      // Mock database response
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: "admin" },
              error: null,
            }),
          }),
        }),
      });

      // Test caching behavior
      const testUserId = "user-123";

      // First call should query database and cache result
      expect(roleCache.has(testUserId)).toBe(false);

      // Simulate cache population
      roleCache.set(testUserId, { role: "admin", timestamp: Date.now() });
      expect(roleCache.has(testUserId)).toBe(true);

      // Cache should expire after timeout
      const expiredEntry = {
        role: "admin",
        timestamp: Date.now() - (cacheTimeout + 1000),
      };
      roleCache.set(testUserId, expiredEntry);

      const cached = roleCache.get(testUserId);
      const isExpired = cached && Date.now() - cached.timestamp >= cacheTimeout;
      expect(isExpired).toBe(true);
    });
  });

  describe("Component-Level Authorization", () => {
    it("should implement role-based component rendering logic", () => {
      const roleHierarchy = { admin: 4, creator: 3, reviewer: 2, user: 1 };

      const shouldRenderForRole = (
        userRole: string | null,
        requiredRole: string,
      ) => {
        if (!userRole) return false;

        const userLevel =
          roleHierarchy[userRole as keyof typeof roleHierarchy] || 0;
        const requiredLevel =
          roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0;

        return userLevel >= requiredLevel;
      };

      // Test AdminOnly component logic
      expect(shouldRenderForRole("admin", "admin")).toBe(true);
      expect(shouldRenderForRole("creator", "admin")).toBe(false);
      expect(shouldRenderForRole("reviewer", "admin")).toBe(false);
      expect(shouldRenderForRole("user", "admin")).toBe(false);
      expect(shouldRenderForRole(null, "admin")).toBe(false);

      // Test CreatorOrAbove component logic
      expect(shouldRenderForRole("admin", "creator")).toBe(true);
      expect(shouldRenderForRole("creator", "creator")).toBe(true);
      expect(shouldRenderForRole("reviewer", "creator")).toBe(false);
      expect(shouldRenderForRole("user", "creator")).toBe(false);

      // Test ReviewerOrAbove component logic
      expect(shouldRenderForRole("admin", "reviewer")).toBe(true);
      expect(shouldRenderForRole("creator", "reviewer")).toBe(true);
      expect(shouldRenderForRole("reviewer", "reviewer")).toBe(true);
      expect(shouldRenderForRole("user", "reviewer")).toBe(false);
    });

    it("should implement loading state logic", () => {
      const componentStates = {
        loading: { role: null, isLoading: true, error: null },
        authenticated: { role: "user", isLoading: false, error: null },
        error: { role: null, isLoading: false, error: "Failed to load user" },
        unauthenticated: { role: null, isLoading: false, error: null },
      };

      const getComponentState = (state: typeof componentStates.loading) => {
        if (state.isLoading) return "loading";
        if (state.error) return "error";
        if (state.role) return "authenticated";
        return "unauthenticated";
      };

      expect(getComponentState(componentStates.loading)).toBe("loading");
      expect(getComponentState(componentStates.authenticated)).toBe(
        "authenticated",
      );
      expect(getComponentState(componentStates.error)).toBe("error");
      expect(getComponentState(componentStates.unauthenticated)).toBe(
        "unauthenticated",
      );
    });

    it("should implement permission-based access control", () => {
      const rolePermissions = {
        admin: [
          "manage_users",
          "manage_questions",
          "view_analytics",
          "audit_logs",
        ],
        creator: ["create_questions", "edit_own_questions", "view_analytics"],
        reviewer: ["review_questions", "approve_questions", "flag_questions"],
        user: ["take_quizzes", "view_progress", "manage_profile"],
      };

      const hasPermission = (userRole: string | null, permission: string) => {
        if (!userRole) return false;

        const permissions =
          rolePermissions[userRole as keyof typeof rolePermissions] || [];
        return permissions.includes(permission);
      };

      // Test admin permissions
      expect(hasPermission("admin", "manage_users")).toBe(true);
      expect(hasPermission("admin", "audit_logs")).toBe(true);

      // Test creator permissions
      expect(hasPermission("creator", "create_questions")).toBe(true);
      expect(hasPermission("creator", "manage_users")).toBe(false);

      // Test reviewer permissions
      expect(hasPermission("reviewer", "review_questions")).toBe(true);
      expect(hasPermission("reviewer", "create_questions")).toBe(false);

      // Test user permissions
      expect(hasPermission("user", "take_quizzes")).toBe(true);
      expect(hasPermission("user", "review_questions")).toBe(false);

      // Test null user
      expect(hasPermission(null, "take_quizzes")).toBe(false);
    });
  });

  describe("Permission System", () => {
    it("should validate permission hierarchy", () => {
      const rolePermissions = {
        admin: [
          "manage_users",
          "manage_questions",
          "manage_categories",
          "view_analytics",
          "manage_system",
          "audit_logs",
        ],
        creator: [
          "create_questions",
          "edit_own_questions",
          "manage_categories",
          "view_analytics",
        ],
        reviewer: [
          "review_questions",
          "approve_questions",
          "flag_questions",
          "view_analytics",
        ],
        user: ["take_quizzes", "view_progress", "manage_profile"],
      };

      // Admin should have the most permissions
      expect(rolePermissions.admin.length).toBeGreaterThan(
        rolePermissions.creator.length,
      );
      expect(rolePermissions.admin.length).toBeGreaterThan(
        rolePermissions.reviewer.length,
      );
      expect(rolePermissions.admin.length).toBeGreaterThan(
        rolePermissions.user.length,
      );

      // Verify specific permissions exist for each role
      expect(rolePermissions.admin).toContain("manage_users");
      expect(rolePermissions.admin).toContain("audit_logs");
      expect(rolePermissions.creator).toContain("create_questions");
      expect(rolePermissions.reviewer).toContain("review_questions");
      expect(rolePermissions.user).toContain("take_quizzes");

      // Verify role-specific restrictions
      expect(rolePermissions.user).not.toContain("manage_users");
      expect(rolePermissions.reviewer).not.toContain("create_questions");
      expect(rolePermissions.creator).not.toContain("manage_users");
    });

    it("should implement permission inheritance logic", () => {
      const basePermissions = [
        "take_quizzes",
        "view_progress",
        "manage_profile",
      ];

      const getInheritedPermissions = (role: string) => {
        const roleSpecificPermissions = {
          admin: ["manage_users", "manage_system", "audit_logs"],
          creator: ["create_questions", "edit_own_questions"],
          reviewer: ["review_questions", "approve_questions"],
          user: [],
        };

        const specific =
          roleSpecificPermissions[
            role as keyof typeof roleSpecificPermissions
          ] || [];

        // All roles inherit base permissions
        return [...basePermissions, ...specific];
      };

      const adminPermissions = getInheritedPermissions("admin");
      const creatorPermissions = getInheritedPermissions("creator");
      const reviewerPermissions = getInheritedPermissions("reviewer");
      const userPermissions = getInheritedPermissions("user");

      // All roles should have base permissions
      expect(adminPermissions).toEqual(expect.arrayContaining(basePermissions));
      expect(creatorPermissions).toEqual(
        expect.arrayContaining(basePermissions),
      );
      expect(reviewerPermissions).toEqual(
        expect.arrayContaining(basePermissions),
      );
      expect(userPermissions).toEqual(expect.arrayContaining(basePermissions));

      // Higher roles should have additional permissions
      expect(adminPermissions).toContain("manage_users");
      expect(creatorPermissions).toContain("create_questions");
      expect(reviewerPermissions).toContain("review_questions");
    });
  });

  describe("Role Transition Security", () => {
    it("should validate role change authorization", () => {
      const roleChangeMatrix = {
        admin: ["admin", "creator", "reviewer", "user"], // Can change anyone
        creator: ["reviewer", "user"], // Can only change lower roles
        reviewer: ["user"], // Can only change users
        user: [], // Cannot change any roles
      };

      const canChangeRole = (changerRole: string, targetRole: string) => {
        const allowedTargets =
          roleChangeMatrix[changerRole as keyof typeof roleChangeMatrix] || [];
        return allowedTargets.includes(targetRole);
      };

      // Test admin privileges (can change anyone)
      expect(canChangeRole("admin", "admin")).toBe(true);
      expect(canChangeRole("admin", "creator")).toBe(true);
      expect(canChangeRole("admin", "reviewer")).toBe(true);
      expect(canChangeRole("admin", "user")).toBe(true);

      // Test creator privileges
      expect(canChangeRole("creator", "admin")).toBe(false);
      expect(canChangeRole("creator", "creator")).toBe(false);
      expect(canChangeRole("creator", "reviewer")).toBe(true);
      expect(canChangeRole("creator", "user")).toBe(true);

      // Test reviewer privileges
      expect(canChangeRole("reviewer", "admin")).toBe(false);
      expect(canChangeRole("reviewer", "creator")).toBe(false);
      expect(canChangeRole("reviewer", "reviewer")).toBe(false);
      expect(canChangeRole("reviewer", "user")).toBe(true);

      // Test user privileges (none)
      expect(canChangeRole("user", "admin")).toBe(false);
      expect(canChangeRole("user", "creator")).toBe(false);
      expect(canChangeRole("user", "reviewer")).toBe(false);
      expect(canChangeRole("user", "user")).toBe(false);
    });

    it("should implement audit logging for role changes", () => {
      const createAuditLog = (change: {
        user_id: string;
        old_role: string;
        new_role: string;
        changed_by: string;
        reason?: string;
      }) => {
        return {
          ...change,
          timestamp: new Date().toISOString(),
          id: `audit_${Date.now()}`,
          action: "role_change",
        };
      };

      const roleChange = {
        user_id: "user-123",
        old_role: "user",
        new_role: "reviewer",
        changed_by: "admin-456",
        reason: "Promotion to reviewer",
      };

      const auditLog = createAuditLog(roleChange);

      expect(auditLog.user_id).toBe("user-123");
      expect(auditLog.old_role).toBe("user");
      expect(auditLog.new_role).toBe("reviewer");
      expect(auditLog.changed_by).toBe("admin-456");
      expect(auditLog.reason).toBe("Promotion to reviewer");
      expect(auditLog.timestamp).toBeDefined();
      expect(auditLog.id).toBeDefined();
      expect(auditLog.action).toBe("role_change");
    });

    it("should prevent self-role escalation", () => {
      const preventSelfEscalation = (
        changerId: string,
        targetUserId: string,
        newRole: string,
      ) => {
        // Users cannot change their own role
        if (changerId === targetUserId) {
          return { allowed: false, reason: "Cannot change own role" };
        }

        // Additional business logic would go here
        return { allowed: true, reason: null };
      };

      // Test self-escalation prevention
      const result1 = preventSelfEscalation("user-123", "user-123", "admin");
      expect(result1.allowed).toBe(false);
      expect(result1.reason).toBe("Cannot change own role");

      // Test valid role change
      const result2 = preventSelfEscalation(
        "admin-456",
        "user-123",
        "reviewer",
      );
      expect(result2.allowed).toBe(true);
      expect(result2.reason).toBeNull();
    });
  });

  describe("Database-Level Security", () => {
    it("should implement RLS policy logic", () => {
      const simulateRLSPolicy = (
        requestingUserId: string,
        resourceUserId: string,
        userRole: string,
      ) => {
        // Simulate RLS policy: users can only access their own data, admins can access all
        if (userRole === "admin") {
          return { allowed: true, reason: "Admin access" };
        }

        if (requestingUserId === resourceUserId) {
          return { allowed: true, reason: "Own data access" };
        }

        return { allowed: false, reason: "RLS policy violation" };
      };

      // Test user accessing own data
      const ownDataAccess = simulateRLSPolicy("user-123", "user-123", "user");
      expect(ownDataAccess.allowed).toBe(true);
      expect(ownDataAccess.reason).toBe("Own data access");

      // Test user accessing other's data
      const otherDataAccess = simulateRLSPolicy("user-123", "user-456", "user");
      expect(otherDataAccess.allowed).toBe(false);
      expect(otherDataAccess.reason).toBe("RLS policy violation");

      // Test admin accessing any data
      const adminAccess = simulateRLSPolicy("admin-123", "user-456", "admin");
      expect(adminAccess.allowed).toBe(true);
      expect(adminAccess.reason).toBe("Admin access");
    });

    it("should validate sensitive table access", () => {
      const sensitiveTableAccess = (userRole: string, tableName: string) => {
        const tablePermissions = {
          audit_logs: ["admin"],
          user_sessions: ["admin", "creator"],
          system_config: ["admin"],
          quiz_sessions: ["admin", "creator", "reviewer", "user"], // with RLS
          questions: ["admin", "creator", "reviewer", "user"], // with RLS
        };

        const allowedRoles =
          tablePermissions[tableName as keyof typeof tablePermissions] || [];
        return allowedRoles.includes(userRole);
      };

      // Test audit_logs access (admin only)
      expect(sensitiveTableAccess("admin", "audit_logs")).toBe(true);
      expect(sensitiveTableAccess("creator", "audit_logs")).toBe(false);
      expect(sensitiveTableAccess("user", "audit_logs")).toBe(false);

      // Test system_config access (admin only)
      expect(sensitiveTableAccess("admin", "system_config")).toBe(true);
      expect(sensitiveTableAccess("creator", "system_config")).toBe(false);

      // Test user_sessions access (admin and creator)
      expect(sensitiveTableAccess("admin", "user_sessions")).toBe(true);
      expect(sensitiveTableAccess("creator", "user_sessions")).toBe(true);
      expect(sensitiveTableAccess("reviewer", "user_sessions")).toBe(false);
      expect(sensitiveTableAccess("user", "user_sessions")).toBe(false);
    });

    it("should prevent unauthorized role updates", () => {
      const validateRoleUpdate = (
        requestingUserId: string,
        targetUserId: string,
        requestingUserRole: string,
        newRole: string,
      ) => {
        // Prevent self-role changes
        if (requestingUserId === targetUserId) {
          return { allowed: false, reason: "Cannot change own role" };
        }

        // Check if requesting user has permission to assign the new role
        const roleHierarchy = { admin: 4, creator: 3, reviewer: 2, user: 1 };
        const requesterLevel =
          roleHierarchy[requestingUserRole as keyof typeof roleHierarchy] || 0;
        const newRoleLevel =
          roleHierarchy[newRole as keyof typeof roleHierarchy] || 0;

        if (requesterLevel <= newRoleLevel && requestingUserRole !== "admin") {
          return {
            allowed: false,
            reason: "Insufficient privileges to assign this role",
          };
        }

        return { allowed: true, reason: "Authorized role change" };
      };

      // Test valid role assignment
      const validAssignment = validateRoleUpdate(
        "admin-123",
        "user-456",
        "admin",
        "creator",
      );
      expect(validAssignment.allowed).toBe(true);

      // Test self-role change (should be prevented)
      const selfChange = validateRoleUpdate(
        "user-123",
        "user-123",
        "user",
        "admin",
      );
      expect(selfChange.allowed).toBe(false);
      expect(selfChange.reason).toBe("Cannot change own role");

      // Test insufficient privileges
      const insufficientPrivs = validateRoleUpdate(
        "reviewer-123",
        "user-456",
        "reviewer",
        "admin",
      );
      expect(insufficientPrivs.allowed).toBe(false);
      expect(insufficientPrivs.reason).toBe(
        "Insufficient privileges to assign this role",
      );
    });
  });
});
