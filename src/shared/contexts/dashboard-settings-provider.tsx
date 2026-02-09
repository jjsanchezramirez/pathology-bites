// src/shared/contexts/dashboard-settings-provider.tsx
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useTheme } from "next-themes";
import { userSettingsService } from "@/shared/services/user-settings";
import { useUserSettings } from "@/shared/hooks/use-user-settings";
import { getTextZoomConfig, applyTextZoom, getValidZoomLevel } from "@/shared/utils/ui/text-zoom";
import { useUserRole } from "@/shared/hooks/use-user-role";
import { getAdminModeFromCookie, getThemeKeyForMode } from "@/shared/utils/auth/admin-mode";

interface DashboardSettingsContextType {
  textZoom: number;
  setTextZoom: (zoom: number) => void;
  dashboardTheme: string;
  setDashboardTheme: (theme: string) => void;
  isLoading: boolean;
}

const DashboardSettingsContext = createContext<DashboardSettingsContextType | undefined>(undefined);

export function DashboardSettingsProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useUserRole();
  const { setTheme: setColorMode } = useTheme();
  const [textZoom, setTextZoomState] = useState(1.0);
  const [dashboardTheme, setDashboardThemeState] = useState("default");
  const config = getTextZoomConfig();

  // Use cached user settings hook (eliminates redundant API calls)
  // Note: refetchOnMount removed - cache handles freshness with 5-min TTL and 2-min stale time
  const { data: settings, isLoading } = useUserSettings();

  // Apply settings when loaded
  useEffect(() => {
    if (!settings) return;

    // Apply text zoom
    const zoom = settings.ui_settings?.text_zoom ?? config.default;
    const validZoom = getValidZoomLevel(zoom);
    setTextZoomState(validZoom);
    applyTextZoom(validZoom);

    // Apply dashboard theme using utility function
    const adminMode = getAdminModeFromCookie(isAdmin);
    const themeKey = getThemeKeyForMode(adminMode);
    const theme = settings.ui_settings?.[themeKey] ?? "default";
    setDashboardThemeState(theme);

    // Seed next-themes if localStorage key is missing (after logout or first login).
    // Only seed when key is absent to avoid overriding the user's immediate toggle changes.
    // Once the user clicks the toggle, the key exists and this won't fire.
    const storedTheme = localStorage.getItem("pathology-bites-theme");
    if (!storedTheme && settings.ui_settings?.theme) {
      setColorMode(settings.ui_settings.theme);
    }
  }, [settings, config.default, isAdmin, setColorMode]);

  // Update text zoom
  const setTextZoom = async (newZoom: number) => {
    const validZoom = getValidZoomLevel(newZoom);
    setTextZoomState(validZoom);
    applyTextZoom(validZoom);

    try {
      const updatedSettings = await userSettingsService.updateUISettings({ text_zoom: validZoom });

      // Update SWR cache to keep it in sync
      if (settings) {
        const { mutate } = await import("swr");
        mutate(
          "user-settings",
          {
            ...settings,
            ui_settings: updatedSettings,
          },
          false
        );
      }
    } catch (error) {
      console.error("[DashboardSettings] Failed to save text zoom:", error);
    }
  };

  // Update dashboard theme
  const setDashboardTheme = async (theme: string) => {
    setDashboardThemeState(theme);

    try {
      const adminMode = getAdminModeFromCookie(isAdmin);
      const themeKey = getThemeKeyForMode(adminMode);

      const updatedSettings = await userSettingsService.updateUISettings({ [themeKey]: theme });

      // Update SWR cache to keep it in sync
      if (settings) {
        const { mutate } = await import("swr");
        mutate(
          "user-settings",
          {
            ...settings,
            ui_settings: updatedSettings,
          },
          false
        );
      }
    } catch (error) {
      console.error("[DashboardSettings] Failed to save theme:", error);
    }
  };

  const value: DashboardSettingsContextType = {
    textZoom,
    setTextZoom,
    dashboardTheme,
    setDashboardTheme,
    isLoading,
  };

  return (
    <DashboardSettingsContext.Provider value={value}>{children}</DashboardSettingsContext.Provider>
  );
}

export function useDashboardSettings() {
  const context = useContext(DashboardSettingsContext);
  if (context === undefined) {
    throw new Error("useDashboardSettings must be used within DashboardSettingsProvider");
  }
  return context;
}
