// src/app/(dashboard)/dashboard/layout.tsx
"use client";

import { UnifiedLayoutClient } from "@/shared/components/layout/unified-layout-client";
import { DashboardSettingsProvider } from "@/shared/contexts/dashboard-settings-provider";
import { DashboardThemeProvider } from "@/shared/contexts/dashboard-theme-context";

export default function DashboardLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <DashboardSettingsProvider>
      <DashboardThemeProvider>
        <UnifiedLayoutClient
          userType="user"
          headerConfig={{
            showNotifications: true,
            showFontSize: true,
          }}
        >
          {children}
        </UnifiedLayoutClient>
      </DashboardThemeProvider>
    </DashboardSettingsProvider>
  );
}
