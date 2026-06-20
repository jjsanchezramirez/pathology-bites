// src/shared/hooks/use-auth.ts
/**
 * Unified authentication hook
 * Replaces: useAuth, useAuth, useUserInit
 *
 * Features controlled by options:
 * - Security validation (optional, for sensitive operations)
 * - User data loading (optional, for dashboards)
 * - Minimal mode (for auth guards, public pages)
 */

"use client";

// Bump this when auth/middleware logic changes to bust stale sessionStorage caches.
// In dev, we always skip the cache so restarts pick up changes immediately.
const AUTH_CACHE_VERSION = "v1";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { realtimeService } from "@/shared/services/realtime-service";
import { createClient } from "@/shared/services/client";
import { isPublicRoute } from "@/shared/utils/route-helpers";
import type { User, Session } from "@supabase/supabase-js";
import type { UserRole } from "@/shared/utils/auth/auth-helpers";
import { log } from "@/shared/utils/logging";

interface UseAuthOptions {
  /** Enable security validation (session monitoring) */
  enableSecurity?: boolean;
  /** Skip auth entirely (for public pages) */
  minimal?: boolean;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface UseAuthReturn extends AuthState {
  // Actions
  refreshAuth: () => Promise<void>;

  // Hydration state
  isHydrated: boolean;
}

/**
 * Unified auth hook with configurable features
 *
 * @example
 * // Minimal mode (auth guards)
 * const { isAuthenticated, isLoading } = useAuth({ minimal: true })
 *
 * @example
 * // Full mode (dashboard pages)
 * const { user, role } = useAuth({
 *   enableSecurity: true,
 * })
 *
 * @example
 * // Public pages (skips auth entirely)
 * const { isLoading } = useAuth({ minimal: true })
 */
export function useAuth(options: UseAuthOptions = {}): UseAuthReturn {
  const { enableSecurity: _enableSecurity = false, minimal = false } = options;

  // Check if we're on a public page
  const isPublicPage = typeof window !== "undefined" && isPublicRoute(window.location.pathname);

  // Skip auth on public pages in minimal mode
  const skipAuth = minimal && isPublicPage;

  // Initialize state from sessionStorage for faster perceived load
  const [authState, setAuthState] = useState<AuthState>(() => {
    // Try to restore from sessionStorage on mount
    // In development, always skip cache so server restarts pick up auth/middleware changes immediately.
    const isDev = process.env.NODE_ENV === "development";
    if (typeof window !== "undefined" && !skipAuth && !isDev) {
      try {
        const cached = sessionStorage.getItem("auth-state");

        if (cached) {
          const parsed = JSON.parse(cached);
          // Only use cache if it has a user, valid session, and matching version
          if (parsed.user && parsed.session && parsed._v === AUTH_CACHE_VERSION) {
            const cachedState = {
              ...parsed,
              isLoading: false, // Cache is ready, no need to show loading
              error: null,
            };
            return cachedState;
          }
          // Stale or version-mismatched cache — discard it
          sessionStorage.removeItem("auth-state");
        }
      } catch (e) {
        // Ignore parse errors
        log.error("[useAuth] ❌ Failed to parse cached auth:", e);
      }
    }

    return {
      user: null,
      session: null,
      role: null,
      isAuthenticated: false,
      isLoading: !skipAuth, // Don't load if skipping
      error: null,
    };
  });

  const [isHydrated, setIsHydrated] = useState(false);

  const mounted = useRef(true);
  const previousSessionRef = useRef<Session | null>(null);
  const supabase = createClient();
  const pathname = usePathname();

  // Helper to save auth state to sessionStorage (skipped in dev)
  const saveAuthState = (state: AuthState) => {
    if (
      typeof window !== "undefined" &&
      state.user &&
      state.session &&
      process.env.NODE_ENV !== "development"
    ) {
      try {
        const dataToSave = {
          _v: AUTH_CACHE_VERSION,
          user: state.user,
          session: state.session,
          role: state.role,
          isAuthenticated: state.isAuthenticated,
          error: null,
        };
        // Only save minimal data needed for fast restore
        sessionStorage.setItem("auth-state", JSON.stringify(dataToSave));
      } catch (e) {
        // Ignore storage errors (quota exceeded, etc.)
        log.error("[useAuth] ❌ Failed to save to sessionStorage:", e);
      }
    }
  };

  // Helper to clear auth state from sessionStorage
  const clearAuthState = () => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("auth-state");
      } catch (e) {
        log.error("[useAuth] ❌ Failed to clear sessionStorage:", e);
      }
    }
  };

  // Hydration - set to true immediately since we initialize from sessionStorage synchronously
  // The initial useState already handles sessionStorage restoration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Initialize auth
  useEffect(() => {
    mounted.current = true;

    // Skip auth initialization for public pages in minimal mode
    if (skipAuth) {
      setAuthState({
        user: null,
        session: null,
        role: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
      return;
    }

    const initAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          log.error("[useAuth] Error getting session:", error);
          if (mounted.current) {
            setAuthState((prev) => ({
              ...prev,
              error: error.message,
              isLoading: false,
            }));
          }
          return;
        }

        if (mounted.current) {
          previousSessionRef.current = session;

          // Extract role from JWT
          const role =
            session?.user?.app_metadata?.role || session?.user?.user_metadata?.role || null;

          const newAuthState = {
            user: session?.user ?? null,
            session,
            role: role as UserRole | null,
            isAuthenticated: !!session?.user,
            isLoading: false,
            error: null,
          };

          setAuthState(newAuthState);

          // Save to sessionStorage for fast restore on next page load
          if (session?.user) {
            saveAuthState(newAuthState);
          } else {
            clearAuthState();
          }
        }
      } catch (err) {
        log.error("Auth initialization error:", err);
        if (mounted.current) {
          setAuthState((prev) => ({
            ...prev,
            error: err instanceof Error ? err.message : "Auth initialization failed",
            isLoading: false,
          }));
        }
      }
    };

    initAuth();

    // Register with shared auth service
    const unsubscribe = realtimeService.addAuthListener((event, session) => {
      if (!mounted.current) return;

      // Session change detection to prevent unnecessary re-renders
      const previousSession = previousSessionRef.current;
      const sessionChanged =
        previousSession?.access_token !== session?.access_token ||
        previousSession?.user?.id !== session?.user?.id ||
        event === "SIGNED_OUT" ||
        event === "USER_UPDATED";

      if (!sessionChanged) {
        return;
      }

      previousSessionRef.current = session;

      // Extract role from JWT
      const role = session?.user?.app_metadata?.role || session?.user?.user_metadata?.role || null;

      const newAuthState = {
        user: session?.user ?? null,
        session,
        role: role as UserRole | null,
        isAuthenticated: !!session?.user,
        isLoading: false,
        error: null,
      };

      setAuthState(newAuthState);

      // Save/clear sessionStorage
      if (session?.user) {
        saveAuthState(newAuthState);
      } else {
        clearAuthState();
      }
    });

    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [skipAuth, supabase.auth]);

  // Re-read session on every route navigation. Server-action logins (Supabase's
  // canonical pattern) mutate auth cookies, redirect, and never notify the client
  // SDK — onAuthStateChange only fires when the SDK itself re-reads cookies.
  // Nudging it via getSession() on pathname change makes the cookie change visible.
  // Cheap: in-memory cache, no network unless token near expiry.
  useEffect(() => {
    if (skipAuth || !pathname) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !mounted.current) return;
      // Skip if session unchanged (avoid pointless re-renders)
      if (session?.access_token === previousSessionRef.current?.access_token) return;
      previousSessionRef.current = session;
      const role = session?.user?.app_metadata?.role || session?.user?.user_metadata?.role || null;
      const newState = {
        user: session?.user ?? null,
        session,
        role: role as UserRole | null,
        isAuthenticated: !!session?.user,
        isLoading: false,
        error: null,
      };
      setAuthState(newState);
      if (session?.user) saveAuthState(newState);
      else clearAuthState();
    });
    return () => {
      cancelled = true;
    };
  }, [pathname, skipAuth, supabase.auth]);

  const refreshAuth = async () => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.refreshSession();
      if (error) throw error;

      const role = session?.user?.app_metadata?.role || session?.user?.user_metadata?.role || null;

      const newAuthState = {
        user: session?.user ?? null,
        session,
        role: role as UserRole | null,
        isAuthenticated: !!session?.user,
        isLoading: false,
        error: null,
      };

      setAuthState(newAuthState);

      // Update sessionStorage
      if (session?.user) {
        saveAuthState(newAuthState);
      } else {
        clearAuthState();
      }
    } catch (err) {
      log.error("Refresh session error:", err);
      clearAuthState();
      setAuthState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Session refresh failed",
      }));
    }
  };

  return {
    ...authState,
    refreshAuth,
    isHydrated,
  };
}
