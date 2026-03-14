// src/app/(public)/uscap/layout.tsx
"use client";

import { UnifiedLayoutClient } from "@/shared/components/layout/unified-layout-client";
import { DashboardSettingsProvider } from "@/shared/contexts/dashboard-settings-provider";
import { DashboardThemeProvider } from "@/shared/contexts/dashboard-theme-context";

export default function USCAPLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <DashboardSettingsProvider isGuest={true}>
      <DashboardThemeProvider>
        <UnifiedLayoutClient
          userType="user"
          headerConfig={{
            showNotifications: false, // No notifications for guests
            showFontSize: true,
          }}
        >
          {children}
        </UnifiedLayoutClient>
      </DashboardThemeProvider>
    </DashboardSettingsProvider>
  );
}
