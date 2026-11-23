// src/components/auth/auth-provider.tsx
"use client";

import { createContext, useContext, useMemo } from "react";
import { User, Session } from "@supabase/supabase-js";
import { useAuth } from "@/shared/hooks/use-auth";
import { isPublicRoute } from "@/shared/utils/route-helpers";
import type { UserRole } from "@/shared/utils/auth/auth-helpers";
import { parsePermissions, type Permission } from "@/shared/utils/auth/permissions";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  /** Granted permissions from app_metadata (admins implicitly hold all). */
  permissions: Permission[];
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  isHydrated: boolean;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  permissions: [],
  isLoading: true,
  isAuthenticated: false,
  error: null,
  isHydrated: false,
  refreshAuth: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Check if we're on a public page that doesn't need auth
  const isPublic = typeof window !== "undefined" && isPublicRoute(window.location.pathname);

  // Always load auth data (minimal: false) so user data is available for prefilling forms
  // Just disable security enforcement on public pages
  const authState = useAuth({
    minimal: false,
    enableSecurity: !isPublic,
  });

  const rawPermissions = authState.user?.app_metadata?.permissions;
  const permissions = useMemo(() => parsePermissions(rawPermissions), [rawPermissions]);

  const value: AuthContextType = {
    user: authState.user,
    session: authState.session,
    role: authState.role,
    permissions,
    isLoading: authState.isLoading,
    isAuthenticated: authState.isAuthenticated,
    error: authState.error,
    isHydrated: authState.isHydrated,
    refreshAuth: authState.refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
};
