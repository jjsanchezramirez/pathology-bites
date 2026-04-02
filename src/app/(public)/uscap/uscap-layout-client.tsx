"use client";

import { useMemo } from "react";
import { UnifiedLayoutClient } from "@/shared/components/layout/unified-layout-client";
import { DashboardSettingsProvider } from "@/shared/contexts/dashboard-settings-provider";
import { DashboardThemeProvider } from "@/shared/contexts/dashboard-theme-context";
import { getGuestNavigationSections } from "@/shared/config/navigation";

export function USCAPLayoutClient({ children }: { children: React.ReactNode }) {
  const guestNav = useMemo(() => getGuestNavigationSections(), []);

  return (
    <DashboardSettingsProvider isGuest={true}>
      <DashboardThemeProvider isGuest>
        <UnifiedLayoutClient
          userType="user"
          headerConfig={{
            showNotifications: false,
            showFontSize: true,
          }}
          navigationOverride={guestNav}
          hideAuthStatus
        >
          {children}
        </UnifiedLayoutClient>
      </DashboardThemeProvider>
    </DashboardSettingsProvider>
  );
}
