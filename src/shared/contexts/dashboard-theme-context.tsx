// src/shared/contexts/dashboard-theme-context.tsx
"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useSWRConfig } from "swr";
import {
  dashboardThemes,
  getThemeById,
  getDefaultTheme,
  type DashboardTheme,
} from "@/shared/config/dashboard-themes";
import { useUserRole } from "@/shared/hooks/use-user-role";
import { useUserSettings } from "@/shared/hooks/use-user-settings";
import {
  type AdminMode,
  getAdminModeFromCookie,
  setAdminModeCookie,
  getThemeKeyForMode,
  isAdminTypeMode,
} from "@/shared/utils/auth/admin-mode";
import { userSettingsService } from "@/shared/services/user-settings";

/**
 * Derive admin mode from the current URL pathname.
 * /admin* → user's actual admin-type role (admin/creator/reviewer) if they have one
 * everything else → "user"
 * Manual URL nav (typing /admin or /dashboard) should switch the theme even
 * without clicking the mode toggle — this is the source of truth, not the cookie.
 */
function deriveAdminModeFromPathname(
  pathname: string | null,
  role: "admin" | "creator" | "reviewer" | "user" | null
): AdminMode {
  const isAdminPath = !!pathname && pathname.startsWith("/admin");
  if (isAdminPath && role && (role === "admin" || role === "creator" || role === "reviewer")) {
    return role;
  }
  return "user";
}

interface DashboardThemeContextType {
  currentTheme: DashboardTheme;
  setTheme: (themeId: string) => Promise<void>;
  availableThemes: DashboardTheme[];
  isLoading: boolean;
  adminMode: AdminMode;
  setAdminMode: (mode: AdminMode) => void;
  isTransitioning: boolean;
  setTransitioning: (transitioning: boolean) => void;
}

const DashboardThemeContext = createContext<DashboardThemeContextType | undefined>(undefined);

interface DashboardThemeProviderProps {
  children: React.ReactNode;
  isGuest?: boolean;
}

