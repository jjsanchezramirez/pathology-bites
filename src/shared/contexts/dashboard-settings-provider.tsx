// src/shared/contexts/dashboard-settings-provider.tsx
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useTheme } from "next-themes";
import { userSettingsService } from "@/shared/services/user-settings";
import { useUserSettings } from "@/shared/hooks/use-user-settings";
import { getTextZoomConfig, applyTextZoom, getValidZoomLevel } from "@/shared/utils/text-zoom";
import { useUserRole } from "@/shared/hooks/use-user-role";
import { getAdminModeFromCookie, getThemeKeyForMode } from "@/shared/utils/admin-mode";

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
  const [textZoom, setTextZoomState] = useState(1.0);
  const [dashboardTheme, setDashboardThemeState] = useState("default");
  const config = getTextZoomConfig();
  const { setTheme: setNextTheme } = useTheme();

  // Use cached user settings hook (eliminates redundant API calls)
  // Note: refetchOnMount removed - cache handles freshness with 5-min TTL and 2-min stale time
  const { data: settings, isLoading } = useUserSettings({
    onSuccess: (data) => {
      console.log("[DashboardSettings] Settings loaded from cache:", data.ui_settings);
    },
  });

  // Apply settings when loaded
  useEffect(() => {
    if (!settings) return;

    console.log("[DashboardSettings] Applying settings:", settings.ui_settings);

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

    // Sync light/dark mode theme from database to next-themes
    const colorMode = settings.ui_settings?.theme ?? "system";
    setNextTheme(colorMode);

    console.log(
      "[DashboardSettings] Applied - zoom:",
      validZoom,
      "dashboardTheme:",
      theme,
      "colorMode:",
      colorMode,
      "adminMode:",
      adminMode
    );
  }, [settings, config.default, isAdmin, setNextTheme]);

  // Update text zoom
  const setTextZoom = async (newZoom: number) => {
    const validZoom = getValidZoomLevel(newZoom);
    setTextZoomState(validZoom);
    applyTextZoom(validZoom);

    try {
      await userSettingsService.updateUISettings({ text_zoom: validZoom });
      console.log("[DashboardSettings] Text zoom saved:", validZoom);
      // Don't invalidate cache immediately - local state is already updated
      // Cache will be refreshed on next page load
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

      await userSettingsService.updateUISettings({ [themeKey]: theme });
      console.log("[DashboardSettings] Theme saved:", theme);
      // Don't invalidate cache immediately - local state is already updated
      // Cache will be refreshed on next page load
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
