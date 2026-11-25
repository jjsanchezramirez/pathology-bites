// src/components/admin/sidebar-auth-status.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/shared/services/client";
import { useUserProfile } from "@/shared/hooks/use-user-profile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { RefreshCw, LogOut, ChevronUp, Shield, ShieldAlert, ShieldCheck, User } from "lucide-react";
import { useAuthContext } from "@/features/auth/components/auth-provider";
import { log } from "@/shared/utils/logging";

interface SidebarAuthStatusProps {
  isCollapsed?: boolean;
}

export function SidebarAuthStatus({ isCollapsed = false }: SidebarAuthStatusProps) {
  const { user, isLoading, isAuthenticated, error } = useAuthContext();
  // Shared, cached profile (see useUserProfile): the sidebar used to fetch it itself.
  const {
    profile: userProfile,
    loading: profileLoading,
    refresh: refreshProfile,
  } = useUserProfile();
  const [isHydrated, setIsHydrated] = useState(false);

  const supabase = createClient();

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Manual refresh function to replace useAuth's refreshAuth
  const refreshAuth = async () => {
    try {
      await supabase.auth.refreshSession();
      await refreshProfile();
    } catch (error) {
      log.error("Failed to refresh auth:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      // Clear settings session flag so next login fetches fresh settings
      sessionStorage.removeItem("pathology-bites-settings-loaded");

      const { error } = await supabase.auth.signOut();

      if (error) {
        log.error("Sign out error:", error);
        throw error;
      }

      // Clear any local storage or cached data
      if (typeof window !== "undefined") {
        // Preserve theme preference to prevent dark flash on re-login
        const savedTheme = localStorage.getItem("pathology-bites-theme");
        localStorage.clear();
        sessionStorage.clear();
        if (savedTheme) {
          localStorage.setItem("pathology-bites-theme", savedTheme);
        }

        // Clear admin-mode cookie to prevent it from persisting across sessions
        document.cookie = "admin-mode=; path=/; max-age=0";
      }

      // Force a hard refresh to clear all cached data and redirect to login
      window.location.href = "/login";
    } catch (err) {
      log.error("Error during sign out:", err);
      // Still redirect to login even if there's an error
      window.location.href = "/login";
    }
  };

  const getStatusIcon = () => {
    // Show spinner for ANY loading state
    if (!isHydrated || isLoading || profileLoading || (user && !userProfile)) {
      return <RefreshCw className="h-5 w-5 animate-spin" />;
    }

    // Show appropriate icon only when everything is loaded
    if (user && userProfile?.role === "admin") {
      return <ShieldCheck className="h-5 w-5 text-green-400" />;
    }

    if (user && userProfile) {
      return <Shield className="h-5 w-5 text-blue-400" />;
    }

    return <ShieldAlert className="h-5 w-5 text-red-400" />;
  };

  const getDisplayName = () => {
    if (!isHydrated) return "Loading...";
    if (!user) return "Not logged in";
    if (profileLoading) return "Loading profile...";
    if (!userProfile) return user.email?.split("@")[0] || "Unknown";
    if (userProfile.first_name) {
      return `${userProfile.first_name} ${userProfile.last_name || ""}`.trim();
    }
    return user.email?.split("@")[0] || "Unknown";
  };

  const getStatusText = () => {
    if (!isHydrated) return "Initializing...";
    if (isLoading) return "Checking...";
    if (profileLoading) return "Loading...";
    if (error) return "Auth Error";
    if (user && userProfile?.role === "admin") return "Admin";
    if (user && userProfile) return userProfile.role;
    if (user) return "User";
    return "Not logged in";
  };

  // Don't render until hydrated - FIXED: Match container structure to prevent position shift
  if (!isHydrated) {
    if (isCollapsed) {
      return (
        <div className="flex h-14 rounded-lg text-sm font-medium transition-colors duration-200 relative items-center">
          <div className="flex items-center justify-center w-16 shrink-0">
            <RefreshCw className="h-5 w-5 animate-spin" />
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-14 px-2 rounded-lg text-sm font-medium transition-colors duration-200 relative items-center w-full">
        <div className="flex items-center min-w-0 flex-1">
          <div className="flex items-center justify-center w-12 shrink-0">
            <RefreshCw className="h-5 w-5 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  // Collapsed view
  if (isCollapsed) {
    if (!isAuthenticated || !user) {
      return (
        <a
          href="/login"
          title="Sign In"
          className="flex h-14 rounded-lg text-sm font-medium transition-colors duration-200 relative items-center text-slate-300 hover:bg-slate-800 hover:text-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/50 dark:hover:text-white"
        >
          <div className="flex items-center justify-center w-16 shrink-0">
            <User className="h-5 w-5 text-slate-400" />
          </div>
        </a>
      );
    }

    return (
      <div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-14 rounded-lg text-sm font-medium transition-colors duration-200 relative items-center text-slate-300 hover:bg-slate-800 hover:text-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/50 dark:hover:text-white"
              title={`${getDisplayName()} - ${getStatusText()}`}
            >
              <div className="flex items-center justify-center w-16 shrink-0">
                {getStatusIcon()}
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-64 ml-2">
            <DropdownMenuLabel>Authentication Status</DropdownMenuLabel>
            <DropdownMenuSeparator />

            <div className="px-2 py-1.5 text-sm space-y-1">
              <div>
                <strong>Name:</strong> {getDisplayName()}
              </div>
              <div>
                <strong>Email:</strong> {user.email}
              </div>
              <div>
                <strong>Role:</strong>{" "}
                {(userProfile?.role || "User").charAt(0).toUpperCase() +
                  (userProfile?.role || "User").slice(1).toLowerCase()}
              </div>
              <div>
                <strong>User ID:</strong> <span className="font-mono text-xs">{user.id}</span>
              </div>
            </div>

            {error && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-sm text-red-600">
                  <strong>Error:</strong> {String(error)}
                </div>
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={refreshAuth} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh Status
            </DropdownMenuItem>

            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Expanded view
  if (!isAuthenticated || !user) {
    return (
      <a
        href="/login"
        className="flex h-14 px-4 items-center justify-center text-sm font-medium transition-colors duration-200 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/50 dark:hover:text-white mx-2 my-2"
      >
        <User className="h-4 w-4 mr-2 shrink-0" />
        <span className="truncate">Sign In</span>
      </a>
    );
  }

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex h-14 px-2 rounded-lg text-sm font-medium transition-colors duration-200 relative items-center text-slate-300 hover:bg-slate-800 hover:text-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/50 dark:hover:text-white w-full justify-between">
            <div className="flex items-center min-w-0 flex-1">
              <div className="flex items-center justify-center w-12 shrink-0">
                {getStatusIcon()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate text-left">{getDisplayName()}</div>
                <div className="text-xs text-slate-400 truncate text-left">
                  {(userProfile?.role || "User").charAt(0).toUpperCase() +
                    (userProfile?.role || "User").slice(1).toLowerCase()}
                </div>
              </div>
            </div>
            <ChevronUp className="h-4 w-4 shrink-0 ml-2" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="w-64 mb-2">
          <DropdownMenuLabel>Authentication Details</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <div className="px-2 py-1.5 text-sm space-y-1">
            <div>
              <strong>Name:</strong> {getDisplayName()}
            </div>
            <div>
              <strong>Email:</strong> {user.email}
            </div>
            <div>
              <strong>Role:</strong>{" "}
              {(userProfile?.role || "User").charAt(0).toUpperCase() +
                (userProfile?.role || "User").slice(1).toLowerCase()}
            </div>
            <div>
              <strong>User ID:</strong> <span className="font-mono text-xs">{user.id}</span>
            </div>
          </div>

          {error && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-sm text-red-600">
                <strong>Error:</strong> {String(error)}
              </div>
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={refreshAuth} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh Status
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