export function DashboardThemeProvider({ children, isGuest = false }: DashboardThemeProviderProps) {
  const { isAdmin, role } = useUserRole();
  const { mutate } = useSWRConfig();
  const pathname = usePathname();

  // Mode derived from URL — the toggle button still owns cookie writes, but
  // pathname is now the source of truth. Manual URL nav between /admin and
  // /dashboard now flips the theme correctly without needing the button.
  const derivedMode = useMemo(
    () => deriveAdminModeFromPathname(pathname, role ?? null),
    [pathname, role]
  );

  const [currentTheme, setCurrentTheme] = useState<DashboardTheme>(getDefaultTheme());
  const [adminMode, setAdminModeState] = useState<AdminMode>(() =>
    getAdminModeFromCookie(isAdmin, role)
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Sync cookie + state to derived mode whenever URL or role changes.
  // Keeps the toggle button's "current mode" indicator in sync after manual
  // URL nav, and ensures other components reading the cookie see the active mode.
  useEffect(() => {
    if (isGuest) return;
    if (derivedMode !== adminMode) {
      setAdminModeState(derivedMode);
      setAdminModeCookie(derivedMode);
    }
  }, [derivedMode, adminMode, isGuest]);

  // Use SWR cache instead of redundant localStorage
  const { data: settings } = useUserSettings({ enabled: !isGuest });

  // Get available themes based on admin mode
  const getAvailableThemes = (mode: AdminMode): DashboardTheme[] => {
    if (isAdminTypeMode(mode)) {
      // Admin/Creator/Reviewer modes: only default theme
      return dashboardThemes.filter((theme) => theme.id === "default");
    } else {
      // User mode: notebook and tangerine themes
      return dashboardThemes.filter((theme) => ["notebook", "tangerine"].includes(theme.id));
    }
  };

  // Get default theme for mode
  const getDefaultThemeForMode = (mode: AdminMode): DashboardTheme => {
    if (isAdminTypeMode(mode)) {
      return getThemeById("default") || getDefaultTheme();
    } else {
      return getThemeById("tangerine") || getDefaultTheme();
    }
  };

  // Cleanup: Reset to default theme when component unmounts (user leaves dashboard)
  useEffect(() => {
    return () => {
      const root = document.documentElement;
      const defaultTheme = getThemeById("default") || getDefaultTheme();
      const isDarkMode = root.classList.contains("dark");
      const variables = isDarkMode ? defaultTheme.variables.dark : defaultTheme.variables.light;

      // Reset to default theme variables
      Object.entries(variables).forEach(([key, value]) => {
        let formattedValue = value;
        if (
          (key.includes("color") ||
            key.includes("ground") ||
            key.includes("border") ||
            key.includes("ring") ||
            key.includes("chart") ||
            key.includes("sidebar") ||
            key === "--background" ||
            key === "--foreground" ||
            key === "--card" ||
            key === "--popover" ||
            key === "--primary" ||
            key === "--secondary" ||
            key === "--muted" ||
            key === "--accent" ||
            key === "--destructive" ||
            key === "--input") &&
          !key.includes("shadow")
        ) {
          formattedValue = value.includes("hsl(") ? value : `hsl(${value})`;
        }
        root.style.setProperty(key, formattedValue);
      });

      root.setAttribute("data-dashboard-theme", "default");
      console.log("[DashboardTheme] Cleanup: Reset to default theme");
    };
  }, []);

  // Load theme from SWR cache (no API calls, no redundant localStorage!)
  useEffect(() => {
    try {
      console.log("[DashboardTheme] Loading theme from SWR cache...");

      // Mode is derived from URL pathname (see derivedMode above). Cookie sync
      // happens in the dedicated effect.
      const defaultMode = derivedMode;
      console.log("[DashboardTheme] Admin mode:", defaultMode, "isAdmin:", isAdmin, "role:", role);

      // Load theme based on admin mode from SWR cache
      const availableThemes = getAvailableThemes(defaultMode);
      let themeToSet: DashboardTheme;

      if (settings?.ui_settings) {
        const themeKey = getThemeKeyForMode(defaultMode);
        const themeId = settings.ui_settings[themeKey];

        console.log(`[DashboardTheme] Mode: ${defaultMode}, Theme:`, themeId);

        if (themeId) {
          const theme = getThemeById(themeId);
          if (theme && availableThemes.some((t) => t.id === theme.id)) {
            themeToSet = theme;
            console.log("[DashboardTheme] Loaded from SWR cache:", themeToSet.id);
          } else {
            themeToSet = getDefaultThemeForMode(defaultMode);
            console.log("[DashboardTheme] Theme not available, using default:", themeToSet.id);
          }
        } else {
          themeToSet = getDefaultThemeForMode(defaultMode);
          console.log("[DashboardTheme] No theme preference, using default:", themeToSet.id);
        }
      } else {
        themeToSet = getDefaultThemeForMode(defaultMode);
        console.log("[DashboardTheme] No settings in SWR cache, using default:", themeToSet.id);
      }

      console.log("[DashboardTheme] Applying theme:", themeToSet.id);
      setCurrentTheme(themeToSet);
      setIsLoading(false);
    } catch (error) {
      console.warn("[DashboardTheme] Failed to load dashboard settings:", error);
      setCurrentTheme(getDefaultTheme());
      setIsLoading(false);
    }
  }, [settings, isAdmin, role, derivedMode]);

  // (Removed: 100ms cookie polling. The derivedMode useMemo above reacts to
  // pathname/role changes directly, and the sync effect updates state +
  // cookie. The load-theme effect re-runs on derivedMode change to swap the
  // theme — so polling is fully redundant.)

  // Watch for localStorage changes (when DashboardSettingsProvider syncs settings)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "pathology-bites-ui-settings" && e.newValue) {
        try {
          const uiSettings = JSON.parse(e.newValue);
          const themeKey = getThemeKeyForMode(adminMode);
          const themeId = uiSettings[themeKey];

          if (themeId) {
            const theme = getThemeById(themeId);
            const availableThemes = getAvailableThemes(adminMode);
            if (theme && availableThemes.some((t) => t.id === theme.id)) {
              setCurrentTheme(theme);
              console.log("[DashboardTheme] Updated theme from localStorage:", themeId);
            }
          }
        } catch (error) {
          console.warn("[DashboardTheme] Failed to update theme from storage event:", error);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [adminMode]);

  // Apply theme CSS variables when theme changes
  useEffect(() => {
    if (isLoading) return;

    const applyThemeVariables = (theme: DashboardTheme) => {
      const root = document.documentElement;

      // IMPORTANT: Don't apply dashboard theme on error pages
      // Error pages should always use light mode and system theme
      if (root.hasAttribute("data-error-page-enforced")) {
        console.log("[DashboardTheme] Error page detected, skipping theme application");
        return;
      }

      // Check if we're in dark mode
      const isDarkMode = root.classList.contains("dark");
      const variables = isDarkMode ? theme.variables.dark : theme.variables.light;

      // Apply theme variables directly to override the default CSS variables
      Object.entries(variables).forEach(([key, value]) => {
        // Handle different types of CSS variables
        let formattedValue = value;

        // For color variables, ensure HSL format (but not for shadows which already contain hsl())
        if (
          (key.includes("color") ||
            key.includes("ground") ||
            key.includes("border") ||
            key.includes("ring") ||
            key.includes("chart") ||
            key.includes("sidebar") ||
            key === "--background" ||
            key === "--foreground" ||
            key === "--card" ||
            key === "--popover" ||
            key === "--primary" ||
            key === "--secondary" ||
            key === "--muted" ||
            key === "--accent" ||
            key === "--destructive" ||
            key === "--input") &&
          !key.includes("shadow")
        ) {
          formattedValue = value.includes("hsl(") ? value : `hsl(${value})`;
        }
        // For font, shadow, radius, tracking, and spacing variables, use as-is
        // These are already properly formatted

        root.style.setProperty(key, formattedValue);
      });

      // Set a data attribute to identify the current dashboard theme
      root.setAttribute("data-dashboard-theme", theme.id);
    };

    applyThemeVariables(currentTheme);

    // Listen for theme mode changes (light/dark) to reapply variables
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
          // Don't reapply theme on error pages
          if (!document.documentElement.hasAttribute("data-error-page-enforced")) {
            applyThemeVariables(currentTheme);
          }
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, [currentTheme, isLoading]);

  const setTheme = async (themeId: string) => {
    const theme = getThemeById(themeId);
    const availableThemes = getAvailableThemes(adminMode);

    // Check if theme is available for current mode
    if (theme && availableThemes.some((t) => t.id === theme.id)) {
      setCurrentTheme(theme);

      // Store theme preference per mode
      const themeKey = getThemeKeyForMode(adminMode);

      try {
        // Save to database immediately and update SWR cache
        const updatedSettings = await userSettingsService.updateUISettings({ [themeKey]: themeId });
        console.log(`[DashboardTheme] Saved ${adminMode} theme to database:`, themeId);

        // Manually update SWR cache to keep it in sync
        if (settings) {
          mutate(
            "user-settings",
            {
              ...settings,
              ui_settings: updatedSettings,
            },
            false
          );
          console.log(`[DashboardTheme] SWR cache updated`);
        }
      } catch (error) {
        console.error("[DashboardTheme] Failed to save theme to database:", error);
      }
    }
  };

  const setAdminMode = (mode: AdminMode) => {
    // Update cookie using utility function
    setAdminModeCookie(mode);

    setAdminModeState(mode);

    // Switch to appropriate theme for new mode
    const newTheme = getDefaultThemeForMode(mode);
    setCurrentTheme(newTheme);
  };

  const setTransitioning = (transitioning: boolean) => {
    setIsTransitioning(transitioning);
  };

  // Recalculate available themes whenever adminMode changes
  const availableThemes = getAvailableThemes(adminMode);

  const value: DashboardThemeContextType = {
    currentTheme,
    setTheme,
    availableThemes,
    isLoading,
    adminMode,
    setAdminMode,
    isTransitioning,
    setTransitioning,
  };

  return <DashboardThemeContext.Provider value={value}>{children}</DashboardThemeContext.Provider>;
}

export function useDashboardTheme() {
  const context = useContext(DashboardThemeContext);
  if (context === undefined) {
    throw new Error("useDashboardTheme must be used within a DashboardThemeProvider");
  }
  return context;
}

// Hook to get theme-aware CSS classes for dashboard components
export function useDashboardThemeClasses() {
  const { currentTheme } = useDashboardTheme();

  return {
    themeId: currentTheme.id,
    // Helper function to get dashboard-specific classes
    getThemeClass: (baseClass: string) => {
      return `${baseClass} dashboard-themed`;
    },
  };
}
