// src/app/(admin)/admin/layout.tsx
import { Metadata } from "next"
import { UnifiedLayoutClient } from "@/shared/components/layout/unified-layout-client"
import { DashboardSettingsProvider } from "@/shared/contexts/dashboard-settings-provider"
import { DashboardThemeProvider } from "@/shared/contexts/dashboard-theme-context"

export const metadata: Metadata = {
  title: "Dashboard - Pathology Bites",
  description: "Dashboard for managing Pathology Bites platform",
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
          {children}
        </UnifiedLayoutClient>
      </DashboardThemeProvider>
    </DashboardSettingsProvider>
  )
}