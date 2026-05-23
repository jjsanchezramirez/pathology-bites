// src/app/(admin)/admin/layout.tsx
"use client";

import { UnifiedLayoutClient } from "@/shared/components/layout/unified-layout-client";
import { DashboardSettingsProvider } from "@/shared/contexts/dashboard-settings-provider";
import { DashboardThemeProvider } from "@/shared/contexts/dashboard-theme-context";
import { architectsDaughter } from "@/shared/fonts/dashboard-fonts";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardSettingsProvider>
      <DashboardThemeProvider>
        <UnifiedLayoutClient
          userType="admin"
          headerConfig={{
            showNotifications: true,
            showFontSize: true,
          }}
        >
          <div className={architectsDaughter.variable}>{children}</div>
        </UnifiedLayoutClient>
      </DashboardThemeProvider>
    </DashboardSettingsProvider>
  );
}
