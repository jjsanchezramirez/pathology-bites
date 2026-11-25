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
import { log } from "@/shared/utils/logging";

/**
 * Derive admin mode from the current URL pathname.
 * /admin* → "admin" for staff (admins and anyone holding a permission)
 * everything else → "user"
 * Manual URL nav (typing /admin or /dashboard) should switch the theme even
 * without clicking the mode toggle — this is the source of truth, not the cookie.
 */
/** Themes offered on the student dashboard. The admin area only gets "default". */
const STUDENT_THEME_IDS = ["tangerine", "sage-garden", "notebook", "default"];

/** Every CSS variable any theme writes, in either mode. */
const ALL_THEME_VARIABLE_KEYS = Array.from(
  new Set(
    dashboardThemes.flatMap((theme) => [
      ...Object.keys(theme.variables.light),
      ...Object.keys(theme.variables.dark),
    ])
  )
);

function deriveAdminModeFromPathname(pathname: string | null, isStaff: boolean): AdminMode {
  const isAdminPath = !!pathname && pathname.startsWith("/admin");
  return isAdminPath && isStaff ? "admin" : "user";
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
  const { isStaff } = useUserRole();
  const { mutate } = useSWRConfig();
  const pathname = usePathname();

  // Mode derived from URL — the toggle button still owns cookie writes, but
  // pathname is now the source of truth. Manual URL nav between /admin and
  // /dashboard now flips the theme correctly without needing the button.
  const derivedMode = useMemo(
    () => deriveAdminModeFromPathname(pathname, isStaff),
    [pathname, isStaff]
  );

  const [currentTheme, setCurrentTheme] = useState<DashboardTheme>(getDefaultTheme());
  const [adminMode, setAdminModeState] = useState<AdminMode>(() => getAdminModeFromCookie(isStaff));
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
      // Admin area: only default theme
      return dashboardThemes.filter((theme) => theme.id === "default");
    } else {
      // Student dashboard: everything listed in STUDENT_THEME_IDS
      return dashboardThemes.filter((theme) => STUDENT_THEME_IDS.includes(theme.id));
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
      log.debug("[DashboardTheme] Cleanup: Reset to default theme");
    };
  }, []);

  // Load theme from SWR cache (no API calls, no redundant localStorage!)
  useEffect(() => {
    try {
      log.debug("[DashboardTheme] Loading theme from SWR cache...");

      // Mode is derived from URL pathname (see derivedMode above). Cookie sync
      // happens in the dedicated effect.
      const defaultMode = derivedMode;
      log.debug("[DashboardTheme] Admin mode:", defaultMode, "isStaff:", isStaff);

      // Load theme based on admin mode from SWR cache
      const availableThemes = getAvailableThemes(defaultMode);
      let themeToSet: DashboardTheme;

      if (settings?.ui_settings) {
        const themeKey = getThemeKeyForMode(defaultMode);
        const themeId = settings.ui_settings[themeKey];

        log.debug(`[DashboardTheme] Mode: ${defaultMode}, Theme:`, themeId);

        if (themeId) {
          const theme = getThemeById(themeId);
          if (theme && availableThemes.some((t) => t.id === theme.id)) {
            themeToSet = theme;
            log.debug("[DashboardTheme] Loaded from SWR cache:", themeToSet.id);
          } else {
            themeToSet = getDefaultThemeForMode(defaultMode);
            log.debug("[DashboardTheme] Theme not available, using default:", themeToSet.id);
          }
        } else {
          themeToSet = getDefaultThemeForMode(defaultMode);
          log.debug("[DashboardTheme] No theme preference, using default:", themeToSet.id);
        }
      } else {
        themeToSet = getDefaultThemeForMode(defaultMode);
        log.debug("[DashboardTheme] No settings in SWR cache, using default:", themeToSet.id);
      }

      log.debug("[DashboardTheme] Applying theme:", themeToSet.id);
      setCurrentTheme(themeToSet);
      setIsLoading(false);
    } catch (error) {
      log.warn("[DashboardTheme] Failed to load dashboard settings:", error);
      setCurrentTheme(getDefaultTheme());
      setIsLoading(false);
    }
  }, [settings, isStaff, derivedMode]);

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
              log.debug("[DashboardTheme] Updated theme from localStorage:", themeId);
            }
          }
        } catch (error) {
          log.warn("[DashboardTheme] Failed to update theme from storage event:", error);
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
        log.debug("[DashboardTheme] Error page detected, skipping theme application");
        return;
      }

      // Check if we're in dark mode
      const isDarkMode = root.classList.contains("dark");
      const variables = isDarkMode ? theme.variables.dark : theme.variables.light;

      // Clear variables another theme set that this one doesn't define
      // (e.g. Notebook's shadows), so switching themes never leaks styles.
      ALL_THEME_VARIABLE_KEYS.forEach((key) => {
        if (!(key in variables)) root.style.removeProperty(key);
      });

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
        log.debug(`[DashboardTheme] Saved ${adminMode} theme to database:`, themeId);

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
          log.debug(`[DashboardTheme] SWR cache updated`);
        }
      } catch (error) {
        log.error("[DashboardTheme] Failed to save theme to database:", error);
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
