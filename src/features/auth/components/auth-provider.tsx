// src/components/auth/auth-provider.tsx
"use client";

import { createContext, useContext } from "react";
import { User, Session } from "@supabase/supabase-js";
import { useAuth } from "@/shared/hooks/use-auth";
import { isPublicRoute } from "@/shared/utils/route-helpers";
import type { UserRole } from "@/shared/utils/auth-helpers";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  isHydrated: boolean;
  refreshAuth: () => Promise<void>;
  retry: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,
  isHydrated: false,
  refreshAuth: async () => {},
  retry: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Check if we're on a public page that doesn't need auth
  const isPublic = typeof window !== "undefined" && isPublicRoute(window.location.pathname);

  // Use minimal auth for public pages, full auth for protected pages
  const authState = useAuth({
    minimal: isPublic,
    enableSecurity: !isPublic,
  });

  const value: AuthContextType = {
    user: authState.user,
    session: authState.session,
    role: authState.role,
    isLoading: authState.isLoading,
    isAuthenticated: authState.isAuthenticated,
    error: authState.error,
    isHydrated: authState.isHydrated,
    refreshAuth: authState.refreshAuth,
    retry: authState.refreshAuth, // Alias for compatibility
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
