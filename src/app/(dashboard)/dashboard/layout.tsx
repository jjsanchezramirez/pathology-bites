// src/app/(dashboard)/dashboard/layout.tsx
"use client";

import { UnifiedLayoutClient } from "@/shared/components/layout/unified-layout-client";
import { DashboardSettingsProvider } from "@/shared/contexts/dashboard-settings-provider";
import { DashboardThemeProvider } from "@/shared/contexts/dashboard-theme-context";
import { AskAlbrightLauncher } from "@/features/user/ask-albright/components/ask-albright-launcher";

export default function DashboardLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <DashboardSettingsProvider>
      <DashboardThemeProvider>
        <UnifiedLayoutClient>{children}</UnifiedLayoutClient>
        <AskAlbrightLauncher />
      </DashboardThemeProvider>
    </DashboardSettingsProvider>
  );
}
