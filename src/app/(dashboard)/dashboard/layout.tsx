// src/app/(dashboard)/dashboard/layout.tsx
"use client";

import { UnifiedLayoutClient } from "@/shared/components/layout/unified-layout-client";
import { DashboardSettingsProvider } from "@/shared/contexts/dashboard-settings-provider";
import { DashboardThemeProvider } from "@/shared/contexts/dashboard-theme-context";
import { AskAlbrightLauncher } from "@/features/user/ask-albright/components/ask-albright-launcher";
import { ASK_ALBRIGHT_ENABLED } from "@/features/user/ask-albright/lib/enabled";

export default function DashboardLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <DashboardSettingsProvider>
      <DashboardThemeProvider>
        <UnifiedLayoutClient>{children}</UnifiedLayoutClient>
        {ASK_ALBRIGHT_ENABLED && <AskAlbrightLauncher />}
      </DashboardThemeProvider>
    </DashboardSettingsProvider>
  );
}
