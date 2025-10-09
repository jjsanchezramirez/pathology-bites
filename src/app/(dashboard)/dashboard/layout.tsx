// src/app/(dashboard)/dashboard/layout.tsx
import { Metadata } from "next"
import { UnifiedLayoutClient } from "@/shared/components/layout/unified-layout-client"
import { DashboardSettingsProvider } from "@/shared/contexts/dashboard-settings-provider"
import { DashboardThemeProvider } from "@/shared/contexts/dashboard-theme-context"

export const metadata: Metadata = {
  title: "Dashboard - Pathology Bites",
  description: "Dashboard for Pathology Bites learning platform",
}

export default function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
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
  )
}